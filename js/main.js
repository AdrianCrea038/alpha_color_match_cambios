// ============================================================
// ALPHA COLOR MATCH - VERSIÓN FINAL CORREGIDA
// - Agrupación correcta por NK + nombre normalizado de tabla
// - Complementarios usan valores efectivos del grupo
// - Pares equivalentes comparten los mismos valores CMYK
// - Validación de pendientes funciona correctamente
// - Nombre de archivo personalizable al exportar
// - Detección inteligente de NK's por patrones
// - Tabla de equivalencia expandida a 4 columnas
// - Normalización elimina "TM" para mejor coincidencia
// - Soporte para punto después del número correlativo (ej: "1. Nombre")
// - Etiquetas HTML correctas en renderResults
// - Vista Crear TXT con CreatorView integrado
// - Vista EPS para exportar archivos .eps
// ============================================================

import { CreatorView } from './modules/views/creatorView.js';
import { EPSView } from './modules/views/epsView.js';

class AlphaColorMatch {
    constructor() {
        this.primaryData = [];
        this.secondaryData = [];
        this.results = [];
        this.selectedPending = new Set();
        this.deletedPending = new Set();
        this.groupSelections = new Map();
        this.manualGroupSelections = new Set();
        this.autoAddedItems = [];
        
        // Tabla de equivalencia de nombres expandida a 4 columnas
        this.equivalencyRows = [
            ["00A BLACK", "03S TM Black", "03T TM BLACK"],
            ["06F ANTHRACITE", "05X TM Anthracite"],
            ["01V WOLF GREY", "03T Blue Grey", "03T TM Blue Grey"],
            ["01P DK STEEL GREY", "01P DARK STEEL GREY"],
            ["08Q TM PEWTER GREY", "03T PEWTER GREY", "08Q PEWTER GREY", "03T TM PEWTER GREY"],
            ["06H FLINT GREY"],
            ["10F WHITE", "10F TM WHITE"],
            ["15A TM NATURAL", "15A NATURAL"],
            ["77C GOLD"],
            ["79W TEAM GOLD", "79X TM Vegas Gold"],
            ["79Y TM Bright Gold", "79Q SUNDOWN"],
            ["79V CLUB GOLD"],
            ["76I UNIVERSITY GOLD"],
            ["79U GOLD DART"],
            ["77C TONAL GOLD"],
            ["PMS 132 OLD GOLD"],
            ["PMS 1255C OLD GOLD"],
            ["79S YELLOW STRIKE", "79S TM Yellow Strike"],
            ["PMS 109C NEW YELLOW"],
            ["81F DESERT ORANGE", "81F TM DESERT ORANGE"],
            ["89L TEAM ORANGE", "82U TM ORANGE"],
            ["89M Uni Orange"],
            ["89N Brilliant Orange"],
            ["65N UNIVERSITY RED", "65N UNI RED", "54V TM Scarlet"],
            ["66P DEEP MAROON", "67Y TM Dark Maroon"],
            ["69W TM CRIMSON", "69W TEAM CRIMSON"],
            ["69X TEAM MAROON", "69Y TM CARDINAL"],
            ["6DL GYM RED"],
            ["39Y GORGE GREEN", "31V TM Dark Green"],
            ["31W CLASSIC GREEN", "3EM TM Kelly Green"],
            ["2DH MEDIUM OLIVE", "2DH TM Medium Olive"],
            ["3EY PRO GREEN"],
            ["PMS 361C LEVEL GREEN"],
            ["4EV GAME ROYAL", "49V TM ROYAL"],
            ["4EY VALOR BLUE", "4CV TM LIGHT BLUE"],
            ["4ES AERO BLUE", "4ES  TM AERO BLUE"],
            ["44A TIDAL BLUE"],
            ["41S COLLEGE NAVY", "43V TM NAVY"],
            ["4EW RUSH BLUE"],
            ["48Y ITALY BLUE"],
            ["44U SIGNAL BLUE"],
            ["56N FIELD PURPLE", "52V TM Purple"],
            ["52M NEW ORCHID"],
            ["55U URBAN LILAC"],
            ["66Z PINK FIRE II", "66Z PINK FIRE", "6DR TM Pink Fire"],
            ["2AQ TM Brown", "20Q   DARK CINDER"],
            ["2DI SEAL BROWN"],
            ["33B OCHRE"],
            ["TAN PMS 720C"],
            ["71R VOLT"],
            ["3GU HYPER TURQ"],
            ["4KB DARK TURQUOISE"],
            ["87F BRIGHT CERAMIC", "87F TM BRIGHT CERAMIC"],
            // NUEVAS FILAS AGREGADAS
            ["03T TM BLUE GREY", "03T Blue Grey", "01V WOLF GREY"],
            ["03T TM PEWTER GREY", "03T PEWTER GREY", "08Q PEWTER GREY", "08Q TM PEWTER GREY"],
            ["01P TM DARK STEEL GREY", "01P DK STEEL GREY", "01P DARK STEEL GREY"]
        ];
        
        // Inicializar vistas
        this.creatorView = null;
        this.epsView = null;
        
        // Construir grupos de equivalencia (expansión transitiva)
        this.equivalenceGroups = this.buildEquivalenceGroups();
        
        this.init();
        this.loadFromLocalStorage();
    }
    
    // ============================================================
    // LOCALSTORAGE - Guardar y cargar datos
    // ============================================================
    
    saveToLocalStorage() {
        const dataToSave = {
            primaryData: this.primaryData,
            secondaryData: this.secondaryData,
            results: this.results,
            selectedPending: Array.from(this.selectedPending),
            deletedPending: Array.from(this.deletedPending),
            groupSelections: Array.from(this.groupSelections.entries()),
            manualGroupSelections: Array.from(this.manualGroupSelections),
            autoAddedItems: this.autoAddedItems
        };
        localStorage.setItem('alphaColorMatchData', JSON.stringify(dataToSave));
        console.log('💾 Datos guardados en localStorage');
    }
    
    loadFromLocalStorage() {
        const savedData = localStorage.getItem('alphaColorMatchData');
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                this.primaryData = data.primaryData || [];
                this.secondaryData = data.secondaryData || [];
                this.results = data.results || [];
                this.selectedPending = new Set(data.selectedPending || []);
                this.deletedPending = new Set(data.deletedPending || []);
                this.groupSelections = new Map(data.groupSelections || []);
                this.manualGroupSelections = new Set(data.manualGroupSelections || []);
                this.autoAddedItems = data.autoAddedItems || [];
                
                // Actualizar UI con los datos cargados
                this.updateUIFromLoadedData();
                console.log('📂 Datos cargados desde localStorage');
            } catch (e) {
                console.error('Error al cargar datos:', e);
            }
        }
    }
    
    clearCache() {
        if (confirm('¿Estás seguro de que quieres limpiar toda la caché? Se perderán los datos no exportados.')) {
            localStorage.removeItem('alphaColorMatchData');
            this.primaryData = [];
            this.secondaryData = [];
            this.results = [];
            this.selectedPending.clear();
            this.deletedPending.clear();
            this.groupSelections.clear();
            this.manualGroupSelections.clear();
            this.autoAddedItems = [];
            
            // Limpiar UI
            this.updateFileInfo('primary', 'Ningún archivo cargado', 0);
            this.updateFileInfo('secondary', 'Ningún archivo cargado', 0);
            this.renderDataList('primary', []);
            this.renderDataList('secondary', []);
            
            const panel = document.getElementById('resultsPanel');
            if (panel) panel.style.display = 'none';
            
            const exportBtn = document.getElementById('exportBtn');
            if (exportBtn) exportBtn.disabled = true;
            
            alert('✅ Caché limpiada correctamente');
            console.log('🗑️ Caché limpiada');
        }
    }
    
    updateUIFromLoadedData() {
        // Actualizar vistas si hay datos
        if (this.primaryData.length > 0) {
            this.updateFileInfo('primary', 'Datos cargados desde caché', this.primaryData.length);
            this.renderDataList('primary', this.primaryData);
        }
        
        if (this.secondaryData.length > 0) {
            this.updateFileInfo('secondary', 'Datos cargados desde caché', this.secondaryData.length);
            this.renderDataList('secondary', this.secondaryData);
        }
        
        if (this.results.length > 0) {
            this.renderResults(this.results);
            this.validateExportReady();
        }
    }
    
    buildEquivalenceGroups() {
        const nameToGroup = new Map();
        const groups = [];
        
        for (const row of this.equivalencyRows) {
            const names = row.filter(name => name && name.trim() !== '');
            if (names.length === 0) continue;
            
            const normalizedNames = names.map(name => this.normalizeBaseName(name));
            
            let existingGroup = null;
            for (const normName of normalizedNames) {
                if (nameToGroup.has(normName)) {
                    existingGroup = nameToGroup.get(normName);
                    break;
                }
            }
            
            let targetGroup = existingGroup;
            
            if (!targetGroup) {
                targetGroup = new Set();
                groups.push(targetGroup);
            }
            
            for (const normName of normalizedNames) {
                targetGroup.add(normName);
                nameToGroup.set(normName, targetGroup);
            }
        }
        
        for (const row of this.equivalencyRows) {
            for (const name of row) {
                if (!name || name.trim() === '') continue;
                const norm = this.normalizeBaseName(name);
                if (!nameToGroup.has(norm)) {
                    const group = new Set();
                    group.add(norm);
                    groups.push(group);
                    nameToGroup.set(norm, group);
                }
            }
        }
        
        return groups;
    }
    
    getEquivalenceGroup(baseName) {
        const norm = this.normalizeBaseName(baseName);
        for (const group of this.equivalenceGroups) {
            if (group.has(norm)) {
                return group;
            }
        }
        return null;
    }
    
    areEquivalent(baseName1, baseName2) {
        const norm1 = this.normalizeBaseName(baseName1);
        const norm2 = this.normalizeBaseName(baseName2);
        if (norm1 === norm2) return true;
        
        const group1 = this.getEquivalenceGroup(baseName1);
        const group2 = this.getEquivalenceGroup(baseName2);
        
        if (group1 && group2 && group1 === group2) return true;
        
        return false;
    }
    
    getEquivalentNames(baseName) {
        const group = this.getEquivalenceGroup(baseName);
        if (!group) return [this.normalizeBaseName(baseName)];
        return Array.from(group);
    }
    
    init() {
        this.bindEvents();
        this.initCreatorView();
        this.initEPSView();
        this.initViews();
        
        // Agregar evento para limpiar caché
        const clearCacheBtn = document.getElementById('clearCacheBtn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', () => this.clearCache());
        }
        
        console.log('✅ Alpha Color Match - Versión Corregida');
    }
    
    initCreatorView() {
        const equivalencyMap = new Map();
        for (const row of this.equivalencyRows) {
            for (let i = 0; i < row.length; i++) {
                for (let j = i + 1; j < row.length; j++) {
                    equivalencyMap.set(row[i], row[j]);
                    equivalencyMap.set(row[j], row[i]);
                }
            }
        }
        this.creatorView = new CreatorView(this, equivalencyMap);
        console.log('✅ CreatorView inicializado');
    }
    
    initEPSView() {
        this.epsView = new EPSView(this);
        console.log('✅ EPSView inicializado');
    }
    
    initViews() {
        const menuItems = document.querySelectorAll('.menu-item');
        const views = {
            comparator: document.getElementById('comparatorView'),
            history: document.getElementById('historyView'),
            creator: document.getElementById('creatorView'),
            eps: document.getElementById('epsView')
        };
        
        const switchView = (viewName) => {
            Object.values(views).forEach(view => {
                if (view) view.classList.remove('active');
            });
            
            if (views[viewName]) {
                views[viewName].classList.add('active');
            }
            
            menuItems.forEach(item => {
                item.classList.remove('active');
                if (item.dataset.view === viewName) {
                    item.classList.add('active');
                }
            });
            
            if (viewName === 'creator' && this.creatorView) {
                this.creatorView.renderTable();
            }
            if (viewName === 'eps' && this.epsView) {
                this.epsView.loadColors();
            }
            if (viewName === 'history') {
                if (this.loadHistory) this.loadHistory();
            }
        };
        
        menuItems.forEach(item => {
            item.addEventListener('click', () => {
                const viewName = item.dataset.view;
                if (viewName) {
                    switchView(viewName);
                }
            });
        });
        
        switchView('comparator');
    }
    
    bindEvents() {
        const primaryInput = document.getElementById('primaryFileInput');
        const secondaryInput = document.getElementById('secondaryFileInput');
        const compareBtn = document.getElementById('compareBtn');
        const exportBtn = document.getElementById('exportBtn');
        const replaceAllSecondaryBtn = document.getElementById('replaceAllSecondaryBtn');
        
        if (primaryInput) {
            primaryInput.addEventListener('change', (e) => this.loadPrimaryFile(e.target.files[0]));
        }
        
        if (secondaryInput) {
            secondaryInput.addEventListener('change', (e) => this.loadSecondaryFile(e.target.files[0]));
        }
        
        if (compareBtn) {
            compareBtn.addEventListener('click', () => this.compareFiles());
        }
        
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.showPreviewAndExport());
        }
        
        if (replaceAllSecondaryBtn) {
            replaceAllSecondaryBtn.addEventListener('click', () => this.replaceAllWithSecondary());
        }
    }
    
    setGroupSelection(groupId, source) {
        this.groupSelections.set(groupId, source);
        this.manualGroupSelections.add(groupId);
        console.log(`🎨 Grupo ${groupId}: usando valores ${source === 'primary' ? 'PRINCIPAL' : 'SECUNDARIO'} (manual)`);
        this.renderResults(this.results);
        this.validateExportReady();
        this.saveToLocalStorage();
    }
    
    getGroupSelection(groupId) {
        return this.groupSelections.get(groupId) || 'primary';
    }
    
    replaceAllWithSecondary() {
        const groups = new Set();
        for (const item of this.results) {
            if (item.groupId && (item.matchType === 'exact' || item.matchType === 'equivalent')) {
                if (!this.manualGroupSelections.has(item.groupId)) {
                    groups.add(item.groupId);
                }
            }
        }
        
        for (const groupId of groups) {
            this.groupSelections.set(groupId, 'secondary');
        }
        
        console.log(`🔄 Reemplazados ${groups.size} grupos NO modificados a valores SECUNDARIO`);
        this.renderResults(this.results);
        this.validateExportReady();
        this.saveToLocalStorage();
    }
    
    togglePendingAdd(itemId) {
        this.selectedPending.add(itemId);
        this.deletedPending.delete(itemId);
        this.renderResults(this.results);
        this.validateExportReady();
        this.saveToLocalStorage();
        console.log(`➕ Pendiente agregado: ${itemId}`);
    }
    
    togglePendingDelete(itemId) {
        this.selectedPending.delete(itemId);
        this.deletedPending.add(itemId);
        this.renderResults(this.results);
        this.validateExportReady();
        this.saveToLocalStorage();
        console.log(`🗑️ Pendiente eliminado: ${itemId}`);
    }
    
    isPendingDecided(itemId) {
        return this.selectedPending.has(itemId) || this.deletedPending.has(itemId);
    }
    
    validateExportReady() {
        const exportBtn = document.getElementById('exportBtn');
        if (!exportBtn) return;
        
        const pendingUndecided = this.results.filter(item => 
            (item.matchType === 'pending_primary' || item.matchType === 'pending_secondary') && 
            !this.isPendingDecided(item.id)
        );
        
        const isReady = pendingUndecided.length === 0;
        
        if (isReady) {
            exportBtn.disabled = false;
            exportBtn.title = "Listo para exportar";
        } else {
            exportBtn.disabled = true;
            exportBtn.title = `Faltan ${pendingUndecided.length} pendientes por decidir (Agregar/Eliminar)`;
        }
        
        const validationMsg = document.getElementById('validationMessage');
        if (validationMsg) {
            if (pendingUndecided.length > 0) {
                validationMsg.innerHTML = `⚠️ Faltan ${pendingUndecided.length} colores pendientes por decidir (Agregar o Eliminar)`;
                validationMsg.style.display = 'block';
            } else {
                validationMsg.style.display = 'none';
            }
        }
        
        return isReady;
    }
    
    normalizeBaseName(baseName) {
        if (!baseName) return '';
        let cleaned = baseName.toUpperCase();
        cleaned = cleaned.replace(/\bTM\b/g, '');
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        return cleaned;
    }
    
    extractNK(fullName) {
        if (!fullName) return null;
        
        const words = fullName.trim().split(/\s+/);
        if (words.length === 0) return null;
        
        const patterns = [
            {
                name: 'NK_pattern',
                test: (str) => /^NK[-]?[A-Z0-9]+/i.test(str),
                minWords: 1,
                maxWords: 3
            },
            {
                name: 'numbers_only',
                test: (str) => /^[\d\-]{4,12}$/.test(str),
                minWords: 1,
                maxWords: 1
            },
            {
                name: 'alphanumeric',
                test: (str) => /^[A-Z]{1,4}[\d]{1,4}[A-Z]{0,2}$/i.test(str) || /^[\d]{1,4}[A-Z]{1,4}$/i.test(str),
                minWords: 1,
                maxWords: 1
            },
            {
                name: 'letter_number',
                test: (str) => /^[A-Z][\d]{3,6}[A-Z]{0,2}$/i.test(str),
                minWords: 1,
                maxWords: 1
            },
            {
                name: 'number_letter',
                test: (str) => /^[\d]{3,6}[A-Z]{1,4}$/i.test(str),
                minWords: 1,
                maxWords: 1
            },
            {
                name: 'specific_words',
                test: (str) => ['STANDARD', 'COLORS', 'GREY', 'WHITE', 'BLACK', 'BLUE', 'GOLD', 'SILVER'].includes(str.toUpperCase()),
                minWords: 1,
                maxWords: 1
            }
        ];
        
        for (let wordCount = 1; wordCount <= 3; wordCount++) {
            if (words.length < wordCount) continue;
            
            const candidate = words.slice(-wordCount).join(' ');
            
            for (const pattern of patterns) {
                if (wordCount >= pattern.minWords && wordCount <= pattern.maxWords) {
                    if (pattern.test(candidate)) {
                        console.log(`🔍 NK detectado: "${candidate}" (patrón: ${pattern.name})`);
                        return candidate;
                    }
                }
            }
        }
        
        const lastWord = words[words.length - 1];
        console.log(`⚠️ NK no detectado con patrones, usando última palabra: "${lastWord}"`);
        return lastWord;
    }
    
    extractBaseName(fullName) {
        if (!fullName) return '';
        
        const nk = this.extractNK(fullName);
        if (!nk) return this.normalizeBaseName(fullName);
        
        const nkPattern = new RegExp(`\\s+${nk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
        const base = fullName.replace(nkPattern, '').trim();
        
        return this.normalizeBaseName(base);
    }
    
    getEffectiveCmyk(groupId, primaryColor, secondaryColor) {
        const selection = this.getGroupSelection(groupId);
        if (selection === 'primary') {
            return primaryColor ? [...primaryColor.cmyk] : null;
        } else {
            return secondaryColor ? [...secondaryColor.cmyk] : null;
        }
    }
    
    getEffectiveLab(groupId, primaryColor, secondaryColor) {
        const selection = this.getGroupSelection(groupId);
        if (selection === 'primary') {
            return primaryColor ? [...primaryColor.lab] : null;
        } else {
            return secondaryColor ? [...secondaryColor.lab] : null;
        }
    }
    
    parseTxtContent(content) {
        const lines = content.split(/\r?\n/);
        let dataStarted = false;
        const records = [];
        
        for (let line of lines) {
            if (line.trim() === '') continue;
            
            if (line.trim() === 'BEGIN_DATA') {
                dataStarted = true;
                continue;
            }
            if (dataStarted && line.trim() === 'END_DATA') break;
            if (!dataStarted) continue;
            
            const match = line.match(/^(\d+)\.?\s+(?:"([^"]+)"|([^\s]+))\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)/);
            
            if (match) {
                let name = match[2] || match[3];
                if (name) {
                    records.push({
                        id: match[1],
                        name: name.trim(),
                        cmyk: [parseFloat(match[4]), parseFloat(match[5]), parseFloat(match[6]), parseFloat(match[7])],
                        lab: [parseFloat(match[8]), parseFloat(match[9]), parseFloat(match[10])]
                    });
                }
            }
        }
        
        console.log(`📄 Parseados ${records.length} registros`);
        return records;
    }
    
    async loadPrimaryFile(file) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            this.primaryData = this.parseTxtContent(content);
            this.updateFileInfo('primary', file.name, this.primaryData.length);
            this.renderDataList('primary', this.primaryData);
            this.saveToLocalStorage();
            console.log(`✅ Principal: ${this.primaryData.length} colores`);
        };
        reader.readAsText(file);
    }
    
    async loadSecondaryFile(file) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            this.secondaryData = this.parseTxtContent(content);
            this.updateFileInfo('secondary', file.name, this.secondaryData.length);
            this.renderDataList('secondary', this.secondaryData);
            this.saveToLocalStorage();
            console.log(`✅ Secundario: ${this.secondaryData.length} colores`);
        };
        reader.readAsText(file);
    }
    
    updateFileInfo(type, filename, count) {
        const infoDiv = document.getElementById(`${type}FileInfo`);
        if (infoDiv) {
            const filenameSpan = infoDiv.querySelector('.filename');
            const recordCountSpan = infoDiv.querySelector('.record-count');
            if (filenameSpan) filenameSpan.textContent = filename;
            if (recordCountSpan) recordCountSpan.textContent = `${count} registro${count !== 1 ? 's' : ''}`;
        }
    }
    
    renderDataList(type, data) {
        const container = document.getElementById(`${type}DataList`);
        if (!container) return;
        
        if (!data || data.length === 0) {
            container.innerHTML = '<div class="empty-list">Sin datos cargados</div>';
            return;
        }
        
        container.innerHTML = data.map(color => {
            const nk = this.extractNK(color.name);
            const baseName = this.extractBaseName(color.name);
            return `
                <div class="data-item">
                    <span class="nk">${nk || 'SIN NK'}</span>
                    <span class="name">${baseName}</span>
                </div>
            `;
        }).join('');
    }
    
    compareFiles() {
        if (this.primaryData.length === 0) {
            alert('⚠️ Cargue archivo principal');
            return;
        }
        
        if (this.secondaryData.length === 0) {
            alert('⚠️ Cargue archivo secundario');
            return;
        }
        
        this.selectedPending.clear();
        this.deletedPending.clear();
        this.groupSelections.clear();
        this.manualGroupSelections.clear();
        this.autoAddedItems = [];
        console.log('🔍 Comparando archivos...');
        this.findMatches();
        this.saveToLocalStorage();
    }
    
    findMatches() {
        const primaryByNK = new Map();
        const secondaryByNK = new Map();
        
        for (const color of this.primaryData) {
            const nk = this.extractNK(color.name);
            if (!nk) continue;
            if (!primaryByNK.has(nk)) primaryByNK.set(nk, []);
            primaryByNK.get(nk).push({
                id: color.id,
                baseName: this.extractBaseName(color.name),
                colorData: color
            });
        }
        
        for (const color of this.secondaryData) {
            const nk = this.extractNK(color.name);
            if (!nk) continue;
            if (!secondaryByNK.has(nk)) secondaryByNK.set(nk, []);
            secondaryByNK.get(nk).push({
                id: color.id,
                baseName: this.extractBaseName(color.name),
                colorData: color
            });
        }
        
        const results = [];
        const processedPrimary = new Set();
        const processedSecondary = new Set();
        const allNKs = new Set([...primaryByNK.keys(), ...secondaryByNK.keys()]);
        let groupCounter = 0;
        
        for (const nk of allNKs) {
            const primaryColors = primaryByNK.get(nk) || [];
            const secondaryColors = secondaryByNK.get(nk) || [];
            
            const groups = new Map();
            
            for (const pc of primaryColors) {
                const groupKey = this.getEquivalenceGroup(pc.baseName);
                const groupIdKey = groupKey ? Array.from(groupKey).sort().join('|') : pc.baseName;
                if (!groups.has(groupIdKey)) {
                    groups.set(groupIdKey, { primarios: [], secundarios: [], groupKey: groupKey });
                }
                groups.get(groupIdKey).primarios.push(pc);
            }
            
            for (const sc of secondaryColors) {
                const groupKey = this.getEquivalenceGroup(sc.baseName);
                const groupIdKey = groupKey ? Array.from(groupKey).sort().join('|') : sc.baseName;
                if (!groups.has(groupIdKey)) {
                    groups.set(groupIdKey, { primarios: [], secundarios: [], groupKey: groupKey });
                }
                groups.get(groupIdKey).secundarios.push(sc);
            }
            
            for (const [groupIdKey, group] of groups) {
                const { primarios, secundarios, groupKey } = group;
                const actualGroupId = `group_${nk}_${groupCounter++}`;
                
                if (primarios.length > 0 && secundarios.length > 0) {
                    for (const primary of primarios) {
                        for (const secondary of secundarios) {
                            const isExact = primary.baseName === secondary.baseName;
                            const matchType = isExact ? 'exact' : 'equivalent';
                            
                            results.push({
                                id: `primary_${primary.id}`,
                                groupId: actualGroupId,
                                nk: nk,
                                primaryData: { id: primary.id, baseName: primary.baseName, colorData: primary.colorData },
                                secondaryData: { id: secondary.id, baseName: secondary.baseName, colorData: secondary.colorData },
                                matchType: matchType,
                                isPending: false,
                                isSelected: true
                            });
                            processedPrimary.add(primary.id);
                            processedSecondary.add(secondary.id);
                        }
                    }
                } else if (primarios.length > 0) {
                    for (const primary of primarios) {
                        if (!processedPrimary.has(primary.id)) {
                            results.push({
                                id: `pending_primary_${primary.id}`,
                                groupId: null,
                                nk: nk,
                                primaryData: { id: primary.id, baseName: primary.baseName, colorData: primary.colorData },
                                secondaryData: null,
                                matchType: 'pending_primary',
                                isPending: true,
                                isSelected: false
                            });
                            processedPrimary.add(primary.id);
                        }
                    }
                } else if (secundarios.length > 0) {
                    for (const secondary of secundarios) {
                        if (!processedSecondary.has(secondary.id)) {
                            results.push({
                                id: `pending_secondary_${secondary.id}`,
                                groupId: null,
                                nk: nk,
                                primaryData: null,
                                secondaryData: { id: secondary.id, baseName: secondary.baseName, colorData: secondary.colorData },
                                matchType: 'pending_secondary',
                                isPending: true,
                                isSelected: false
                            });
                            processedSecondary.add(secondary.id);
                        }
                    }
                }
                
                if (groupKey && primarios.length > 0) {
                    const existingNames = new Set();
                    for (const p of primarios) existingNames.add(p.baseName);
                    for (const s of secundarios) existingNames.add(s.baseName);
                    
                    for (const equivalentName of groupKey) {
                        if (!existingNames.has(equivalentName)) {
                            const sourceColor = primarios[0].colorData;
                            this.autoAddedItems.push({
                                nk: nk,
                                baseName: equivalentName,
                                sourceColor: sourceColor,
                                groupId: actualGroupId
                            });
                            existingNames.add(equivalentName);
                        }
                    }
                }
            }
        }
        
        results.sort((a, b) => a.nk.localeCompare(b.nk));
        
        this.results = results;
        this.renderResults(results);
        this.validateExportReady();
        
        console.log(`📊 RESULTADOS: ${results.length}, Auto-agregados: ${this.autoAddedItems.length}`);
    }
    
renderResults(results) {
    const panel = document.getElementById('resultsPanel');
    const tbody = document.getElementById('resultsTableBody');
    const statsContainer = document.getElementById('statsBadges');
    
    if (!panel || !tbody) return;
    
    panel.style.display = 'block';
    
    const exactMatches = results.filter(r => r.matchType === 'exact').length;
    const equivalentMatches = results.filter(r => r.matchType === 'equivalent').length;
    const pendingPrimary = results.filter(r => r.matchType === 'pending_primary').length;
    const pendingSecondary = results.filter(r => r.matchType === 'pending_secondary').length;
    const selectedCount = this.selectedPending.size;
    const deletedCount = this.deletedPending.size;
    
    statsContainer.innerHTML = `
        <span class="badge match">✅ Exactas: ${exactMatches}</span>
        <span class="badge" style="background:#b45309;">🔄 Equivalentes: ${equivalentMatches}</span>
        <span class="badge missing">❌ Pendientes Principal: ${pendingPrimary}</span>
        <span class="badge secondary">➕ Pendientes Secundario: ${pendingSecondary}</span>
        <span class="badge" style="background:#15803d;">✓ Agregados: ${selectedCount}</span>
        <span class="badge" style="background:#991b1b;">🗑️ Eliminados: ${deletedCount}</span>
        <span class="badge" style="background:#eab308;">✨ Auto-agregados: ${this.autoAddedItems.length}</span>
    `;
    
    tbody.innerHTML = results.map(item => {
        let rowClass = '';
        let statusClass = '';
        let statusText = '';
        let actionButton = '';
        let selectionButtons = '';
        let cmykPreview = '';
        
        if (item.matchType === 'exact' || item.matchType === 'equivalent') {
            rowClass = item.matchType === 'exact' ? 'style="background: rgba(21, 128, 61, 0.1);"' : 'style="background: rgba(180, 83, 9, 0.1);"';
            statusClass = item.matchType === 'exact' ? 'match-badge yes' : 'match-badge' + ' style="background:#b45309;"';
            statusText = item.matchType === 'exact' ? '✅ COINCIDENCIA' : '🔄 EQUIVALENTE';
            
            const currentSelection = this.getGroupSelection(item.groupId);
            const isManual = this.manualGroupSelections.has(item.groupId);
            
            const effectiveCmyk = this.getEffectiveCmyk(item.groupId, item.primaryData?.colorData, item.secondaryData?.colorData);
            if (effectiveCmyk) {
                cmykPreview = `<div style="font-size:0.65rem; color:#9ca3af; margin-top:0.25rem;">Valor usado: C:${effectiveCmyk[0].toFixed(1)} M:${effectiveCmyk[1].toFixed(1)} Y:${effectiveCmyk[2].toFixed(1)} K:${effectiveCmyk[3].toFixed(1)}</div>`;
            }
            
            selectionButtons = `
                <div class="selection-buttons">
                    <button class="selection-btn ${currentSelection === 'primary' ? 'active-primary' : ''}" 
                            onclick="window.app.setGroupSelection('${item.groupId}', 'primary')">
                        📁 Principal<br>
                        <span class="cmyk-small">C:${item.primaryData?.colorData.cmyk[0].toFixed(1)} M:${item.primaryData?.colorData.cmyk[1].toFixed(1)} Y:${item.primaryData?.colorData.cmyk[2].toFixed(1)} K:${item.primaryData?.colorData.cmyk[3].toFixed(1)}</span>
                    </button>
                    <button class="selection-btn ${currentSelection === 'secondary' ? 'active-secondary' : ''}" 
                            onclick="window.app.setGroupSelection('${item.groupId}', 'secondary')">
                        🔄 Secundario<br>
                        <span class="cmyk-small">C:${item.secondaryData?.colorData.cmyk[0].toFixed(1)} M:${item.secondaryData?.colorData.cmyk[1].toFixed(1)} Y:${item.secondaryData?.colorData.cmyk[2].toFixed(1)} K:${item.secondaryData?.colorData.cmyk[3].toFixed(1)}</span>
                    </button>
                    ${isManual ? '<span class="manual-badge" style="font-size:0.6rem; color:#fbbf24;">🔒 Manual</span>' : ''}
                </div>
            `;
            
        } else {
            const isAdded = this.selectedPending.has(item.id);
            const isDeleted = this.deletedPending.has(item.id);
            const isDecided = isAdded || isDeleted;
            
            if (!isDecided) {
                rowClass = 'style="background: rgba(153, 27, 27, 0.1);"';
                statusClass = 'match-badge no';
                statusText = '❌ PENDIENTE';
            } else if (isAdded) {
                rowClass = 'style="background: rgba(21, 128, 61, 0.2);"';
                statusClass = 'match-badge yes';
                statusText = '✓ AGREGADO';
            } else {
                rowClass = 'style="background: rgba(153, 27, 27, 0.2);"';
                statusClass = 'match-badge no';
                statusText = '🗑️ ELIMINADO';
            }
            
            actionButton = `
                <div class="pending-buttons">
                    <button class="small-btn btn-success" 
                            onclick="window.app.togglePendingAdd('${item.id}')"
                            ${isAdded ? 'disabled style="opacity:0.5;"' : ''}>
                        ➕ Agregar
                    </button>
                    <button class="small-btn btn-danger" 
                            onclick="window.app.togglePendingDelete('${item.id}')"
                            ${isDeleted ? 'disabled style="opacity:0.5;"' : ''}>
                        🗑️ Eliminar
                    </button>
                </div>
            `;
            
            const colorData = item.primaryData?.colorData || item.secondaryData?.colorData;
            if (colorData) {
                cmykPreview = `<div style="font-size:0.65rem; color:#9ca3af; margin-top:0.25rem;">CMYK: ${colorData.cmyk.map(v => v.toFixed(1)).join(', ')}</div>`;
            }
        }
        
        const primaryName = item.primaryData ? item.primaryData.baseName : '—';
        const secondaryName = item.secondaryData ? item.secondaryData.baseName : '—';
        const primaryCmyk = item.primaryData?.colorData?.cmyk;
        const secondaryCmyk = item.secondaryData?.colorData?.cmyk;
        
        return `
            <tr ${rowClass}>
                <td><strong>${item.nk}</strong>${cmykPreview}</td>
                <td>${primaryName}<br>${primaryCmyk ? `<span class="cmyk-small">C:${primaryCmyk[0].toFixed(1)} M:${primaryCmyk[1].toFixed(1)} Y:${primaryCmyk[2].toFixed(1)} K:${primaryCmyk[3].toFixed(1)}</span>` : ''}</td>
                <td>${secondaryName}<br>${secondaryCmyk ? `<span class="cmyk-small">C:${secondaryCmyk[0].toFixed(1)} M:${secondaryCmyk[1].toFixed(1)} Y:${secondaryCmyk[2].toFixed(1)} K:${secondaryCmyk[3].toFixed(1)}</span>` : ''}</td>
                <td><span class="${statusClass}">${statusText}</span></td>
                <td>${selectionButtons || actionButton || '—'}</td>
            </tr>
        `;
    }).join('');
}
    
    buildExportItems() {
        const exportItems = [];
        const processedGroups = new Set();
        
        const sortedResults = [...this.results].sort((a, b) => a.nk.localeCompare(b.nk));
        
        for (const item of sortedResults) {
            if (item.matchType === 'exact' || item.matchType === 'equivalent') {
                if (processedGroups.has(item.groupId)) continue;
                processedGroups.add(item.groupId);
                
                const cmyk = this.getEffectiveCmyk(item.groupId, item.primaryData?.colorData, item.secondaryData?.colorData);
                const lab = this.getEffectiveLab(item.groupId, item.primaryData?.colorData, item.secondaryData?.colorData);
                
                if (item.primaryData) {
                    exportItems.push({
                        name: item.primaryData.colorData.name,
                        cmyk: cmyk,
                        lab: lab,
                        type: item.matchType
                    });
                }
                
                if (item.matchType === 'equivalent' && item.secondaryData) {
                    exportItems.push({
                        name: item.secondaryData.colorData.name,
                        cmyk: cmyk,
                        lab: lab,
                        type: item.matchType
                    });
                }
                
                const groupAutos = this.autoAddedItems.filter(a => a.groupId === item.groupId);
                for (const auto of groupAutos) {
                    const fullName = `${auto.baseName} ${auto.nk}`;
                    exportItems.push({
                        name: fullName,
                        cmyk: cmyk,
                        lab: lab,
                        type: 'auto_added'
                    });
                }
            }
        }
        
        for (const item of this.results) {
            if (this.selectedPending.has(item.id)) {
                if (item.primaryData) {
                    exportItems.push({
                        name: item.primaryData.colorData.name,
                        cmyk: [...item.primaryData.colorData.cmyk],
                        lab: [...item.primaryData.colorData.lab],
                        type: 'added'
                    });
                } else if (item.secondaryData) {
                    exportItems.push({
                        name: item.secondaryData.colorData.name,
                        cmyk: [...item.secondaryData.colorData.cmyk],
                        lab: [...item.secondaryData.colorData.lab],
                        type: 'added'
                    });
                }
            }
        }
        
        return exportItems;
    }
    
    generateCGATSContent(exportItems) {
        const today = new Date();
        const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
        
        let content = 'CGATS.17\n';
        content += 'ORIGINATOR\t"ALPHA COLOR MATCH"\n';
        content += 'FILE_DESCRIPTOR\t""\n';
        content += `CREATED\t"${dateStr}"\n`;
        content += 'NUMBER_OF_FIELDS\t9\n';
        content += 'BEGIN_DATA_FORMAT\n';
        content += 'SAMPLE_ID SAMPLE_NAME CMYK_C CMYK_M CMYK_Y CMYK_K LAB_L LAB_A LAB_B\n';
        content += 'END_DATA_FORMAT\n';
        content += `NUMBER_OF_SETS\t${exportItems.length}\n`;
        content += 'BEGIN_DATA\n\n';
        
        exportItems.forEach((item, index) => {
            const counter = index + 1;
            content += `${counter}. "${item.name}" `;
            content += `${item.cmyk[0].toFixed(6)} ${item.cmyk[1].toFixed(6)} ${item.cmyk[2].toFixed(6)} ${item.cmyk[3].toFixed(6)} `;
            content += `${item.lab[0].toFixed(6)} ${item.lab[1].toFixed(6)} ${item.lab[2].toFixed(6)}\n`;
        });
        
        content += '\nEND_DATA\n';
        return content;
    }
    
    showPreviewAndExport() {
        const exportItems = this.buildExportItems();
        
        if (exportItems.length === 0) {
            alert('No hay datos para exportar. Asegúrate de haber comparado y seleccionado pendientes.');
            return;
        }
        
        const content = this.generateCGATSContent(exportItems);
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px; max-height: 85vh;">
                <div class="modal-header" style="background: #2d4ed6;">
                    <h3 style="color: white;">📄 Vista previa de exportación (CGATS.17)</h3>
                    <button class="modal-close" style="color: white;">&times;</button>
                </div>
                <div class="modal-body" style="overflow: auto; max-height: 65vh;">
                    <div style="margin-bottom: 1rem; padding: 0.75rem; background: #1e1e2c; border-radius: 0.5rem;">
                        <strong>📊 Resumen:</strong> ${exportItems.length} registros a exportar
                        <br><small>✅ Coincidencias exactas: ${exportItems.filter(i => i.type === 'exact').length}</small>
                        <br><small>🔄 Equivalentes: ${exportItems.filter(i => i.type === 'equivalent').length}</small>
                        <br><small>➕ Agregados manualmente: ${exportItems.filter(i => i.type === 'added').length}</small>
                        <br><small>✨ Auto-agregados (tabla): ${exportItems.filter(i => i.type === 'auto_added').length}</small>
                    </div>
                    <div style="font-family: monospace; font-size: 0.7rem; background: #0a0a0a; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; white-space: pre-wrap;">
                        <pre style="margin: 0; color: #e2e8f0;">${content}</pre>
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
            this.doExport(exportItems);
            closeModal();
        };
        
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };
    }
    
    doExport(exportItems) {
        const content = this.generateCGATSContent(exportItems);
        
        const fileNameInput = document.getElementById('exportFileName');
        let baseFileName = 'alpha_color_export';
        
        if (fileNameInput && fileNameInput.value.trim() !== '') {
            baseFileName = fileNameInput.value.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
            if (baseFileName === '') baseFileName = 'alpha_color_export';
        }
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const fullFileName = `${baseFileName}_${timestamp}.txt`;
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fullFileName;
        a.click();
        URL.revokeObjectURL(url);
        
        alert(`✅ Archivo exportado con ${exportItems.length} registros en formato CGATS.17`);
    }
}

window.app = new AlphaColorMatch();