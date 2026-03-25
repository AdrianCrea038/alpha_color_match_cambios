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
        
        const primaryInput = document.getElementById('primaryFileInput');
        const secondaryInput = document.getElementById('secondaryFileInput');
        
        if (primaryInput) {
            primaryInput.addEventListener('change', (e) => this.loadPrimaryFile(e.target.files[0]));
        }
        if (secondaryInput) {
            secondaryInput.addEventListener('change', (e) => this.loadSecondaryFile(e.target.files[0]));
        }
        
        const compareBtn = document.getElementById('compareBtn');
        const replaceAllBtn = document.getElementById('replaceAllBtn');
        const exportResultsBtn = document.getElementById('exportResultsBtn');
        const clearAllBtn = document.getElementById('clearAllBtn');
        const clearHistoryBtn = document.getElementById('clearHistoryBtn');
        const downloadTxtBtn = document.getElementById('downloadTxtBtn');
        const addColorRowBtn = document.getElementById('addColorRowBtn');
        const resetCreatorBtn = document.getElementById('resetCreatorBtn');
        
        if (compareBtn) compareBtn.addEventListener('click', () => this.compareFiles());
        if (replaceAllBtn) replaceAllBtn.addEventListener('click', () => this.replaceAllColors());
        if (exportResultsBtn) exportResultsBtn.addEventListener('click', () => this.exportResults());
        if (clearAllBtn) clearAllBtn.addEventListener('click', () => this.clearAll());
        if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        if (downloadTxtBtn) downloadTxtBtn.addEventListener('click', () => this.downloadCreatorFile());
        if (addColorRowBtn) addColorRowBtn.addEventListener('click', () => this.uiRenderer.addCreatorRow());
        if (resetCreatorBtn) resetCreatorBtn.addEventListener('click', () => this.uiRenderer.resetCreatorTable());
        
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
            const filenameSpan = infoDiv.querySelector('.filename');
            const recordCountSpan = infoDiv.querySelector('.record-count');
            if (filenameSpan) filenameSpan.textContent = filename;
            if (recordCountSpan) recordCountSpan.textContent = `${count} registro${count !== 1 ? 's' : ''}`;
        }
        if (type === 'primary') {
            const primaryCount = document.getElementById('primaryCount');
            if (primaryCount) primaryCount.textContent = count;
        } else {
            const secondaryCount = document.getElementById('secondaryCount');
            if (secondaryCount) secondaryCount.textContent = count;
        }
    }
    
    getUniqueColorId(color) {
        if (!color) return '';
        const normalizedName = this.colorMatcher.normalizeNameForComparison(color.name);
        return `${color.id}_${normalizedName}`;
    }
    
    getCanonicalName(name) {
        let nameWithoutNK = name.replace(/\s+NK\d+$/, '').trim();
        nameWithoutNK = nameWithoutNK.replace(/\s+/g, ' ');
        const normalizedBase = this.colorMatcher.normalizeBaseName(nameWithoutNK);
        return normalizedBase;
    }
    
    // Extraer código NK del nombre
    extractNKCode(fullName) {
        const match = fullName.match(/NK\d+$/);
        return match ? match[0] : null;
    }
    
    // Extraer nombre base sin NK
    extractBaseName(fullName) {
        return fullName.replace(/\s+NK\d+$/, '').trim();
    }
    
    saveFullState() {
        try {
            const searchInput = document.getElementById('searchInput');
            const currentSearchTerm = searchInput ? searchInput.value : this.searchTerm || '';
            
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
            this.saveFullState();
            if (this.secondaryData.length > 0) {
                this.compareFiles();
            } else {
                this.filterResults();
            }
        } catch (error) {
            console.error('Error al cargar archivo principal:', error);
            this.uiRenderer.showToast('❌ Error al cargar el archivo principal', 'error');
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
        } catch (error) {
            console.error('Error al cargar archivo secundario:', error);
            this.uiRenderer.showToast('❌ Error al cargar el archivo secundario', 'error');
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
                // Primero, identificar colores que faltan en cada archivo (por NK)
                const primaryNKs = new Set();
                const secondaryNKs = new Set();
                
                for (const color of this.primaryData) {
                    const nk = this.extractNKCode(color.name);
                    if (nk) primaryNKs.add(nk);
                }
                
                for (const color of this.secondaryData) {
                    const nk = this.extractNKCode(color.name);
                    if (nk) secondaryNKs.add(nk);
                }
                
                // Colores que faltan en secundario (solo en principal)
                const missingInSecondary = [];
                for (const color of this.primaryData) {
                    const nk = this.extractNKCode(color.name);
                    if (nk && !secondaryNKs.has(nk)) {
                        missingInSecondary.push(color.name);
                    }
                }
                
                // Colores que faltan en principal (solo en secundario)
                const missingInPrimary = [];
                for (const color of this.secondaryData) {
                    const nk = this.extractNKCode(color.name);
                    if (nk && !primaryNKs.has(nk)) {
                        missingInPrimary.push(color.name);
                    }
                }
                
                // Mostrar advertencias
                if (missingInSecondary.length > 0) {
                    console.warn(`⚠️ Colores solo en PRINCIPAL (no tienen pareja en secundario): ${missingInSecondary.length}`);
                    missingInSecondary.forEach(name => console.warn(`   - ${name}`));
                    this.uiRenderer.showToast(`⚠️ ${missingInSecondary.length} colores solo en PRINCIPAL (sin pareja en secundario)`, 'warning');
                }
                
                if (missingInPrimary.length > 0) {
                    console.warn(`⚠️ Colores solo en SECUNDARIO (no tienen pareja en principal): ${missingInPrimary.length}`);
                    missingInPrimary.forEach(name => console.warn(`   - ${name}`));
                    this.uiRenderer.showToast(`⚠️ ${missingInPrimary.length} colores solo en SECUNDARIO (sin pareja en principal)`, 'warning');
                }
                
                const rawResults = this.colorMatcher.smartCompare(this.primaryData, this.secondaryData);
                
                // Filtrar resultados: solo mantener los que tienen pareja (mismo NK en ambos)
                const filteredResults = rawResults.filter(result => {
                    // Si es missing, no tiene pareja, lo filtramos
                    if (result.status === 'missing') return false;
                    
                    const nkPrimary = this.extractNKCode(result.primaryName || result.name);
                    const nkSecondary = this.extractNKCode(result.secondaryName || result.name);
                    
                    // Solo mantener si ambos NK existen y son iguales
                    return nkPrimary && nkSecondary && nkPrimary === nkSecondary;
                });
                
                this.comparisonResults = filteredResults.map(result => {
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
                
                this.uiRenderer.showToast(`🔍 Comparación completada: ${stats.differences} diferencias, ${stats.matches} coincidencias`, 'info');
            } catch (error) {
                console.error('Error al comparar archivos:', error);
                this.uiRenderer.showToast('❌ Error al comparar los archivos', 'error');
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
        
        const currentSearchTerm = this.searchTerm || (document.getElementById('searchInput')?.value || '');
        if (currentSearchTerm) {
            const searchLower = currentSearchTerm.toLowerCase();
            filtered = filtered.filter(item => {
                return (item.name && item.name.toLowerCase().includes(searchLower)) ||
                       (item.id && item.id.includes(searchLower)) ||
                       (item.cmykPrimary && item.cmykPrimary.some(v => v.toString().includes(searchLower))) ||
                       (item.cmykSecondary && item.cmykSecondary.some(v => v.toString().includes(searchLower)));
            });
        }
        
        this.uiRenderer.renderComparisonTable(filtered, this);
    }
    
    saveActionState(colorId, actionTaken, reason = '') {
        const color = this.comparisonResults.find(c => c && c.id === colorId);
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
            this.saveFullState();
        } else {
            console.warn(`⚠️ No se encontró color con ID: ${colorId}`);
        }
    }
    
    removeActionState(colorId) {
        const color = this.comparisonResults.find(c => c && c.id === colorId);
        if (color) {
            const uniqueId = this.getUniqueColorId(color);
            this.actionStateMap.delete(uniqueId);
            console.log(`🗑️ Estado eliminado: ${uniqueId}`);
            this.saveFullState();
        }
    }
    
    showReplaceConfirm(colorId) {
        const color = this.comparisonResults.find(c => c && c.id === colorId);
        if (!color) {
            this.uiRenderer.showToast('Error: No se encontró el color', 'error');
            return;
        }
        this.uiRenderer.showReplaceConfirm(colorId, (reason) => {
            this.replaceColor(color, reason);
        });
    }
    
    showKeepConfirm(colorId) {
        const color = this.comparisonResults.find(c => c && c.id === colorId);
        if (!color) {
            this.uiRenderer.showToast('Error: No se encontró el color', 'error');
            return;
        }
        this.uiRenderer.showKeepConfirm(colorId, (reason) => {
            this.keepColor(color, reason);
        });
    }
    
    showAddConfirm(colorId) {
        const color = this.comparisonResults.find(c => c && c.id === colorId);
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
        const normalizedItemName = this.colorMatcher.normalizeNameForComparison(item.name);
        const itemNK = this.extractNKCode(item.name);
        
        const index = this.primaryData.findIndex(p => {
            const normalizedPName = this.colorMatcher.normalizeNameForComparison(p.name);
            const pNK = this.extractNKCode(p.name);
            return (p.id === item.id || normalizedPName === normalizedItemName) && pNK === itemNK;
        });
        
        if (index === -1) {
            this.uiRenderer.showToast(`Error: No se encontró "${item.name}" en la referencia principal`, 'error');
            return;
        }
        
        const originalColor = this.primaryData[index];
        
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
        
        this.saveActionState(item.id, 'replace', reason);
        this.saveFullState();
        this.compareFiles();
        this.saveActionToHistory('replace', item.id, item.name, reason);
        this.uiRenderer.showToast(`🔄 Color "${item.name}" reemplazado correctamente`, 'success');
    }
    
    keepColor(item, reason = '') {
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
        
        const resultIndex = this.comparisonResults.findIndex(r => r && r.id === item.id);
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
            }
        } else if (action.type === 'add') {
            const index = this.primaryData.findIndex(p => p.id === colorId);
            if (index !== -1) this.primaryData.splice(index, 1);
        }
        
        this.removeActionState(colorId);
        
        const resultIndex = this.comparisonResults.findIndex(r => r && r.id === colorId);
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
            item && item.status === 'diff' && !item.actionTaken && !this.actionStateMap.has(this.getUniqueColorId(item))
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
                        const colorNK = this.extractNKCode(color.name);
                        
                        const index = this.primaryData.findIndex(p => {
                            const normalizedPName = this.colorMatcher.normalizeNameForComparison(p.name);
                            const pNK = this.extractNKCode(p.name);
                            return (p.id === color.id || normalizedPName === normalizedColorName) && pNK === colorNK;
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
    
    // ✅ MÉTODO EXPORTAR CORREGIDO
    exportResults() {
        if (this.primaryData.length === 0 && this.secondaryData.length === 0) {
            this.uiRenderer.showToast('No hay datos para exportar', 'warning');
            return;
        }
        
        // Primero, identificar qué NK tienen pareja en ambos archivos
        const primaryByNK = new Map();
        const secondaryByNK = new Map();
        
        for (const color of this.primaryData) {
            const nk = this.extractNKCode(color.name);
            if (nk) {
                if (!primaryByNK.has(nk)) primaryByNK.set(nk, []);
                primaryByNK.get(nk).push(color);
            }
        }
        
        for (const color of this.secondaryData) {
            const nk = this.extractNKCode(color.name);
            if (nk) {
                if (!secondaryByNK.has(nk)) secondaryByNK.set(nk, []);
                secondaryByNK.get(nk).push(color);
            }
        }
        
        // Encontrar NK que existen en AMBOS archivos
        const commonNKs = new Set();
        for (const nk of primaryByNK.keys()) {
            if (secondaryByNK.has(nk)) {
                commonNKs.add(nk);
            }
        }
        
        // Mostrar advertencias de colores que se excluyen
        const excludedPrimary = [];
        const excludedSecondary = [];
        
        for (const color of this.primaryData) {
            const nk = this.extractNKCode(color.name);
            if (nk && !commonNKs.has(nk)) {
                excludedPrimary.push(color.name);
            }
        }
        
        for (const color of this.secondaryData) {
            const nk = this.extractNKCode(color.name);
            if (nk && !commonNKs.has(nk)) {
                excludedSecondary.push(color.name);
            }
        }
        
        if (excludedPrimary.length > 0) {
            console.warn(`🚫 EXCLUIDOS de exportación (solo en PRINCIPAL): ${excludedPrimary.length}`);
            excludedPrimary.forEach(name => console.warn(`   - ${name}`));
            this.uiRenderer.showToast(`🚫 ${excludedPrimary.length} colores solo en PRINCIPAL no se exportarán`, 'warning');
        }
        
        if (excludedSecondary.length > 0) {
            console.warn(`🚫 EXCLUIDOS de exportación (solo en SECUNDARIO): ${excludedSecondary.length}`);
            excludedSecondary.forEach(name => console.warn(`   - ${name}`));
            this.uiRenderer.showToast(`🚫 ${excludedSecondary.length} colores solo en SECUNDARIO no se exportarán`, 'warning');
        }
        
        // Mapa para valores sincronizados por NK + nombre unificado
        const syncedValuesMap = new Map(); // clave = `${nk}_${unifiedName}`
        
        // Determinar valores sincronizados para cada grupo (NK + nombre unificado)
        for (const result of this.comparisonResults) {
            const nk = this.extractNKCode(result.name);
            if (!nk || !commonNKs.has(nk)) continue;
            
            const unifiedKey = result.unifiedName || this.colorMatcher.getUnifiedName(result.name);
            const mapKey = `${nk}_${unifiedKey}`;
            
            // Buscar decisión del usuario
            let decisionCmyk = null;
            let decisionLab = null;
            
            for (const [uniqueId, state] of this.actionStateMap) {
                if (state.colorId === result.id) {
                    if (state.actionTaken === 'replace') {
                        decisionCmyk = [...result.cmykSecondary];
                        decisionLab = [...result.labSecondary];
                    } else if (state.actionTaken === 'keep') {
                        decisionCmyk = [...result.cmykPrimary];
                        decisionLab = [...result.labPrimary];
                    }
                    break;
                }
            }
            
            if (decisionCmyk) {
                syncedValuesMap.set(mapKey, { cmyk: decisionCmyk, lab: decisionLab });
            } else if (result.cmykPrimary) {
                syncedValuesMap.set(mapKey, { cmyk: [...result.cmykPrimary], lab: [...result.labPrimary] });
            } else if (result.cmykSecondary) {
                syncedValuesMap.set(mapKey, { cmyk: [...result.cmykSecondary], lab: [...result.labSecondary] });
            }
        }
        
        // Construir lista de colores a exportar (solo con NK comunes)
        const colorsToExport = [];
        const processedNKNames = new Set(); // Para evitar duplicados dentro del mismo NK y nombre
        
        for (const nk of commonNKs) {
            const primaryColors = primaryByNK.get(nk) || [];
            const secondaryColors = secondaryByNK.get(nk) || [];
            
            // Procesar cada color del principal
            for (const primaryColor of primaryColors) {
                const baseName = this.extractBaseName(primaryColor.name);
                const unifiedName = this.colorMatcher.getUnifiedName(primaryColor.name);
                const mapKey = `${nk}_${unifiedName}`;
                const syncedValues = syncedValuesMap.get(mapKey);
                
                const uniqueKey = `${nk}_${baseName}`;
                if (!processedNKNames.has(uniqueKey)) {
                    colorsToExport.push({
                        name: primaryColor.name,
                        cmyk: syncedValues ? [...syncedValues.cmyk] : [...primaryColor.cmyk],
                        lab: syncedValues ? [...syncedValues.lab] : [...primaryColor.lab]
                    });
                    processedNKNames.add(uniqueKey);
                }
            }
            
            // Procesar colores del secundario que tengan nombres equivalentes diferentes
            for (const secondaryColor of secondaryColors) {
                const baseName = this.extractBaseName(secondaryColor.name);
                const unifiedName = this.colorMatcher.getUnifiedName(secondaryColor.name);
                
                // Verificar si este nombre ya fue agregado desde el principal
                let alreadyAdded = false;
                for (const primaryColor of primaryColors) {
                    const primaryBaseName = this.extractBaseName(primaryColor.name);
                    const primaryUnified = this.colorMatcher.getUnifiedName(primaryColor.name);
                    
                    // Si es el mismo nombre base o son equivalentes
                    if (primaryBaseName === baseName || primaryUnified === unifiedName) {
                        alreadyAdded = true;
                        break;
                    }
                }
                
                // Si no se agregó y tiene el mismo NK, agregarlo
                if (!alreadyAdded) {
                    const uniqueKey = `${nk}_${baseName}`;
                    if (!processedNKNames.has(uniqueKey)) {
                        const mapKey = `${nk}_${unifiedName}`;
                        const syncedValues = syncedValuesMap.get(mapKey);
                        
                        colorsToExport.push({
                            name: secondaryColor.name,
                            cmyk: syncedValues ? [...syncedValues.cmyk] : [...secondaryColor.cmyk],
                            lab: syncedValues ? [...syncedValues.lab] : [...secondaryColor.lab]
                        });
                        processedNKNames.add(uniqueKey);
                    }
                }
            }
        }
        
        // Ordenar por nombre para consistencia
        colorsToExport.sort((a, b) => a.name.localeCompare(b.name));
        
        console.log(`📤 Exportando ${colorsToExport.length} colores (solo con NK comunes en ambos archivos)`);
        
        // Generar contenido del archivo con números correlativos
        let content = 'CGATS.17\n';
        content += 'ORIGINATOR\t"ALPHA COLOR MATCH"\n';
        content += `CREATED\t"${new Date().toLocaleDateString()}"\n`;
        content += 'NUMBER_OF_FIELDS\t9\n';
        content += 'BEGIN_DATA_FORMAT\n';
        content += 'SAMPLE_ID SAMPLE_NAME CMYK_C CMYK_M CMYK_Y CMYK_K LAB_L LAB_A LAB_B\n';
        content += 'END_DATA_FORMAT\n';
        content += `NUMBER_OF_SETS\t${colorsToExport.length}\n`;
        content += 'BEGIN_DATA\n\n';
        
        let counter = 1;
        colorsToExport.forEach(item => {
            content += `${counter} "${item.name}" `;
            content += `${item.cmyk[0].toFixed(6)} ${item.cmyk[1].toFixed(6)} ${item.cmyk[2].toFixed(6)} ${item.cmyk[3].toFixed(6)} `;
            content += `${item.lab[0].toFixed(6)} ${item.lab[1].toFixed(6)} ${item.lab[2].toFixed(6)}\n`;
            counter++;
        });
        
        content += '\nEND_DATA\n';
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alpha_color_export_${new Date().toISOString().slice(0,19)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.uiRenderer.showToast(`📥 Exportados ${colorsToExport.length} colores (solo con NK comunes)`, 'success');
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
        const primaryInfo = document.getElementById('primaryFileInfo');
        const secondaryInfo = document.getElementById('secondaryFileInfo');
        const primaryFilename = primaryInfo?.querySelector('.filename')?.textContent || 'Desconocido';
        const secondaryFilename = secondaryInfo?.querySelector('.filename')?.textContent || 'Desconocido';
        
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
                const filenameSpan = primaryInfo.querySelector('.filename');
                const recordCountSpan = primaryInfo.querySelector('.record-count');
                if (filenameSpan) filenameSpan.textContent = 'Ningún archivo cargado';
                if (recordCountSpan) recordCountSpan.textContent = '';
            }
            if (secondaryInfo) {
                const filenameSpan = secondaryInfo.querySelector('.filename');
                const recordCountSpan = secondaryInfo.querySelector('.record-count');
                if (filenameSpan) filenameSpan.textContent = 'Ningún archivo cargado';
                if (recordCountSpan) recordCountSpan.textContent = '';
            }
            
            const primaryCount = document.getElementById('primaryCount');
            const secondaryCount = document.getElementById('secondaryCount');
            if (primaryCount) primaryCount.textContent = '0';
            if (secondaryCount) secondaryCount.textContent = '0';
            
            if (searchInput) {
                searchInput.value = '';
                this.searchTerm = '';
            }
            if (statsContainer) statsContainer.style.display = 'none';
            
            document.querySelectorAll('.filter-tab').forEach(tab => {
                if (tab.dataset.filter === 'all') tab.classList.add('active');
                else tab.classList.remove('active');
            });
            this.currentFilter = 'all';
            
            const totalCount = document.getElementById('totalCount');
            const matchCount = document.getElementById('matchCount');
            const diffCountDisplay = document.getElementById('diffCountDisplay');
            const missingCount = document.getElementById('missingCount');
            const diffCount = document.getElementById('diffCount');
            
            if (totalCount) totalCount.textContent = '0';
            if (matchCount) matchCount.textContent = '0';
            if (diffCountDisplay) diffCountDisplay.textContent = '0';
            if (missingCount) missingCount.textContent = '0';
            if (diffCount) diffCount.textContent = '0';
            
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
