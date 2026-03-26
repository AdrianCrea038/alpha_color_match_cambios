// ============================================================
// ALPHA COLOR MATCH - VERSIÓN FINAL CORREGIDA
// - Agrupación correcta por NK + nombre normalizado de tabla
// - Complementarios usan valores efectivos del grupo
// - Pares equivalentes comparten los mismos valores CMYK
// - Validación de pendientes funciona correctamente
// - Nombre de archivo personalizable al exportar
// ============================================================

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
        
        // Tabla de equivalencia de nombres (normalizada)
        this.equivalencyTable = new Map([
            ["10F TM WHITE", "10A WHITE"],
            ["03S TM BLACK", "00A BLACK"],
            ["01P TM DK STEEL GREY", "01P DK STEEL GREY"],
            ["03T BLUE GREY", "01V WOLF GREY"],
            ["05X TM ANTHRACITE", "06F ANTHRACITE"],
            ["2AQ TM BROWN", "20Q DARK CINDER"],
            ["2DH TM MEDIUM OLIVE", "2DH MEDIUM OLIVE"],
            ["3EM TM KELLY GREEN", "31W CLASSIC GREEN"],
            ["31V TM DARK GREEN", "39Y GORGE GREEN"],
            ["43V TM NAVY", "41S COLLEGE NAVY"],
            ["44A TM TIDAL BLUE", "44A TIDAL BLUE"],
            ["45W TM BLUSTERY", "45W BLUSTERY"],
            ["4ES TM AERO BLUE", "4ES AERO BLUE"],
            ["49V TM ROYAL", "4EV GAME ROYAL"],
            ["4CV TM LIGHT BLUE", "4EY VALOR BLUE"],
            ["52V TM PURPLE", "56N FIELD PURPLE"],
            ["64V TM SCARLET", "65N UNIVERSITY RED"],
            ["67Y TM DARK MAROON", "66P DEEP MAROON"],
            ["6DR TM PINK FIRE II", "66Z PINK FIRE II"],
            ["69W TM CRIMSON", "69W TEAM CRIMSON"],
            ["69Y TM CARDINAL", "69X TEAM MAROON"],
            ["79Y TM BRIGHT GOLD", "79Q SUNDOWN"],
            ["79S TM YELLOW STRIKE", "79S YELLOW STRIKE"],
            ["79X TM VEGAS GOLD", "79W TEAM GOLD"],
            ["81F DESERT ORANGE", "81F DESERT ORANGE"],
            ["87F TM BRIGHT CERAMIC", "87F BRIGHT CERAMIC"],
            ["82U TM ORANGE", "89L TEAM ORANGE"],
            ["06H FLINT GREY", "06H FLINT GREY"],
            ["15A NATURAL", "15A NATURAL"],
            ["3EY PRO GREEN", "3EY PRO GREEN"],
            ["3HN ACTION GREEN", "3HN ACTION GREEN"],
            ["3GU HYPER TURQUOISE", "3GU HYPER TURQUOISE"],
            ["44U SIGNAL BLUE", "44U SIGNAL BLUE"],
            ["4KB DARK TURQUOISE", "4KB DARK TURQUOISE"],
            ["4LB GYM BLUE", "4LB GYM BLUE"],
            ["48Y ITALY BLUE", "48Y ITALY BLUE"],
            ["52M NEW ORCHID", "52M NEW ORCHID"],
            ["71R VOLT", "71R VOLT"],
            ["77C GOLD", "77C GOLD"],
            ["76I UNIVERSITY GOLD", "76I UNIVERSITY GOLD"],
            ["78H AMARILLO", "78H AMARILLO"],
            ["79V CLUB GOLD", "79V CLUB GOLD"],
            ["89M UNIVERSITY ORANGE", "89M UNIVERSITY ORANGE"],
            ["89N BRILLIANT ORANGE", "89N BRILLIANT ORANGE"],
            ["89Q ORANGE HORIZON", "89Q ORANGE HORIZON"]
        ]);
        
        // Construir grupos de equivalencia (expansión transitiva)
        this.equivalenceGroups = this.buildEquivalenceGroups();
        
        this.init();
    }
    
    buildEquivalenceGroups() {
        // Crear un mapa de nombre -> grupo
        const nameToGroup = new Map();
        const groups = [];
        
        for (let [name1, name2] of this.equivalencyTable) {
            const norm1 = this.normalizeBaseName(name1);
            const norm2 = this.normalizeBaseName(name2);
            
            let group = null;
            
            if (nameToGroup.has(norm1)) {
                group = nameToGroup.get(norm1);
            } else if (nameToGroup.has(norm2)) {
                group = nameToGroup.get(norm2);
            } else {
                group = new Set();
                groups.push(group);
            }
            
            group.add(norm1);
            group.add(norm2);
            nameToGroup.set(norm1, group);
            nameToGroup.set(norm2, group);
        }
        
        // Para los nombres que son equivalentes a sí mismos (sin pareja)
        for (let [name1, name2] of this.equivalencyTable) {
            if (name1 === name2) {
                const norm = this.normalizeBaseName(name1);
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
        console.log('✅ Alpha Color Match - Versión Corregida');
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
    }
    
    togglePendingAdd(itemId) {
        this.selectedPending.add(itemId);
        this.deletedPending.delete(itemId);
        this.renderResults(this.results);
        this.validateExportReady();
        console.log(`➕ Pendiente agregado: ${itemId}`);
    }
    
    togglePendingDelete(itemId) {
        this.selectedPending.delete(itemId);
        this.deletedPending.add(itemId);
        this.renderResults(this.results);
        this.validateExportReady();
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
        return baseName.toUpperCase().replace(/\s+/g, ' ').trim();
    }
    
    extractNK(fullName) {
        if (!fullName) return null;
        const match = fullName.match(/NK\d+$/i);
        return match ? match[0].toUpperCase() : null;
    }
    
    extractBaseName(fullName) {
        if (!fullName) return '';
        const base = fullName.replace(/\s+NK\d+$/i, '').trim();
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
            
            const match = line.match(/^(\d+)\s+(?:"([^"]+)"|([^\s]+))\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)/);
            
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
    }
    
    findMatches() {
        // Índices por NK
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
        
        // Para cada NK, agrupar por equivalencia
        for (const nk of allNKs) {
            const primaryColors = primaryByNK.get(nk) || [];
            const secondaryColors = secondaryByNK.get(nk) || [];
            
            // Agrupar por grupo de equivalencia
            const groups = new Map(); // key = grupo de equivalencia, value = { primarios, secundarios }
            
            // Procesar primarios
            for (const pc of primaryColors) {
                const groupKey = this.getEquivalenceGroup(pc.baseName);
                const groupIdKey = groupKey ? Array.from(groupKey).sort().join('|') : pc.baseName;
                if (!groups.has(groupIdKey)) {
                    groups.set(groupIdKey, { primarios: [], secundarios: [], groupKey: groupKey });
                }
                groups.get(groupIdKey).primarios.push(pc);
            }
            
            // Procesar secundarios
            for (const sc of secondaryColors) {
                const groupKey = this.getEquivalenceGroup(sc.baseName);
                const groupIdKey = groupKey ? Array.from(groupKey).sort().join('|') : sc.baseName;
                if (!groups.has(groupIdKey)) {
                    groups.set(groupIdKey, { primarios: [], secundarios: [], groupKey: groupKey });
                }
                groups.get(groupIdKey).secundarios.push(sc);
            }
            
            // Para cada grupo, crear resultados
            for (const [groupIdKey, group] of groups) {
                const { primarios, secundarios, groupKey } = group;
                const actualGroupId = `group_${nk}_${groupCounter++}`;
                
                if (primarios.length > 0 && secundarios.length > 0) {
                    // Ambos tienen colores en este grupo
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
                    // Solo en principal
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
                    // Solo en secundario
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
                
                // Buscar complementarios faltantes en la tabla
                if (groupKey && primarios.length > 0) {
                    const existingNames = new Set();
                    for (const p of primarios) existingNames.add(p.baseName);
                    for (const s of secundarios) existingNames.add(s.baseName);
                    
                    for (const equivalentName of groupKey) {
                        if (!existingNames.has(equivalentName)) {
                            // Falta este nombre, usar el primer primario como fuente
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
                    <td><strong>${item.nk}</strong>${cmykPreview} \n
                    66<

                        ${primaryName}<br>
                        ${primaryCmyk ? `<span class="cmyk-small">C:${primaryCmyk[0].toFixed(1)} M:${primaryCmyk[1].toFixed(1)} Y:${primaryCmyk[2].toFixed(1)} K:${primaryCmyk[3].toFixed(1)}</span>` : ''}
                      </td>
                      <td>
                        ${secondaryName}<br>
                        ${secondaryCmyk ? `<span class="cmyk-small">C:${secondaryCmyk[0].toFixed(1)} M:${secondaryCmyk[1].toFixed(1)} Y:${secondaryCmyk[2].toFixed(1)} K:${secondaryCmyk[3].toFixed(1)}</span>` : ''}
                      </td>
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
                
                // Obtener valores efectivos UNA VEZ para todo el grupo
                const cmyk = this.getEffectiveCmyk(item.groupId, item.primaryData?.colorData, item.secondaryData?.colorData);
                const lab = this.getEffectiveLab(item.groupId, item.primaryData?.colorData, item.secondaryData?.colorData);
                
                // 1. Color principal
                if (item.primaryData) {
                    exportItems.push({
                        name: item.primaryData.colorData.name,
                        cmyk: cmyk,
                        lab: lab,
                        type: item.matchType
                    });
                }
                
                // 2. Color secundario (para equivalentes)
                if (item.matchType === 'equivalent' && item.secondaryData) {
                    exportItems.push({
                        name: item.secondaryData.colorData.name,
                        cmyk: cmyk,
                        lab: lab,
                        type: item.matchType
                    });
                }
                
                // 3. Complementarios automáticos del grupo (usando los mismos valores efectivos)
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
        
        // Agregar pendientes seleccionados (al final)
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
        
        // Obtener nombre personalizado del input
        const fileNameInput = document.getElementById('exportFileName');
        let baseFileName = 'alpha_color_export';
        
        if (fileNameInput && fileNameInput.value.trim() !== '') {
            // Sanitizar nombre de archivo (solo letras, números, guiones y guiones bajos)
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