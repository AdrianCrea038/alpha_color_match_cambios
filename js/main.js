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
        
        // Datos originales (NO se modifican nunca)
        this.originalPrimaryData = [];
        this.originalSecondaryData = [];
        
        // Datos para comparación y visualización
        this.primaryData = [];
        this.secondaryData = [];
        this.comparisonResults = [];
        this.currentFilter = 'all';
        this.searchTerm = '';
        
        // Mapa de decisiones del usuario - PERSISTENTE
        this.actionStateMap = new Map();
        
        // Datos de colores agregados manualmente (para persistencia)
        this.addedColors = new Map(); // id -> { name, cmyk, lab }
        
        this.missingInPrimary = [];
        this.missingInSecondary = [];
        
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
        if (exportResultsBtn) exportResultsBtn.addEventListener('click', () => this.generateExportPreview());
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
    
    saveFullState() {
        try {
            const searchInput = document.getElementById('searchInput');
            const currentSearchTerm = searchInput ? searchInput.value : this.searchTerm || '';
            
            const fullState = {
                originalPrimaryData: this.originalPrimaryData,
                originalSecondaryData: this.originalSecondaryData,
                actionStateMap: Array.from(this.actionStateMap.entries()),
                addedColors: Array.from(this.addedColors.entries()),
                currentFilter: this.currentFilter,
                searchTerm: currentSearchTerm,
                lastUpdated: new Date().toISOString(),
                version: '3.0'
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
                
                if (state.originalPrimaryData && state.originalPrimaryData.length > 0) {
                    this.originalPrimaryData = state.originalPrimaryData;
                    this.primaryData = JSON.parse(JSON.stringify(state.originalPrimaryData));
                    this.updateFileInfo('primary', 'Datos guardados', this.primaryData.length);
                    hasData = true;
                }
                
                if (state.originalSecondaryData && state.originalSecondaryData.length > 0) {
                    this.originalSecondaryData = state.originalSecondaryData;
                    this.secondaryData = JSON.parse(JSON.stringify(state.originalSecondaryData));
                    this.updateFileInfo('secondary', 'Datos guardados', this.secondaryData.length);
                    hasData = true;
                }
                
                if (state.actionStateMap && state.actionStateMap.length > 0) {
                    this.actionStateMap = new Map(state.actionStateMap);
                    console.log(`✅ Decisiones restauradas: ${this.actionStateMap.size}`);
                    hasData = true;
                }
                
                if (state.addedColors && state.addedColors.length > 0) {
                    this.addedColors = new Map(state.addedColors);
                    console.log(`✅ Colores agregados restaurados: ${this.addedColors.size}`);
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
                
                if (this.originalPrimaryData.length > 0 && this.originalSecondaryData.length > 0) {
                    console.log('🔄 Regenerando comparación con datos guardados...');
                    this.updateMissingColors();
                    this.performComparison();
                } else if (hasData) {
                    this.updateMissingColors();
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
            this.originalPrimaryData = data;
            this.primaryData = JSON.parse(JSON.stringify(data));
            this.updateFileInfo('primary', file.name, data.length);
            this.uiRenderer.showToast(`✅ Archivo principal cargado: ${data.length} colores`, 'success');
            this.saveFullState();
            this.updateMissingColors();
            if (this.secondaryData.length > 0) {
                this.performComparison();
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
            this.originalSecondaryData = data;
            this.secondaryData = JSON.parse(JSON.stringify(data));
            this.updateFileInfo('secondary', file.name, data.length);
            this.uiRenderer.showToast(`✅ Archivo secundario cargado: ${data.length} colores`, 'success');
            this.saveFullState();
            this.updateMissingColors();
            if (this.primaryData.length > 0) {
                this.performComparison();
            }
        } catch (error) {
            console.error('Error al cargar archivo secundario:', error);
            this.uiRenderer.showToast('❌ Error al cargar el archivo secundario', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    updateMissingColors() {
        this.missingInPrimary = [];
        this.missingInSecondary = [];
        
        if (this.originalPrimaryData.length === 0 || this.originalSecondaryData.length === 0) {
            return;
        }
        
        const primaryByKey = new Map();
        const secondaryByKey = new Map();
        
        for (const color of this.originalPrimaryData) {
            const key = this.colorMatcher.getComparisonKey(color);
            primaryByKey.set(key, color);
        }
        
        for (const color of this.originalSecondaryData) {
            const key = this.colorMatcher.getComparisonKey(color);
            secondaryByKey.set(key, color);
        }
        
        for (const color of this.originalPrimaryData) {
            const key = this.colorMatcher.getComparisonKey(color);
            if (!secondaryByKey.has(key)) {
                this.missingInSecondary.push({
                    id: color.id,
                    name: color.name,
                    cmyk: [...color.cmyk],
                    lab: [...color.lab],
                    nkCode: color.nkCode,
                    reason: 'No existe en secundario'
                });
            }
        }
        
        for (const color of this.originalSecondaryData) {
            const key = this.colorMatcher.getComparisonKey(color);
            if (!primaryByKey.has(key)) {
                this.missingInPrimary.push({
                    id: color.id,
                    name: color.name,
                    cmyk: [...color.cmyk],
                    lab: [...color.lab],
                    nkCode: color.nkCode,
                    reason: 'No existe en principal'
                });
            }
        }
        
        if (this.missingInSecondary.length > 0) {
            console.warn(`⚠️ Faltan en secundario: ${this.missingInSecondary.length} colores`);
        }
        
        if (this.missingInPrimary.length > 0) {
            console.warn(`⚠️ Faltan en principal: ${this.missingInPrimary.length} colores`);
        }
    }
    
    buildComparisonResults() {
        const results = [];
        
        const primaryByKey = new Map();
        const secondaryByKey = new Map();
        
        for (const color of this.originalPrimaryData) {
            const key = this.colorMatcher.getComparisonKey(color);
            if (!primaryByKey.has(key)) primaryByKey.set(key, []);
            primaryByKey.get(key).push(color);
        }
        
        for (const color of this.originalSecondaryData) {
            const key = this.colorMatcher.getComparisonKey(color);
            if (!secondaryByKey.has(key)) secondaryByKey.set(key, []);
            secondaryByKey.get(key).push(color);
        }
        
        const allKeys = new Set([...primaryByKey.keys(), ...secondaryByKey.keys()]);
        
        for (const key of allKeys) {
            const primaryColors = primaryByKey.get(key) || [];
            const secondaryColors = secondaryByKey.get(key) || [];
            
            if (primaryColors.length > 0 && secondaryColors.length > 0) {
                for (const primaryColor of primaryColors) {
                    for (const secondaryColor of secondaryColors) {
                        const comparison = this.colorMatcher.compareColors(primaryColor, secondaryColor);
                        const areEquivalent = this.colorMatcher.areEquivalentNames(primaryColor.name, secondaryColor.name);
                        
                        results.push({
                            id: primaryColor.id,
                            secondaryId: secondaryColor.id,
                            name: primaryColor.name,
                            primaryName: primaryColor.name,
                            secondaryName: secondaryColor.name,
                            unifiedName: this.colorMatcher.getUnifiedName(primaryColor.name),
                            cmykPrimary: [...primaryColor.cmyk],
                            cmykSecondary: [...secondaryColor.cmyk],
                            labPrimary: [...primaryColor.lab],
                            labSecondary: [...secondaryColor.lab],
                            nkCode: primaryColor.nkCode,
                            status: comparison.hasDifferences ? 'diff' : 'match',
                            matchFound: true,
                            areEquivalent: areEquivalent,
                            diffPercentage: comparison.diffPercentage,
                            diffDetails: comparison.diffDetails,
                            recommendation: comparison.recommendation
                        });
                        
                        if (areEquivalent && this.colorMatcher.normalizeForComparison(primaryColor.name) !== 
                            this.colorMatcher.normalizeForComparison(secondaryColor.name)) {
                            results.push({
                                id: secondaryColor.id,
                                secondaryId: primaryColor.id,
                                name: secondaryColor.name,
                                primaryName: primaryColor.name,
                                secondaryName: secondaryColor.name,
                                unifiedName: this.colorMatcher.getUnifiedName(secondaryColor.name),
                                cmykPrimary: [...primaryColor.cmyk],
                                cmykSecondary: [...secondaryColor.cmyk],
                                labPrimary: [...primaryColor.lab],
                                labSecondary: [...secondaryColor.lab],
                                nkCode: secondaryColor.nkCode,
                                status: comparison.hasDifferences ? 'diff' : 'match',
                                matchFound: true,
                                areEquivalent: areEquivalent,
                                diffPercentage: comparison.diffPercentage,
                                diffDetails: comparison.diffDetails,
                                recommendation: comparison.recommendation
                            });
                        }
                    }
                }
            } else if (primaryColors.length > 0 && secondaryColors.length === 0) {
                for (const color of primaryColors) {
                    results.push({
                        id: color.id,
                        name: color.name,
                        primaryName: color.name,
                        cmykPrimary: [...color.cmyk],
                        labPrimary: [...color.lab],
                        cmykSecondary: null,
                        labSecondary: null,
                        nkCode: color.nkCode,
                        status: 'missing',
                        matchFound: false,
                        source: 'only_primary',
                        message: `❌ No se encontró en el archivo secundario`,
                        recommendation: 'Elegir: Mantener o Eliminar'
                    });
                }
            } else if (primaryColors.length === 0 && secondaryColors.length > 0) {
                for (const color of secondaryColors) {
                    results.push({
                        id: color.id,
                        name: color.name,
                        secondaryName: color.name,
                        cmykPrimary: null,
                        labPrimary: null,
                        cmykSecondary: [...color.cmyk],
                        labSecondary: [...color.lab],
                        nkCode: color.nkCode,
                        status: 'missing',
                        matchFound: false,
                        source: 'only_secondary',
                        message: `❌ No se encontró en el archivo principal`,
                        recommendation: 'Elegir: Agregar o Ignorar'
                    });
                }
            }
        }
        
        // Agregar colores agregados manualmente (addedColors)
        for (const [id, addedColor] of this.addedColors) {
            // Verificar si ya existe en resultados
            const exists = results.some(r => r.id === id);
            if (!exists) {
                results.push({
                    id: id,
                    name: addedColor.name,
                    primaryName: addedColor.name,
                    cmykPrimary: [...addedColor.cmyk],
                    labPrimary: [...addedColor.lab],
                    cmykSecondary: null,
                    labSecondary: null,
                    nkCode: addedColor.nkCode || null,
                    status: 'match',
                    matchFound: true,
                    source: 'added',
                    isAdded: true,
                    actionTaken: 'add',
                    message: `➕ Color agregado manualmente`
                });
            }
        }
        
        results.sort((a, b) => {
            const numA = parseInt(a.id) || 0;
            const numB = parseInt(b.id) || 0;
            return numA - numB;
        });
        
        console.log(`📊 Total resultados: ${results.length}`);
        
        return results;
    }
    
    performComparison() {
        try {
            this.comparisonResults = this.buildComparisonResults();
            
            this.comparisonResults = this.comparisonResults.map(result => {
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
            
            this.updateStatsDisplay();
            this.filterResults();
            this.saveFullState();
            
            const totalMissing = this.missingInPrimary.length + this.missingInSecondary.length;
            const matches = this.comparisonResults.filter(r => r.status === 'match').length;
            const diffs = this.comparisonResults.filter(r => r.status === 'diff').length;
            
            this.uiRenderer.showToast(`🔍 Comparación: ${matches} coincidencias, ${diffs} diferencias, ${totalMissing} no encontrados`, 'info');
            
            if (totalMissing > 0) {
                this.showMissingColorsSummaryModal();
            }
        } catch (error) {
            console.error('Error al realizar comparación:', error);
            this.uiRenderer.showToast('❌ Error al comparar los archivos', 'error');
        }
    }
    
    showMissingColorsSummaryModal() {
        const totalMissing = this.missingInPrimary.length + this.missingInSecondary.length;
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 650px;">
                <div class="modal-header" style="background: #991b1b; border-bottom: none;">
                    <h3 style="color: white;">⚠️ Resumen de colores faltantes (${totalMissing})</h3>
                    <button class="modal-close" style="color: white;">&times;</button>
                </div>
                <div class="modal-body">
                    ${this.missingInSecondary.length > 0 ? `
                        <div style="margin-bottom: 1.5rem;">
                            <h4 style="color: #f87171; margin-bottom: 0.5rem;">❌ Faltan en SECUNDARIO (${this.missingInSecondary.length})</h4>
                            <div style="background: #1e1e2c; border-radius: 0.5rem; padding: 0.5rem; max-height: 200px; overflow-y: auto;">
                                ${this.missingInSecondary.map(m => `
                                    <div style="padding: 0.5rem; border-bottom: 1px solid #2d3748; font-family: monospace;">
                                        <strong>${m.id}</strong> - ${m.name} (NK: ${m.nkCode || 'N/A'})
                                    </div>
                                `).join('')}
                            </div>
                            <p style="margin-top: 0.5rem; font-size: 0.8rem; color: #fbbf24;">➡️ Puede: Mantener o Eliminar</p>
                        </div>
                    ` : ''}
                    
                    ${this.missingInPrimary.length > 0 ? `
                        <div>
                            <h4 style="color: #f87171; margin-bottom: 0.5rem;">❌ Faltan en PRINCIPAL (${this.missingInPrimary.length})</h4>
                            <div style="background: #1e1e2c; border-radius: 0.5rem; padding: 0.5rem; max-height: 200px; overflow-y: auto;">
                                ${this.missingInPrimary.map(m => `
                                    <div style="padding: 0.5rem; border-bottom: 1px solid #2d3748; font-family: monospace;">
                                        <strong>${m.id}</strong> - ${m.name} (NK: ${m.nkCode || 'N/A'})
                                    </div>
                                `).join('')}
                            </div>
                            <p style="margin-top: 0.5rem; font-size: 0.8rem; color: #fbbf24;">➡️ Puede: Agregar o Ignorar</p>
                        </div>
                    ` : ''}
                    
                    <p style="margin-top: 1rem; color: #fbbf24; background: rgba(251, 191, 36, 0.1); padding: 0.75rem; border-radius: 0.5rem;">
                        ⚠️ Use los botones en la tabla para decidir qué hacer con cada color faltante.
                    </p>
                </div>
                <div class="modal-buttons" style="padding: 1rem; border-top: 1px solid #2d3748;">
                    <button class="btn btn-primary close-modal" style="background: #2d4ed6;">Entendido</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.close-modal').onclick = closeModal;
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };
    }
    
    updateStatsDisplay() {
        const totalMissing = this.missingInPrimary.length + this.missingInSecondary.length;
        const matches = this.comparisonResults.filter(r => r.status === 'match').length;
        const diffs = this.comparisonResults.filter(r => r.status === 'diff').length;
        const total = this.comparisonResults.length;
        
        const totalEl = document.getElementById('totalCount');
        const matchEl = document.getElementById('matchCount');
        const diffDisplayEl = document.getElementById('diffCountDisplay');
        const missingEl = document.getElementById('missingCount');
        const diffCountEl = document.getElementById('diffCount');
        
        if (totalEl) totalEl.textContent = total;
        if (matchEl) matchEl.textContent = matches;
        if (diffDisplayEl) diffDisplayEl.textContent = diffs;
        if (missingEl) missingEl.textContent = totalMissing;
        if (diffCountEl) diffCountEl.textContent = diffs;
        
        const container = document.getElementById('statsBarContainer');
        const fill = document.getElementById('statsBarFill');
        const matchPercent = document.getElementById('matchPercent');
        const diffPercent = document.getElementById('diffPercent');
        const missingPercent = document.getElementById('missingPercent');
        
        const totalCompared = matches + diffs;
        if (totalCompared > 0 && container) {
            container.style.display = 'block';
            const matchPct = (matches / totalCompared * 100).toFixed(0);
            const diffPct = (diffs / totalCompared * 100).toFixed(0);
            const missingPct = (totalMissing / (totalCompared + totalMissing) * 100).toFixed(0);
            
            if (matchPercent) matchPercent.textContent = matchPct;
            if (diffPercent) diffPercent.textContent = diffPct;
            if (missingPercent) missingPercent.textContent = missingPct;
            if (fill) fill.style.width = `${matchPct}%`;
        } else if (container) {
            container.style.display = 'none';
        }
    }
    
    compareFiles() {
        if (this.originalPrimaryData.length === 0) {
            this.uiRenderer.showToast('⚠️ Por favor, cargue el archivo principal primero', 'warning');
            return;
        }
        if (this.originalSecondaryData.length === 0) {
            this.uiRenderer.showToast('⚠️ Por favor, cargue el archivo secundario para comparar', 'warning');
            return;
        }
        
        this.showLoading(true);
        setTimeout(() => {
            this.updateMissingColors();
            this.performComparison();
            this.showLoading(false);
        }, 100);
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
                       (item.cmykSecondary && item.cmykSecondary && item.cmykSecondary.some(v => v.toString().includes(searchLower)));
            });
        }
        
        this.uiRenderer.renderComparisonTable(filtered, this);
    }
    
    saveActionState(colorId, actionTaken, reason = '', source = null, cmyk = null, lab = null) {
        this.actionStateMap.set(colorId, {
            actionTaken: actionTaken,
            reason: reason,
            timestamp: new Date().toISOString(),
            colorId: colorId,
            source: source,
            cmyk: cmyk,
            lab: lab
        });
        console.log(`✅ Estado guardado: ${colorId} -> ${actionTaken}`);
        
        // Si es acción 'add', guardar también en addedColors
        if (actionTaken === 'add' && cmyk && lab) {
            // Buscar el color original
            let colorName = '';
            for (const color of this.originalSecondaryData) {
                if (color.id === colorId) {
                    colorName = color.name;
                    break;
                }
            }
            this.addedColors.set(colorId, {
                id: colorId,
                name: colorName,
                cmyk: cmyk,
                lab: lab,
                nkCode: null
            });
        }
        
        // Si es acción 'keep_missing', también guardar en addedColors (para persistencia)
        if (actionTaken === 'keep_missing') {
            for (const color of this.originalPrimaryData) {
                if (color.id === colorId) {
                    this.addedColors.set(colorId, {
                        id: colorId,
                        name: color.name,
                        cmyk: color.cmyk,
                        lab: color.lab,
                        nkCode: color.nkCode
                    });
                    break;
                }
            }
        }
        
        // Si es acción 'delete_missing' o 'ignore_missing', eliminar de addedColors
        if (actionTaken === 'delete_missing' || actionTaken === 'ignore_missing') {
            this.addedColors.delete(colorId);
        }
        
        this.saveFullState();
        this.performComparison();
    }
    
    removeActionState(colorId) {
        this.actionStateMap.delete(colorId);
        console.log(`🗑️ Estado eliminado: ${colorId}`);
        this.saveFullState();
        this.performComparison();
    }
    
    showReplaceConfirm(colorId) {
        const color = this.comparisonResults.find(c => c && c.id === colorId);
        if (!color || color.status === 'missing') {
            this.uiRenderer.showToast('No se puede reemplazar un color que no existe en el archivo principal', 'warning');
            return;
        }
        this.uiRenderer.showReplaceConfirm(colorId, (reason) => {
            this.replaceColor(color, reason);
        });
    }
    
    showKeepConfirm(colorId) {
        const color = this.comparisonResults.find(c => c && c.id === colorId);
        if (!color || color.status === 'missing') {
            this.uiRenderer.showToast('No se puede mantener un color que no existe en el archivo principal', 'warning');
            return;
        }
        this.uiRenderer.showKeepConfirm(colorId, (reason) => {
            this.keepColor(color, reason);
        });
    }
    
    replaceColor(item, reason = '') {
        this.saveActionState(item.id, 'replace', reason, 'both', [...item.cmykSecondary], [...item.labSecondary]);
        this.saveActionToHistory('replace', item.id, item.name, reason);
        this.uiRenderer.showToast(`🔄 Color "${item.name}" reemplazado correctamente`, 'success');
    }
    
    keepColor(item, reason = '') {
        this.saveActionState(item.id, 'keep', reason, 'both', [...item.cmykPrimary], [...item.labPrimary]);
        this.saveActionToHistory('keep', item.id, item.name, reason);
        this.uiRenderer.showToast(`💾 Valor principal mantenido para "${item.name}"`, 'success');
    }
    
    showKeepMissingConfirm(colorId) {
        const color = this.comparisonResults.find(c => c && c.id === colorId);
        if (!color) return;
        this.uiRenderer.showKeepMissingConfirm(colorId, color.name, (reason) => {
            this.keepMissingColor(color, reason);
        });
    }
    
    showDeleteMissingConfirm(colorId) {
        const color = this.comparisonResults.find(c => c && c.id === colorId);
        if (!color) return;
        this.uiRenderer.showDeleteMissingConfirm(colorId, color.name, (reason) => {
            this.deleteMissingColor(color, reason);
        });
    }
    
    keepMissingColor(item, reason = '') {
        this.saveActionState(item.id, 'keep_missing', reason, 'only_primary');
        this.saveActionToHistory('keep_missing', item.id, item.name, reason);
        this.uiRenderer.showToast(`💾 Color "${item.name}" mantenido en principal`, 'success');
    }
    
    deleteMissingColor(item, reason = '') {
        this.saveActionState(item.id, 'delete_missing', reason, 'only_primary');
        this.saveActionToHistory('delete_missing', item.id, item.name, reason);
        this.uiRenderer.showToast(`🗑️ Color "${item.name}" eliminado de principal`, 'success');
        this.performComparison();
    }
    
    showAddConfirm(colorId) {
        const color = this.comparisonResults.find(c => c && c.id === colorId);
        if (!color) return;
        this.uiRenderer.showAddConfirm(colorId, color.name, (reason) => {
            this.addMissingColor(color, reason);
        });
    }
    
    showIgnoreConfirm(colorId) {
        const color = this.comparisonResults.find(c => c && c.id === colorId);
        if (!color) return;
        this.uiRenderer.showIgnoreConfirm(colorId, color.name, (reason) => {
            this.ignoreMissingColor(color, reason);
        });
    }
    
    addMissingColor(item, reason = '') {
        this.saveActionState(item.id, 'add', reason, 'only_secondary', [...item.cmykSecondary], [...item.labSecondary]);
        this.saveActionToHistory('add', item.id, item.name, reason);
        this.uiRenderer.showToast(`✅ Color "${item.name}" agregado a principal`, 'success');
        this.performComparison();
    }
    
    ignoreMissingColor(item, reason = '') {
        this.saveActionState(item.id, 'ignore_missing', reason, 'only_secondary');
        this.saveActionToHistory('ignore_missing', item.id, item.name, reason);
        this.uiRenderer.showToast(`⏭️ Color "${item.name}" ignorado`, 'success');
    }
    
    showUndoDialog(colorId, actionType) {
        this.uiRenderer.showUndoModal(colorId, actionType, (reason) => {
            this.undoAction(colorId, actionType, reason);
        });
    }
    
    undoAction(colorId, actionType, reason = '') {
        this.removeActionState(colorId);
        this.saveActionToHistory('undo', colorId, '', `Se deshizo acción de ${actionType}. Motivo: ${reason}`);
        this.uiRenderer.showToast(`↩️ Se deshizo acción para el color ${colorId}`, 'success');
    }
    
    replaceAllColors() {
        const diffColors = this.comparisonResults.filter(item => 
            item && item.status === 'diff' && !this.actionStateMap.has(item.id)
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
                        this.saveActionState(color.id, 'replace', 'Reemplazo masivo', 'both', [...color.cmykSecondary], [...color.labSecondary]);
                        this.saveActionToHistory('replace', color.id, color.name, 'Reemplazo masivo');
                        replacedCount++;
                    }
                    
                    this.saveActionToHistory('replace_all', 'all', `${replacedCount} colores`, `Reemplazo masivo`);
                    this.performComparison();
                    
                    this.uiRenderer.showToast(`⚡ Se reemplazaron ${replacedCount} colores`, 'success');
                } finally {
                    this.showLoading(false);
                }
            }, 100);
        }
    }
    
    // NUEVO MÉTODO: Generar preview antes de exportar
    generateExportPreview() {
        if (this.originalPrimaryData.length === 0 && this.originalSecondaryData.length === 0 && this.addedColors.size === 0) {
            this.uiRenderer.showToast('No hay datos para exportar', 'warning');
            return;
        }
        
        const exportData = this.buildExportData();
        
        if (exportData.length === 0) {
            this.uiRenderer.showToast('No hay datos para exportar después de aplicar las decisiones', 'warning');
            return;
        }
        
        // Crear modal con preview
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px; max-height: 85vh;">
                <div class="modal-header" style="background: #2d4ed6;">
                    <h3 style="color: white;">📄 Vista previa de exportación</h3>
                    <button class="modal-close" style="color: white;">&times;</button>
                </div>
                <div class="modal-body" style="overflow: auto; max-height: 60vh;">
                    <div style="margin-bottom: 1rem; padding: 0.75rem; background: #1e1e2c; border-radius: 0.5rem;">
                        <strong>📊 Resumen:</strong> ${exportData.length} colores a exportar
                        <br><small>✅ Coincidencias: ${exportData.filter(c => c.source === 'primary' || c.source === 'secondary_equivalent').length} | 
                        ➕ Agregados: ${exportData.filter(c => c.source === 'added').length}</small>
                    </div>
                    <div style="font-family: monospace; font-size: 0.7rem; background: #0a0a0a; padding: 1rem; border-radius: 0.5rem; overflow-x: auto;">
                        <pre style="margin: 0; color: #e2e8f0;">${this.formatPreviewContent(exportData)}</pre>
                    </div>
                </div>
                <div class="modal-buttons" style="padding: 1rem; border-top: 1px solid #2d3748; display: flex; gap: 1rem; justify-content: flex-end;">
                    <button class="btn btn-secondary cancel-preview">Cancelar</button>
                    <button class="btn btn-primary confirm-export">✅ Confirmar y Exportar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.cancel-preview').onclick = closeModal;
        
        modal.querySelector('.confirm-export').onclick = () => {
            this.doExport(exportData);
            closeModal();
        };
        
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };
    }
    
    formatPreviewContent(exportData) {
        let content = 'CGATS.17\n';
        content += 'ORIGINATOR\t"ALPHA COLOR MATCH"\n';
        content += `CREATED\t"${new Date().toLocaleDateString()}"\n`;
        content += 'NUMBER_OF_FIELDS\t9\n';
        content += 'BEGIN_DATA_FORMAT\n';
        content += 'SAMPLE_ID SAMPLE_NAME CMYK_C CMYK_M CMYK_Y CMYK_K LAB_L LAB_A LAB_B\n';
        content += 'END_DATA_FORMAT\n';
        content += `NUMBER_OF_SETS\t${exportData.length}\n`;
        content += 'BEGIN_DATA\n\n';
        
        exportData.forEach((item, idx) => {
            content += `${idx + 1} "${item.name}" `;
            content += `${item.cmyk[0].toFixed(6)} ${item.cmyk[1].toFixed(6)} ${item.cmyk[2].toFixed(6)} ${item.cmyk[3].toFixed(6)} `;
            content += `${item.lab[0].toFixed(6)} ${item.lab[1].toFixed(6)} ${item.lab[2].toFixed(6)}\n`;
        });
        
        content += '\nEND_DATA\n';
        return content;
    }
    
    buildExportData() {
        const colorsToExport = [];
        const processedIds = new Set();
        const processedKeys = new Set();
        
        // Agrupar por clave de comparación
        const primaryByKey = new Map();
        const secondaryByKey = new Map();
        
        for (const color of this.originalPrimaryData) {
            const key = this.colorMatcher.getComparisonKey(color);
            if (!primaryByKey.has(key)) primaryByKey.set(key, []);
            primaryByKey.get(key).push(color);
        }
        
        for (const color of this.originalSecondaryData) {
            const key = this.colorMatcher.getComparisonKey(color);
            if (!secondaryByKey.has(key)) secondaryByKey.set(key, []);
            secondaryByKey.get(key).push(color);
        }
        
        const allKeys = new Set([...primaryByKey.keys(), ...secondaryByKey.keys()]);
        
        for (const key of allKeys) {
            if (processedKeys.has(key)) continue;
            
            const primaryColors = primaryByKey.get(key) || [];
            const secondaryColors = secondaryByKey.get(key) || [];
            
            // Determinar si hay equivalencia de nombres
            const hasEquivalentNames = primaryColors.some(p => 
                secondaryColors.some(s => this.colorMatcher.areEquivalentNames(p.name, s.name))
            );
            
            // Buscar valores efectivos según decisiones
            let effectiveValues = null;
            
            // Buscar decisión en colores primarios
            for (const primaryColor of primaryColors) {
                const decision = this.actionStateMap.get(primaryColor.id);
                if (decision && (decision.actionTaken === 'keep' || decision.actionTaken === 'replace')) {
                    if (decision.actionTaken === 'keep') {
                        effectiveValues = { cmyk: [...primaryColor.cmyk], lab: [...primaryColor.lab] };
                    } else if (decision.actionTaken === 'replace' && secondaryColors.length > 0) {
                        effectiveValues = { cmyk: [...secondaryColors[0].cmyk], lab: [...secondaryColors[0].lab] };
                    }
                    break;
                }
            }
            
            // Si no hay decisión, usar valores del principal por defecto
            if (!effectiveValues && primaryColors.length > 0) {
                effectiveValues = { cmyk: [...primaryColors[0].cmyk], lab: [...primaryColors[0].lab] };
            }
            
            // Si no hay principal pero hay secundario con decisión 'add'
            if (!effectiveValues && primaryColors.length === 0 && secondaryColors.length > 0) {
                for (const secondaryColor of secondaryColors) {
                    const decision = this.actionStateMap.get(secondaryColor.id);
                    if (decision && decision.actionTaken === 'add') {
                        effectiveValues = { cmyk: [...secondaryColor.cmyk], lab: [...secondaryColor.lab] };
                        break;
                    }
                }
            }
            
            if (!effectiveValues) continue;
            
            // Exportar colores principales
            for (const primaryColor of primaryColors) {
                const decision = this.actionStateMap.get(primaryColor.id);
                if (decision && decision.actionTaken === 'delete_missing') continue;
                if (processedIds.has(primaryColor.id)) continue;
                
                colorsToExport.push({
                    id: primaryColor.id,
                    name: primaryColor.name.toUpperCase(),
                    cmyk: [...effectiveValues.cmyk],
                    lab: [...effectiveValues.lab],
                    source: 'primary'
                });
                processedIds.add(primaryColor.id);
            }
            
            // Exportar colores secundarios equivalentes
            if (hasEquivalentNames) {
                for (const secondaryColor of secondaryColors) {
                    const decision = this.actionStateMap.get(secondaryColor.id);
                    if (decision && decision.actionTaken === 'ignore_missing') continue;
                    if (processedIds.has(secondaryColor.id)) continue;
                    
                    const isExactDuplicate = primaryColors.some(p => 
                        p.name.toUpperCase() === secondaryColor.name.toUpperCase()
                    );
                    
                    if (!isExactDuplicate) {
                        colorsToExport.push({
                            id: secondaryColor.id,
                            name: secondaryColor.name.toUpperCase(),
                            cmyk: [...effectiveValues.cmyk],
                            lab: [...effectiveValues.lab],
                            source: 'secondary_equivalent'
                        });
                        processedIds.add(secondaryColor.id);
                    }
                }
            } else if (primaryColors.length === 0) {
                // Exportar colores secundarios agregados
                for (const secondaryColor of secondaryColors) {
                    const decision = this.actionStateMap.get(secondaryColor.id);
                    if (decision && decision.actionTaken === 'add') {
                        if (!processedIds.has(secondaryColor.id)) {
                            colorsToExport.push({
                                id: secondaryColor.id,
                                name: secondaryColor.name.toUpperCase(),
                                cmyk: [...secondaryColor.cmyk],
                                lab: [...secondaryColor.lab],
                                source: 'added'
                            });
                            processedIds.add(secondaryColor.id);
                        }
                    }
                }
            }
            
            processedKeys.add(key);
        }
        
        // Exportar colores agregados manualmente (addedColors)
        for (const [id, addedColor] of this.addedColors) {
            if (!processedIds.has(id)) {
                colorsToExport.push({
                    id: id,
                    name: addedColor.name.toUpperCase(),
                    cmyk: [...addedColor.cmyk],
                    lab: [...addedColor.lab],
                    source: 'added'
                });
                processedIds.add(id);
            }
        }
        
        // Ordenar por ID numérico
        colorsToExport.sort((a, b) => {
            const numA = parseInt(a.id) || 0;
            const numB = parseInt(b.id) || 0;
            return numA - numB;
        });
        
        console.log(`📤 Preparando exportación: ${colorsToExport.length} colores`);
        console.log(`   - Principales: ${colorsToExport.filter(c => c.source === 'primary').length}`);
        console.log(`   - Equivalentes: ${colorsToExport.filter(c => c.source === 'secondary_equivalent').length}`);
        console.log(`   - Agregados: ${colorsToExport.filter(c => c.source === 'added').length}`);
        
        return colorsToExport;
    }
    
    doExport(exportData) {
        const content = this.fileHandler.generateExportContent(exportData);
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alpha_color_export_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.uiRenderer.showToast(`📥 Exportados ${exportData.length} colores`, 'success');
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
        } else {
            // Crear un historial nuevo si no existe
            const primaryInfo = document.getElementById('primaryFileInfo');
            const secondaryInfo = document.getElementById('secondaryFileInfo');
            const primaryFilename = primaryInfo?.querySelector('.filename')?.textContent || 'Desconocido';
            const secondaryFilename = secondaryInfo?.querySelector('.filename')?.textContent || 'Desconocido';
            
            const historyItem = {
                id: Date.now(),
                date: new Date().toISOString(),
                primaryFile: primaryFilename,
                secondaryFile: secondaryFilename,
                stats: { matches: 0, differences: 0, missing: 0 },
                actionsLog: [{
                    type: actionType,
                    colorId: colorId,
                    colorName: colorName,
                    reason: reason,
                    timestamp: new Date().toISOString()
                }],
                results: []
            };
            this.dataManager.saveToHistory(historyItem);
        }
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
            this.originalPrimaryData = [];
            this.originalSecondaryData = [];
            this.primaryData = [];
            this.secondaryData = [];
            this.comparisonResults = [];
            this.currentFilter = 'all';
            this.actionStateMap.clear();
            this.addedColors.clear();
            this.searchTerm = '';
            this.missingInPrimary = [];
            this.missingInSecondary = [];
            
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
        a.download = `alpha_color_data_${new Date().toISOString().slice(0, 19)}.txt`;
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
