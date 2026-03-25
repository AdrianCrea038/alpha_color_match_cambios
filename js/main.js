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
        
        this.actionStateMap = new Map();
        
        this.init();
    }
    
    // ============================================================
    // MÉTODOS DE INICIALIZACIÓN
    // ============================================================
    
    init() {
        this.bindEvents();
        this.loadHistory();
        this.uiRenderer.initCreatorTable();
        window.app = this;
        this.loadPersistedData();
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
        
        document.getElementById('searchInput').addEventListener('input', (e) => this.filterResults());
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.currentFilter = tab.dataset.filter;
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.filterResults();
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
    
    // ============================================================
    // MÉTODOS DE PERSISTENCIA LOCAL
    // ============================================================
    
    savePersistedData() {
        try {
            const dataToSave = {
                primaryData: this.primaryData,
                actionStateMap: Array.from(this.actionStateMap.entries()),
                lastUpdated: new Date().toISOString()
            };
            localStorage.setItem('alpha_color_match_data', JSON.stringify(dataToSave));
            console.log('💾 Datos guardados localmente');
        } catch (error) {
            console.error('Error al guardar datos:', error);
        }
    }
    
    loadPersistedData() {
        try {
            const savedData = localStorage.getItem('alpha_color_match_data');
            if (savedData) {
                const data = JSON.parse(savedData);
                
                if (data.primaryData && data.primaryData.length > 0) {
                    this.primaryData = data.primaryData;
                    this.updateFileInfo('primary', 'Datos guardados', this.primaryData.length);
                    this.uiRenderer.showToast(`📂 Datos cargados: ${this.primaryData.length} colores en referencia`, 'info');
                }
                
                if (data.actionStateMap && data.actionStateMap.length > 0) {
                    this.actionStateMap = new Map(data.actionStateMap);
                    console.log(`✅ Estado restaurado: ${this.actionStateMap.size} colores marcados`);
                }
                
                if (this.primaryData.length > 0) {
                    this.uiRenderer.showToast(`💾 Datos recuperados de sesión anterior`, 'success');
                }
            }
        } catch (error) {
            console.error('Error al cargar datos guardados:', error);
        }
    }
    
    clearPersistedData() {
        localStorage.removeItem('alpha_color_match_data');
        console.log('🗑️ Datos locales eliminados');
    }
    
    // ============================================================
    // CARGA DE ARCHIVOS
    // ============================================================
    
    async loadPrimaryFile(file) {
        if (!file) return;
        this.showLoading(true);
        try {
            const data = await this.fileHandler.parseTxtFile(file);
            this.primaryData = data;
            this.updateFileInfo('primary', file.name, data.length);
            this.uiRenderer.showToast(`✅ Archivo principal cargado: ${data.length} colores`, 'success');
            this.actionStateMap.clear();
            this.savePersistedData();
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
            this.actionStateMap.clear();
        } finally {
            this.showLoading(false);
        }
    }
    
    // ============================================================
    // COMPARACIÓN
    // ============================================================
    
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
                    const savedState = this.actionStateMap.get(result.id);
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
                
                this.uiRenderer.showToast(`🔍 Comparación completada: ${stats.differences} diferencias encontradas, ${stats.missing} colores no encontrados`, 'info');
            } finally {
                this.showLoading(false);
            }
        }, 100);
    }
    
    updateStats(stats) {
        document.getElementById('totalCount').textContent = stats.total;
        document.getElementById('matchCount').textContent = stats.matches;
        document.getElementById('diffCountDisplay').textContent = stats.differences;
        document.getElementById('missingCount').textContent = stats.missing;
        document.getElementById('diffCount').textContent = stats.differences;
    }
    
    updateStatsBar(stats) {
        const container = document.getElementById('statsBarContainer');
        const fill = document.getElementById('statsBarFill');
        const matchPercent = document.getElementById('matchPercent');
        const diffPercent = document.getElementById('diffPercent');
        const missingPercent = document.getElementById('missingPercent');
        
        if (stats.total > 0) {
            container.style.display = 'block';
            const matchPct = (stats.matches / stats.total * 100).toFixed(0);
            const diffPct = (stats.differences / stats.total * 100).toFixed(0);
            const missingPct = (stats.missing / stats.total * 100).toFixed(0);
            
            matchPercent.textContent = matchPct;
            diffPercent.textContent = diffPct;
            missingPercent.textContent = missingPct;
            fill.style.width = `${matchPct}%`;
        } else {
            container.style.display = 'none';
        }
    }
    
    filterResults() {
        let filtered = [...this.comparisonResults];
        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(item => item.status === this.currentFilter);
        }
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
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
    
    // ============================================================
    // MÉTODOS DE ACCIONES
    // ============================================================
    
    saveActionState(colorId, actionTaken, reason = '') {
        this.actionStateMap.set(colorId, {
            actionTaken: actionTaken,
            reason: reason,
            timestamp: new Date().toISOString()
        });
        console.log(`✅ Estado guardado: ${colorId} -> ${actionTaken}`);
        this.savePersistedData();
    }
    
    removeActionState(colorId) {
        this.actionStateMap.delete(colorId);
        console.log(`🗑️ Estado eliminado: ${colorId}`);
        this.savePersistedData();
    }
    
    showReplaceConfirm(colorId) {
        const color = this.comparisonResults.find(c => c.id === colorId);
        if (!color) return;
        this.uiRenderer.showReplaceConfirm(colorId, (reason) => {
            this.replaceColor(color, reason);
        });
    }
    
    showKeepConfirm(colorId) {
        const color = this.comparisonResults.find(c => c.id === colorId);
        if (!color) return;
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
        const index = this.primaryData.findIndex(p => 
            p.id === item.id || 
            this.colorMatcher.normalizeName(p.name) === this.colorMatcher.normalizeName(item.name)
        );
        if (index !== -1) {
            const previousState = {
                id: item.id,
                name: item.name,
                cmyk: [...this.primaryData[index].cmyk],
                lab: [...this.primaryData[index].lab]
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
                id: item.id,
                name: item.name,
                cmyk: [...item.cmykSecondary],
                lab: item.labSecondary ? [...item.labSecondary] : (item.labPrimary || [0, 0, 0])
            };
            
            this.saveActionState(item.id, 'replace', reason);
            this.savePersistedData();
            this.compareFiles();
            this.saveActionToHistory('replace', item.id, item.name, reason);
            this.uiRenderer.showToast(`🔄 Color "${item.name}" reemplazado`, 'success');
        }
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
        this.savePersistedData();
        
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
        this.savePersistedData();
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
        this.savePersistedData();
        
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
            item.status === 'diff' && !item.actionTaken && !this.actionStateMap.has(item.id)
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
                        const index = this.primaryData.findIndex(p => 
                            p.id === color.id || 
                            this.colorMatcher.normalizeName(p.name) === this.colorMatcher.normalizeName(color.name)
                        );
                        
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
                    
                    this.savePersistedData();
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
    // HISTORIAL Y EXPORTACIÓN
    // ============================================================
    
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
    
    exportResults() {
        if (this.comparisonResults.length === 0) {
            this.uiRenderer.showToast('No hay resultados para exportar', 'warning');
            return;
        }
        const content = this.fileHandler.generateExportContent(this.comparisonResults);
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alpha_comparison_${new Date().toISOString().slice(0,19)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        this.uiRenderer.showToast('📥 Resultados exportados', 'success');
    }
    
    saveToHistory(stats) {
        const historyItem = {
            id: Date.now(),
            date: new Date().toISOString(),
            primaryFile: document.getElementById('primaryFileInfo').querySelector('.filename').textContent,
            secondaryFile: document.getElementById('secondaryFileInfo').querySelector('.filename').textContent,
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
    
    // ============================================================
    // LIMPIEZA Y UTILIDADES
    // ============================================================
    
    clearAll() {
        if (confirm('¿Limpiar todos los datos cargados? Esta acción eliminará los datos guardados.')) {
            this.primaryData = [];
            this.secondaryData = [];
            this.comparisonResults = [];
            this.currentFilter = 'all';
            this.actionHistory = [];
            this.actionStateMap.clear();
            
            this.clearPersistedData();
            
            document.getElementById('primaryFileInput').value = '';
            document.getElementById('secondaryFileInput').value = '';
            document.getElementById('primaryFileInfo').querySelector('.filename').textContent = 'Ningún archivo cargado';
            document.getElementById('secondaryFileInfo').querySelector('.filename').textContent = 'Ningún archivo cargado';
            document.getElementById('primaryCount').textContent = '0';
            document.getElementById('secondaryCount').textContent = '0';
            document.getElementById('searchInput').value = '';
            document.getElementById('statsBarContainer').style.display = 'none';
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
        document.getElementById(`${view}View`).classList.add('active');
        if (view === 'history') this.loadHistory();
        else if (view === 'creator') this.uiRenderer.initCreatorTable();
    }
}

const app = new AlphaColorMatch();
