import { FileHandler } from './modules/fileHandler.js';
import { ColorMatcher } from './modules/colorMatcher.js';
import { DataManager } from './modules/dataManager.js';
import { UIRenderer } from './modules/uiRenderer.js';

class AlphaColorMatch {
    constructor() {
        this.fileHandler = new FileHandler();
        this.colorMatcher = new ColorMatcher();
        this.dataManager = new DataManager();
        this.uiRenderer = new UIRenderer(this);
        
        this.primaryData = [];
        this.secondaryData = [];
        this.comparisonResults = [];
        this.currentFilter = 'all';
        this.actionHistory = [];
        this.actionCounter = 0;
        this.searchTerm = '';
        
        this.actionStateMap = new Map();
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadHistory();
        this.uiRenderer.initCreatorTable();
        window.app = this;
        this.loadFullState();
    }
    
    bindEvents() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchView(btn.dataset.view));
        });
        
        document.getElementById('primaryFileInput').addEventListener('change', (e) => this.loadPrimaryFile(e.target.files[0]));
        document.getElementById('secondaryFileInput').addEventListener('change', (e) => this.loadSecondaryFile(e.target.files[0]));
        
        document.getElementById('compareBtn').addEventListener('click', () => this.compareFiles());
        document.getElementById('replaceAllBtn')?.addEventListener('click', () => this.replaceAllColors());
        document.getElementById('exportResultsBtn').addEventListener('click', () => this.exportResults());
        document.getElementById('clearAllBtn').addEventListener('click', () => this.clearAll());
        document.getElementById('clearHistoryBtn')?.addEventListener('click', () => this.clearHistory());
        document.getElementById('downloadTxtBtn')?.addEventListener('click', () => this.downloadCreatorFile());
        document.getElementById('addColorRowBtn')?.addEventListener('click', () => this.uiRenderer.addCreatorRow());
        document.getElementById('resetCreatorBtn')?.addEventListener('click', () => this.uiRenderer.resetCreatorTable());
        
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value;
                this.filterResults();
                this.saveFullState();
            });
        }
        
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.currentFilter = tab.dataset.filter;
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.filterResults();
                this.saveFullState();
            });
        });
    }
    
    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }
    
    updateFileInfo(type, filename, count) {
        const infoDiv = document.getElementById(`${type}FileInfo`);
        if (infoDiv) {
            infoDiv.querySelector('.filename').textContent = filename;
            infoDiv.querySelector('.record-count').textContent = `${count} registro${count !== 1 ? 's' : ''}`;
        }
        if (type === 'primary') {
            document.getElementById('primaryCount').textContent = count;
        } else {
            document.getElementById('secondaryCount').textContent = count;
        }
    }
    
    getUniqueColorId(color) {
        const normalizedName = this.colorMatcher.normalizeNameForComparison(color.name);
        return `${color.id}_${normalizedName}`;
    }
    
    getCanonicalName(name) {
        const nkMatch = name.match(/NK\d+$/);
        let nameWithoutNK = name.replace(/\s+NK\d+$/, '').trim();
        nameWithoutNK = nameWithoutNK.replace(/\s+/g, ' ');
        const normalizedBase = this.colorMatcher.normalizeBaseName(nameWithoutNK);
        return normalizedBase;
    }
    
    saveFullState() {
        try {
            const searchInput = document.getElementById('searchInput');
            const currentSearchTerm = searchInput ? searchInput.value : '';
            
            const fullState = {
                primaryData: this.primaryData,
                secondaryData: this.secondaryData,
                actionStateMap: Array.from(this.actionStateMap.entries()),
                currentFilter: this.currentFilter,
                searchTerm: currentSearchTerm,
                lastUpdated: new Date().toISOString(),
                version: '1.0'
            };
            localStorage.setItem('alpha_color_match_full_state', JSON.stringify(fullState));
            console.log('💾 Estado completo guardado');
        } catch (error) {
            console.error('Error al guardar estado completo:', error);
        }
    }
    
    loadFullState() {
        try {
            const savedState = localStorage.getItem('alpha_color_match_full_state');
            if (savedState) {
                const state = JSON.parse(savedState);
                console.log('📂 Cargando estado guardado...');
                
                let hasData = false;
                
                if (state.primaryData && state.primaryData.length > 0) {
                    this.primaryData = state.primaryData;
                    this.updateFileInfo('primary', 'Datos guardados', this.primaryData.length);
                    hasData = true;
                }
                
                if (state.secondaryData && state.secondaryData.length > 0) {
                    this.secondaryData = state.secondaryData;
                    this.updateFileInfo('secondary', 'Datos guardados', this.secondaryData.length);
                    hasData = true;
                }
                
                if (state.actionStateMap && state.actionStateMap.length > 0) {
                    this.actionStateMap = new Map(state.actionStateMap);
                    console.log(`✅ Estado restaurado: ${this.actionStateMap.size} colores marcados`);
                    hasData = true;
                }
                
                if (state.currentFilter) {
                    this.currentFilter = state.currentFilter;
                    document.querySelectorAll('.filter-tab').forEach(tab => {
                        if (tab.dataset.filter === this.currentFilter) {
                            tab.classList.add('active');
                        } else {
                            tab.classList.remove('active');
                        }
                    });
                }
                
                if (state.searchTerm !== undefined) {
                    const searchInput = document.getElementById('searchInput');
                    if (searchInput) {
                        searchInput.value = state.searchTerm;
                        this.searchTerm = state.searchTerm;
                    }
                }
                
                if (this.primaryData.length > 0 && this.secondaryData.length > 0) {
                    console.log('🔄 Regenerando comparación con datos guardados...');
                    const rawResults = this.colorMatcher.smartCompare(this.primaryData, this.secondaryData);
                    
                    this.comparisonResults = rawResults.map(result => {
                        const uniqueId = this.getUniqueColorId(result);
                        const savedStateItem = this.actionStateMap.get(uniqueId);
                        if (savedStateItem) {
                            return {
                                ...result,
                                actionTaken: savedStateItem.actionTaken,
                                actionReason: savedStateItem.reason,
                                actionTimestamp: savedStateItem.timestamp
                            };
                        }
                        return result;
                    });
                    
                    const stats = this.colorMatcher.getComparisonStats(this.comparisonResults);
                    this.updateStats(stats);
                    this.updateStatsBar(stats);
                    this.saveToHistory(stats);
                    this.filterResults();
                    this.uiRenderer.showToast(`💾 Datos recuperados: ${this.primaryData.length} colores`, 'success');
                } else if (hasData) {
                    this.uiRenderer.showToast(`📂 Datos cargados: ${this.primaryData.length} colores en referencia`, 'info');
                    this.filterResults();
                }
            }
        } catch (error) {
            console.error('Error al cargar estado completo:', error);
        }
    }
    
    clearFullState() {
        localStorage.removeItem('alpha_color_match_full_state');
        console.log('🗑️ Estado completo eliminado');
    }
    
    async loadPrimaryFile(file) {
        if (!file) return;
        this.showLoading(true);
        try {
            const data = await this.fileHandler.parseTxtFile(file);
            this.primaryData = data;
            this.updateFileInfo('primary', file.name, data.length);
            this.uiRenderer.showToast(`✅ Archivo principal cargado: ${data.length} colores`, 'success');
            this.actionStateMap.clear();
            this.saveFullState();
            if (this.secondaryData.length > 0) {
                this.compareFiles();
            }
        } finally {
            this.showLoading(false);
        }
    }
    
    async loadSecondaryFile(file) {
        if (!file) return;
        this.showLoading(true);
        try {
            const data = await this.fileHandler.parseTxtFile(file);
            this.secondaryData = data;
            this.updateFileInfo('secondary', file.name, data.length);
            this.uiRenderer.showToast(`✅ Archivo secundario cargado: ${data.length} colores`, 'success');
            this.saveFullState();
            if (this.primaryData.length > 0) {
                this.compareFiles();
            }
        } finally {
            this.showLoading(false);
        }
    }
    
    compareFiles() {
        if (this.primaryData.length === 0) {
            this.uiRenderer.showToast('⚠️ Por favor, cargue el archivo principal primero', 'warning');
            return;
        }
        if (this.secondaryData.length === 0) {
            this.uiRenderer.showToast('⚠️ Por favor, cargue el archivo secundario para comparar', 'warning');
            return;
        }
        
        this.showLoading(true);
        
        setTimeout(() => {
            try {
                const rawResults = this.colorMatcher.smartCompare(this.primaryData, this.secondaryData);
                
                this.comparisonResults = rawResults.map(result => {
                    const uniqueId = this.getUniqueColorId(result);
                    const savedState = this.actionStateMap.get(uniqueId);
                    if (savedState) {
                        return {
                            ...result,
                            actionTaken: savedState.actionTaken,
                            actionReason: savedState.reason,
                            actionTimestamp: savedState.timestamp
                        };
                    }
                    return result;
                });
                
                const stats = this.colorMatcher.getComparisonStats(this.comparisonResults);
                this.updateStats(stats);
                this.updateStatsBar(stats);
                this.saveToHistory(stats);
                this.filterResults();
                this.saveFullState();
                
                this.uiRenderer.showToast(`🔍 Comparación completada: ${stats.differences} diferencias, ${stats.missing} no encontrados`, 'info');
            } finally {
                this.showLoading(false);
            }
        }, 100);
    }
    
    updateStats(stats) {
        const totalEl = document.getElementById('totalCount');
        const matchEl = document.getElementById('matchCount');
        const diffDisplayEl = document.getElementById('diffCountDisplay');
        const missingEl = document.getElementById('missingCount');
        const diffCountEl = document.getElementById('diffCount');
        
        if (totalEl) totalEl.textContent = stats.total;
        if (matchEl) matchEl.textContent = stats.matches;
        if (diffDisplayEl) diffDisplayEl.textContent = stats.differences;
        if (missingEl) missingEl.textContent = stats.missing;
        if (diffCountEl) diffCountEl.textContent = stats.differences;
    }
    
    updateStatsBar(stats) {
        const container = document.getElementById('statsBarContainer');
        const fill = document.getElementById('statsBarFill');
        const matchPercent = document.getElementById('matchPercent');
        const diffPercent = document.getElementById('diffPercent');
        const missingPercent = document.getElementById('missingPercent');
        
        if (stats.total > 0 && container) {
            container.style.display = 'block';
            const matchPct = (stats.matches / stats.total * 100).toFixed(0);
            const diffPct = (stats.differences / stats.total * 100).toFixed(0);
            const missingPct = (stats.missing / stats.total * 100).toFixed(0);
            
            if (matchPercent) matchPercent.textContent = matchPct;
            if (diffPercent) diffPercent.textContent = diffPct;
            if (missingPercent) missingPercent.textContent = missingPct;
            if (fill) fill.style.width = `${matchPct}%`;
        } else if (container) {
            container.style.display = 'none';
        }
    }
    
    filterResults() {
        let filtered = [...this.comparisonResults];
        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(item => item.status === this.currentFilter);
        }
        
        const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
        if (searchTerm) {
            filtered = filtered.filter(item => {
                return item.name.toLowerCase().includes(searchTerm) ||
                       item.id.includes(searchTerm) ||
                       (item.cmykPrimary && item.cmykPrimary.some(v => v.toString().includes(searchTerm))) ||
                       (item.cmykSecondary && item.cmykSecondary.some(v => v.toString().includes(searchTerm)));
            });
        }
        this.uiRenderer.renderComparisonTable(filtered, this);
    }
    
    saveActionState(colorId, actionTaken, reason = '') {
        const color = this.comparisonResults.find(c => c.id === colorId);
        if (color) {
            const uniqueId = this.getUniqueColorId(color);
            this.actionStateMap.set(uniqueId, {
                actionTaken: actionTaken,
                reason: reason,
                timestamp: new Date().toISOString(),
                colorId: colorId,
                colorName: color.name
            });
            console.log(`✅ Estado guardado: ${uniqueId} -> ${actionTaken}`);
        } else {
            console.warn(`⚠️ No se encontró color con ID: ${colorId}`);
        }
        this.saveFullState();
    }
    
    removeActionState(colorId) {
        const color = this.comparisonResults.find(c => c.id === colorId);
        if (color) {
            const uniqueId = this.getUniqueColorId(color);
            this.actionStateMap.delete(uniqueId);
            console.log(`🗑️ Estado eliminado: ${uniqueId}`);
        }
        this.saveFullState();
    }
    
    showReplaceConfirm(colorId) {
        console.log(`🔍 Buscando color con ID: ${colorId} para reemplazar`);
        const color = this.comparisonResults.find(c => c.id === colorId);
        if (!color) {
            console.error(`❌ No se encontró color con ID: ${colorId}`);
            this.uiRenderer.showToast('Error: No se encontró el color', 'error');
            return;
        }
        console.log(`✅ Color encontrado: ${color.name} (ID: ${color.id})`);
        console.log(`   CMYK Secundario: ${color.cmykSecondary.join(', ')}`);
        this.uiRenderer.showReplaceConfirm(colorId, (reason) => {
            this.replaceColor(color, reason);
        });
    }
    
    showKeepConfirm(colorId) {
        console.log(`🔍 Buscando color con ID: ${colorId} para mantener`);
        const color = this.comparisonResults.find(c => c.id === colorId);
        if (!color) {
            console.error(`❌ No se encontró color con ID: ${colorId}`);
            this.uiRenderer.showToast('Error: No se encontró el color', 'error');
            return;
        }
        console.log(`✅ Color encontrado: ${color.name} (ID: ${color.id})`);
        this.uiRenderer.showKeepConfirm(colorId, (reason) => {
            this.keepColor(color, reason);
        });
    }
    
    showAddConfirm(colorId) {
        const color = this.comparisonResults.find(c => c.id === colorId);
        if (!color) return;
        this.uiRenderer.showAddConfirm(colorId, color.name, (reason) => {
            this.addMissingColor(color, reason);
        });
    }
    
    showUndoDialog(colorId, actionType) {
        this.uiRenderer.showUndoModal(colorId, actionType, (reason) => {
            this.undoAction(colorId, actionType, reason);
        });
    }
    
    replaceColor(item, reason = '') {
        console.log(`🔄 Reemplazando color: ${item.name} (ID: ${item.id})`);
        console.log(`   CMYK a aplicar: ${item.cmykSecondary.join(', ')}`);
        
        const normalizedItemName = this.colorMatcher.normalizeNameForComparison(item.name);
        
        const index = this.primaryData.findIndex(p => {
            const normalizedPName = this.colorMatcher.normalizeNameForComparison(p.name);
            return p.id === item.id || normalizedPName === normalizedItemName;
        });
        
        if (index === -1) {
            console.error(`❌ No se encontró el color en primaryData para reemplazar`);
            this.uiRenderer.showToast(`Error: No se encontró "${item.name}" en la referencia principal`, 'error');
            return;
        }
        
        const originalColor = this.primaryData[index];
        console.log(`✅ Color encontrado en primaryData: ${originalColor.name}`);
        console.log(`   CMYK original: ${originalColor.cmyk.join(', ')}`);
        console.log(`   CMYK nuevo: ${item.cmykSecondary.join(', ')}`);
        
        const previousState = {
            id: originalColor.id,
            name: originalColor.name,
            cmyk: [...originalColor.cmyk],
            lab: [...originalColor.lab]
        };
        
        const actionId = `action_${this.actionCounter++}`;
        this.actionHistory.push({
            id: actionId,
            type: 'replace',
            colorId: item.id,
            colorName: item.name,
            timestamp: new Date().toISOString(),
            previousState: previousState,
            reason: reason
        });
        
        this.primaryData[index] = {
            id: originalColor.id,
            name: originalColor.name,
            cmyk: [...item.cmykSecondary],
            lab: item.labSecondary ? [...item.labSecondary] : (originalColor.lab || [0, 0, 0])
        };
        
        console.log(`✅ Color reemplazado exitosamente`);
        console.log(`   Nuevos valores: ${this.primaryData[index].cmyk.join(', ')}`);
        
        this.saveActionState(item.id, 'replace', reason);
        this.saveFullState();
        this.compareFiles();
        this.saveActionToHistory('replace', item.id, item.name, reason);
        this.uiRenderer.showToast(`🔄 Color "${item.name}" reemplazado correctamente`, 'success');
    }
    
    keepColor(item, reason = '') {
        console.log(`🔵 Manteniendo color: ${item.id} - ${item.name}`);
        
        const actionId = `action_${this.actionCounter++}`;
        this.actionHistory.push({
            id: actionId,
            type: 'keep',
            colorId: item.id,
            colorName: item.name,
            timestamp: new Date().toISOString(),
            previousState: null,
            reason: reason
        });
        
        this.saveActionState(item.id, 'keep', reason);
        
        const resultIndex = this.comparisonResults.findIndex(r => r.id === item.id);
        if (resultIndex !== -1) {
            this.comparisonResults[resultIndex] = {
                ...this.comparisonResults[resultIndex],
                actionTaken: 'keep',
                actionReason: reason,
                actionTimestamp: new Date().toISOString()
            };
        }
        
        this.filterResults();
        this.saveActionToHistory('keep', item.id, item.name, reason);
        this.uiRenderer.showToast(`💾 Valor principal mantenido para "${item.name}"`, 'success');
    }
    
    addMissingColor(item, reason = '') {
        const newColor = {
            id: item.id,
            name: item.name,
            cmyk: [...item.cmykSecondary],
            lab: item.labSecondary ? [...item.labSecondary] : [0, 0, 0]
        };
        const actionId = `action_${this.actionCounter++}`;
        this.actionHistory.push({
            id: actionId,
            type: 'add',
            colorId: item.id,
            colorName: item.name,
            timestamp: new Date().toISOString(),
            previousState: null,
            newColor: {...newColor},
            reason: reason
        });
        this.primaryData.push(newColor);
        
        this.saveActionState(item.id, 'add', reason);
        this.compareFiles();
        this.saveActionToHistory('add', item.id, item.name, reason);
        this.uiRenderer.showToast(`✅ Color "${item.name}" agregado`, 'success');
    }
    
    undoAction(colorId, actionType, reason = '') {
        const action = this.actionHistory.find(a => a.colorId === colorId && a.type === actionType);
        if (!action) {
            this.uiRenderer.showToast('❌ No se pudo deshacer la acción', 'error');
            return;
        }
        
        if (action.type === 'replace' && action.previousState) {
            const index = this.primaryData.findIndex(p => p.id === colorId);
            if (index !== -1) {
                this.primaryData[index] = {
                    id: action.previousState.id,
                    name: action.previousState.name,
                    cmyk: [...action.previousState.cmyk],
                    lab: [...action.previousState.lab]
                };
                console.log(`↩️ Color restaurado a valores anteriores: ${action.previousState.cmyk.join(', ')}`);
            }
        } else if (action.type === 'add') {
            const index = this.primaryData.findIndex(p => p.id === colorId);
            if (index !== -1) this.primaryData.splice(index, 1);
        }
        
        this.removeActionState(colorId);
        
        const resultIndex = this.comparisonResults.findIndex(r => r.id === colorId);
        if (resultIndex !== -1) {
            delete this.comparisonResults[resultIndex].actionTaken;
            delete this.comparisonResults[resultIndex].actionReason;
            delete this.comparisonResults[resultIndex].actionTimestamp;
        }
        
        const actionIndex = this.actionHistory.findIndex(a => a.id === action.id);
        if (actionIndex !== -1) this.actionHistory.splice(actionIndex, 1);
        
        this.saveActionToHistory('undo', colorId, action.colorName, `Se deshizo acción de ${actionType}. Motivo: ${reason}`);
        this.filterResults();
        
        this.uiRenderer.showToast(`↩️ Se deshizo ${actionType === 'keep' ? 'mantener' : actionType === 'replace' ? 'reemplazo' : 'adición'} para "${action.colorName}"`, 'success');
    }
    
    replaceAllColors() {
        const diffColors = this.comparisonResults.filter(item => 
            item.status === 'diff' && !item.actionTaken && !this.actionStateMap.has(this.getUniqueColorId(item))
        );
        
        if (diffColors.length === 0) {
            this.uiRenderer.showToast('⚠️ No hay colores con diferencias para reemplazar', 'warning');
            return;
        }
        
        const confirmMsg = `¿Reemplazar TODOS los ${diffColors.length} colores con diferencias por los valores del archivo secundario?`;
        
        if (confirm(confirmMsg)) {
            this.showLoading(true);
            
            setTimeout(() => {
                try {
                    let replacedCount = 0;
                    
                    for (const color of diffColors) {
                        const normalizedColorName = this.colorMatcher.normalizeNameForComparison(color.name);
                        const index = this.primaryData.findIndex(p => {
                            const normalizedPName = this.colorMatcher.normalizeNameForComparison(p.name);
                            return p.id === color.id || normalizedPName === normalizedColorName;
                        });
                        
                        if (index !== -1) {
                            const previousState = {
                                id: color.id,
                                name: color.name,
                                cmyk: [...this.primaryData[index].cmyk],
                                lab: [...this.primaryData[index].lab]
                            };
                            
                            const actionId = `action_${this.actionCounter++}`;
                            this.actionHistory.push({
                                id: actionId,
                                type: 'replace',
                                colorId: color.id,
                                colorName: color.name,
                                timestamp: new Date().toISOString(),
                                previousState: previousState,
                                reason: 'Reemplazo masivo'
                            });
                            
                            this.primaryData[index] = {
                                id: color.id,
                                name: color.name,
                                cmyk: [...color.cmykSecondary],
                                lab: color.labSecondary ? [...color.labSecondary] : (color.labPrimary || [0, 0, 0])
                            };
                            
                            this.saveActionState(color.id, 'replace', 'Reemplazo masivo');
                            replacedCount++;
                        }
                    }
                    
                    this.saveActionToHistory('replace_all', 'all', `${replacedCount} colores`, `Reemplazo masivo`);
                    this.compareFiles();
                    
                    this.uiRenderer.showToast(`⚡ Se reemplazaron ${replacedCount} colores`, 'success');
                } finally {
                    this.showLoading(false);
                }
            }, 100);
        }
    }
    
    // ============================================================
    // ✅ MÉTODO EXPORTRESULTS CORREGIDO - Exporta TODOS los nombres originales
    // ============================================================
    
    exportResults() {
        if (this.primaryData.length === 0 && this.secondaryData.length === 0) {
            this.uiRenderer.showToast('No hay datos para exportar', 'warning');
            return;
        }
        
        // Crear un mapa para agrupar por nombre canónico
        const groupMap = new Map(); // key: nombreCanonico, value: { cmyk, lab, names: [{id, name}] }
        
        // 1. Agregar todos los colores del archivo PRINCIPAL
        for (const color of this.primaryData) {
            const canonicalName = this.getCanonicalName(color.name);
            
            if (!groupMap.has(canonicalName)) {
                groupMap.set(canonicalName, {
                    cmyk: [...color.cmyk],
                    lab: [...color.lab],
                    names: new Map() // Map para evitar duplicados por ID
                });
            }
            
            const entry = groupMap.get(canonicalName);
            if (!entry.names.has(color.id)) {
                entry.names.set(color.id, color.name);
            }
        }
        
        // 2. Agregar todos los colores del archivo SECUNDARIO
        for (const color of this.secondaryData) {
            const canonicalName = this.getCanonicalName(color.name);
            
            if (!groupMap.has(canonicalName)) {
                groupMap.set(canonicalName, {
                    cmyk: [...color.cmyk],
                    lab: [...color.lab],
                    names: new Map()
                });
            }
            
            const entry = groupMap.get(canonicalName);
            if (!entry.names.has(color.id)) {
                entry.names.set(color.id, color.name);
            }
        }
        
        // 3. Construir lista de colores para exportar (UN REGISTRO POR CADA NOMBRE ORIGINAL)
        const colorsToExport = [];
        
        for (const [canonicalName, data] of groupMap) {
            // Por cada nombre original en este grupo, crear un registro
            for (const [id, name] of data.names) {
                colorsToExport.push({
                    id: id,
                    name: name,
                    cmyk: data.cmyk,
                    lab: data.lab
                });
            }
        }
        
        // 4. Ordenar por ID numérico
        colorsToExport.sort((a, b) => {
            const numA = parseInt(a.id) || 0;
            const numB = parseInt(b.id) || 0;
            return numA - numB;
        });
        
        console.log(`📤 Exportando ${colorsToExport.length} colores (${groupMap.size} grupos unificados)`);
        console.log('Grupos unificados:', Array.from(groupMap.keys()).slice(0, 10));
        
        // Generar contenido del archivo TXT
        let content = 'CGATS.17\n';
        content += 'ORIGINATOR\t"ALPHA COLOR MATCH"\n';
        content += `CREATED\t"${new Date().toLocaleDateString()}"\n`;
        content += 'NUMBER_OF_FIELDS\t9\n';
        content += 'BEGIN_DATA_FORMAT\n';
        content += 'SAMPLE_ID SAMPLE_NAME CMYK_C CMYK_M CMYK_Y CMYK_K LAB_L LAB_A LAB_B\n';
        content += 'END_DATA_FORMAT\n';
        content += `NUMBER_OF_SETS\t${colorsToExport.length}\n`;
        content += 'BEGIN_DATA\n\n';
        
        colorsToExport.forEach(item => {
            content += `${item.id} "${item.name}" `;
            content += `${item.cmyk[0].toFixed(6)} ${item.cmyk[1].toFixed(6)} ${item.cmyk[2].toFixed(6)} ${item.cmyk[3].toFixed(6)} `;
            content += `${item.lab[0].toFixed(6)} ${item.lab[1].toFixed(6)} ${item.lab[2].toFixed(6)}\n`;
        });
        
        content += '\nEND_DATA\n';
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alpha_color_export_${new Date().toISOString().slice(0,19)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.uiRenderer.showToast(`📥 Exportados ${colorsToExport.length} colores (${groupMap.size} grupos unificados)`, 'success');
    }
    
    saveActionToHistory(actionType, colorId, colorName, reason) {
        const history = this.dataManager.getHistory();
        if (history.length > 0) {
            const lastHistory = history[0];
            if (!lastHistory.actionsLog) lastHistory.actionsLog = [];
            lastHistory.actionsLog.push({
                type: actionType,
                colorId: colorId,
                colorName: colorName,
                reason: reason,
                timestamp: new Date().toISOString()
            });
            this.dataManager.saveToHistory(lastHistory);
        }
    }
    
    saveToHistory(stats) {
        const primaryFilename = document.getElementById('primaryFileInfo')?.querySelector('.filename')?.textContent || 'Desconocido';
        const secondaryFilename = document.getElementById('secondaryFileInfo')?.querySelector('.filename')?.textContent || 'Desconocido';
        
        const historyItem = {
            id: Date.now(),
            date: new Date().toISOString(),
            primaryFile: primaryFilename,
            secondaryFile: secondaryFilename,
            stats: { ...stats },
            actionsLog: [],
            results: this.comparisonResults.slice(0, 10)
        };
        this.dataManager.saveToHistory(historyItem);
        this.loadHistory();
    }
    
    loadHistory() {
        const history = this.dataManager.getHistory();
        this.uiRenderer.renderHistory(history);
    }
    
    clearHistory() {
        if (confirm('¿Eliminar todo el historial de comparaciones?')) {
            this.dataManager.clearHistory();
            this.loadHistory();
            this.uiRenderer.showToast('Historial limpiado', 'success');
        }
    }
    
    clearAll() {
        if (confirm('¿Limpiar todos los datos cargados? Esta acción eliminará los datos guardados.')) {
            this.primaryData = [];
            this.secondaryData = [];
            this.comparisonResults = [];
            this.currentFilter = 'all';
            this.actionHistory = [];
            this.actionStateMap.clear();
            this.searchTerm = '';
            
            this.clearFullState();
            
            const primaryInput = document.getElementById('primaryFileInput');
            const secondaryInput = document.getElementById('secondaryFileInput');
            const primaryInfo = document.getElementById('primaryFileInfo');
            const secondaryInfo = document.getElementById('secondaryFileInfo');
            const searchInput = document.getElementById('searchInput');
            const statsContainer = document.getElementById('statsBarContainer');
            
            if (primaryInput) primaryInput.value = '';
            if (secondaryInput) secondaryInput.value = '';
            if (primaryInfo) {
                primaryInfo.querySelector('.filename').textContent = 'Ningún archivo cargado';
                primaryInfo.querySelector('.record-count').textContent = '';
            }
            if (secondaryInfo) {
                secondaryInfo.querySelector('.filename').textContent = 'Ningún archivo cargado';
                secondaryInfo.querySelector('.record-count').textContent = '';
            }
            
            document.getElementById('primaryCount').textContent = '0';
            document.getElementById('secondaryCount').textContent = '0';
            
            if (searchInput) searchInput.value = '';
            if (statsContainer) statsContainer.style.display = 'none';
            
            document.querySelectorAll('.filter-tab').forEach(tab => {
                if (tab.dataset.filter === 'all') tab.classList.add('active');
                else tab.classList.remove('active');
            });
            this.currentFilter = 'all';
            this.filterResults();
            this.uiRenderer.showToast('Todos los datos han sido limpiados', 'info');
        }
    }
    
    downloadCreatorFile() {
        const creatorData = this.uiRenderer.getCreatorData();
        if (creatorData.length === 0) {
            this.uiRenderer.showToast('No hay datos para exportar', 'warning');
            return;
        }
        const content = this.fileHandler.generateTxtFromData(creatorData);
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alpha_color_data_${new Date().toISOString().slice(0,19)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        this.uiRenderer.showToast('✨ Archivo TXT generado', 'success');
    }
    
    switchView(view) {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.view === view) btn.classList.add('active');
        });
        document.querySelectorAll('.view-panel').forEach(panel => panel.classList.remove('active'));
        const targetView = document.getElementById(`${view}View`);
        if (targetView) targetView.classList.add('active');
        if (view === 'history') this.loadHistory();
        else if (view === 'creator') this.uiRenderer.initCreatorTable();
    }
}

const app = new AlphaColorMatch();
