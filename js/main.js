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
        
        const index = this.primaryData.findIndex(p => {
            const normalizedPName = this.colorMatcher.normalizeNameForComparison(p.name);
            return p.id === item.id || normalizedPName === normalizedItemName;
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
    
    // ✅ MÉTODO EXPORTAR CORREGIDO - Exporta ambos registros solo cuando son equivalentes pero diferentes
exportResults() {
    if (this.primaryData.length === 0 && this.secondaryData.length === 0) {
        this.uiRenderer.showToast('No hay datos para exportar', 'warning');
        return;
    }
    
    // Mapa para almacenar los valores sincronizados por grupo equivalente
    const syncedValuesMap = new Map(); // clave = unifiedName, valor = { cmyk, lab }
    
    // Primero, determinar qué valores sincronizados usar para cada grupo equivalente
    for (const result of this.comparisonResults) {
        if (result.areEquivalent && result.unifiedName) {
            const unifiedKey = result.unifiedName;
            
            // Verificar si el usuario tomó una decisión sobre este color
            let decisionCmyk = null;
            let decisionLab = null;
            
            // Buscar en actionStateMap por el colorId
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
            
            // Si hay decisión del usuario, usar esos valores
            if (decisionCmyk) {
                syncedValuesMap.set(unifiedKey, {
                    cmyk: decisionCmyk,
                    lab: decisionLab
                });
            } 
            // Si no hay decisión, usar los valores del principal por defecto
            else if (result.cmykPrimary) {
                syncedValuesMap.set(unifiedKey, {
                    cmyk: [...result.cmykPrimary],
                    lab: [...result.labPrimary]
                });
            }
            // Si no hay principal, usar los del secundario
            else if (result.cmykSecondary) {
                syncedValuesMap.set(unifiedKey, {
                    cmyk: [...result.cmykSecondary],
                    lab: [...result.labSecondary]
                });
            }
        }
    }
    
    // Colección de todos los colores a exportar
    const allColorsToExport = [];
    const addedKeys = new Set(); // Usar clave compuesta: id + nombre normalizado
    
    // Función para obtener el unifiedName de un color
    const getUnifiedKey = (color) => {
        return this.colorMatcher.getUnifiedName(color.name);
    };
    
    // Función para generar una clave única para evitar duplicados exactos
    const getUniqueExportKey = (color) => {
        // Para colores que son equivalentes, usamos unifiedKey + nombre original
        // Para colores que no son equivalentes, usamos id
        const unifiedKey = getUnifiedKey(color);
        
        // Buscar si este color tiene un equivalente
        let hasEquivalent = false;
        for (const result of this.comparisonResults) {
            if (result.areEquivalent && result.unifiedName === unifiedKey && result.id !== color.id) {
                hasEquivalent = true;
                break;
            }
        }
        
        if (hasEquivalent) {
            // Si tiene equivalentes, usar unifiedKey + nombre original como clave
            // Esto permite que colores equivalentes con diferentes nombres aparezcan ambos
            return `${unifiedKey}_${color.name}`;
        } else {
            // Si no tiene equivalentes, usar solo el ID para evitar duplicados exactos
            return color.id;
        }
    };
    
    // Agregar TODOS los colores del archivo principal (sin duplicados por ID)
    for (const color of this.primaryData) {
        const uniqueKey = color.id; // Por ID para principal
        if (!addedKeys.has(uniqueKey)) {
            const unifiedKey = getUnifiedKey(color);
            const syncedValues = syncedValuesMap.get(unifiedKey);
            
            allColorsToExport.push({
                id: color.id,
                name: color.name,
                cmyk: syncedValues ? [...syncedValues.cmyk] : [...color.cmyk],
                lab: syncedValues ? [...syncedValues.lab] : [...color.lab],
                unifiedKey: unifiedKey
            });
            addedKeys.add(uniqueKey);
        }
    }
    
    // Agregar colores del archivo secundario SOLO si:
    // 1. No tienen el mismo ID que algún color ya agregado
    // 2. O si son equivalentes a algún color del principal (para mostrar ambos nombres)
    for (const color of this.secondaryData) {
        const unifiedKey = getUnifiedKey(color);
        
        // Verificar si este color ya fue agregado por ID
        const alreadyAddedById = addedKeys.has(color.id);
        
        // Verificar si este color es equivalente a algún color del principal
        let isEquivalentToPrimary = false;
        let equivalentPrimaryColor = null;
        
        for (const primaryColor of this.primaryData) {
            if (this.colorMatcher.areEquivalentNames(primaryColor.name, color.name)) {
                isEquivalentToPrimary = true;
                equivalentPrimaryColor = primaryColor;
                break;
            }
        }
        
        // Verificar si ya existe un color con el mismo nombre exacto (para evitar duplicados exactos)
        const sameNameExists = allColorsToExport.some(c => c.name === color.name);
        
        // Decidir si agregar este color
        let shouldAdd = false;
        
        if (!alreadyAddedById) {
            if (isEquivalentToPrimary && equivalentPrimaryColor) {
                // Si es equivalente al principal, agregarlo (para mostrar ambos nombres)
                // Pero solo si no es el mismo nombre exacto
                if (color.name !== equivalentPrimaryColor.name) {
                    shouldAdd = true;
                }
            } else if (!sameNameExists) {
                // Si no es equivalente y no hay mismo nombre, agregarlo
                shouldAdd = true;
            }
        }
        
        if (shouldAdd) {
            const syncedValues = syncedValuesMap.get(unifiedKey);
            
            allColorsToExport.push({
                id: color.id,
                name: color.name,
                cmyk: syncedValues ? [...syncedValues.cmyk] : [...color.cmyk],
                lab: syncedValues ? [...syncedValues.lab] : [...color.lab],
                unifiedKey: unifiedKey,
                isSecondary: true
            });
            addedKeys.add(color.id);
        }
    }
    
    // Ordenar por ID
    allColorsToExport.sort((a, b) => {
        const numA = parseInt(a.id) || 0;
        const numB = parseInt(b.id) || 0;
        return numA - numB;
    });
    
    // Mostrar en consola qué sincronizaciones se hicieron
    console.log(`📤 Exportando ${allColorsToExport.length} colores totales`);
    
    // Mostrar grupos sincronizados
    const syncGroups = new Map();
    for (const color of allColorsToExport) {
        if (!syncGroups.has(color.unifiedKey)) {
            syncGroups.set(color.unifiedKey, []);
        }
        syncGroups.get(color.unifiedKey).push(color.name);
    }
    
    for (const [unifiedKey, names] of syncGroups) {
        if (names.length > 1) {
            console.log(`   🔗 Grupo "${unifiedKey}": ${names.join(', ')} → todos con los mismos valores CMYK`);
        }
    }
    
    // Generar contenido del archivo
    let content = 'CGATS.17\n';
    content += 'ORIGINATOR\t"ALPHA COLOR MATCH"\n';
    content += `CREATED\t"${new Date().toLocaleDateString()}"\n`;
    content += 'NUMBER_OF_FIELDS\t9\n';
    content += 'BEGIN_DATA_FORMAT\n';
    content += 'SAMPLE_ID SAMPLE_NAME CMYK_C CMYK_M CMYK_Y CMYK_K LAB_L LAB_A LAB_B\n';
    content += 'END_DATA_FORMAT\n';
    content += `NUMBER_OF_SETS\t${allColorsToExport.length}\n`;
    content += 'BEGIN_DATA\n\n';
    
    allColorsToExport.forEach(item => {
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
    
    this.uiRenderer.showToast(`📥 Exportados ${allColorsToExport.length} colores (${syncGroups.size} grupos sincronizados)`, 'success');
}
