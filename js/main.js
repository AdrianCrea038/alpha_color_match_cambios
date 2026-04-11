// ============================================================
// ALPHA COLOR MATCH - VERSIÓN CON LOGIN Y ADMIN
// CORREGIDO: Carga de archivos y tabla de equivalencias
// ============================================================

import { CreatorView } from './modules/views/creatorView.js';
import { EPSView } from './modules/views/epsView.js';
import { DevelopmentView } from './modules/views/developmentView.js';
import { HistoryView } from './modules/views/historyView.js';
import { AssignmentView } from './modules/views/assignmentView.js';
import { AdminView } from './modules/views/adminView.js';
import { ReportsView } from './modules/views/reportsView.js';
import { Auth, PERMISSIONS } from './modules/auth.js';

class AlphaColorMatch {
    constructor() {
        this.primaryData = [];
        this.secondaryData = [];
        this.results = [];
        this.selectedPending = new Set();
        this.deletedPending = new Set();
        this.groupSelections = new Map();
        this.manualGroupSelections = new Set();
        this.groupIds = new Map();
        
        this.libraryTxts = [];
        this.inboxItems = [];
        this.currentUser = 'usuario_admin';
        
        this.pendingCorrections = [];
        
        this.auth = new Auth();
        this.adminView = null;
        this.reportsView = null;
        
        // TABLA DE EQUIVALENCIAS COMPLETA
        this.equivalencyRows = [
            ["00A BLACK", "03S TM Black", "03T TM BLACK", "002 BLACK"],
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
            ["4ES AERO BLUE", "4ES TM AERO BLUE"],
            ["44A TIDAL BLUE"],
            ["41S COLLEGE NAVY", "43V TM NAVY"],
            ["4EW RUSH BLUE"],
            ["48Y ITALY BLUE"],
            ["44U SIGNAL BLUE"],
            ["56N FIELD PURPLE", "52V TM Purple"],
            ["52M NEW ORCHID"],
            ["55U URBAN LILAC"],
            ["66Z PINK FIRE II", "66Z PINK FIRE", "6DR TM Pink Fire"],
            ["2AQ TM Brown", "20Q DARK CINDER"],
            ["2DI SEAL BROWN"],
            ["33B OCHRE"],
            ["TAN PMS 720C"],
            ["71R VOLT"],
            ["3GU HYPER TURQ"],
            ["4KB DARK TURQUOISE"],
            ["87F BRIGHT CERAMIC", "87F TM BRIGHT CERAMIC"]
        ];
        
        this.loadEquivalencyRowsFromLocalStorage();
        this.loadGroupIdsFromLocalStorage();
        
        this.creatorView = null;
        this.epsView = null;
        this.developmentView = null;
        this.historyView = null;
        this.assignmentView = null;
        
        this.equivalenceMap = this.buildEquivalenceMap();
        this.groupOrder = this.buildGroupOrder();
        this.ensureGroupIds();
        
        this.init();
    }
    
    // ============================================================
    // LOGIN
    // ============================================================
    initLogin() {
        const loginContainer = document.getElementById('loginView');
        const mainApp = document.getElementById('mainApp');
        const loginBtn = document.getElementById('loginBtn');
        const loginUsername = document.getElementById('loginUsername');
        const loginPassword = document.getElementById('loginPassword');
        const loginError = document.getElementById('loginError');
        const togglePassword = document.getElementById('toggleLoginPassword');
        
        if (togglePassword) {
            togglePassword.onclick = () => {
                const type = loginPassword.getAttribute('type') === 'password' ? 'text' : 'password';
                loginPassword.setAttribute('type', type);
                togglePassword.classList.toggle('fa-eye');
                togglePassword.classList.toggle('fa-eye-slash');
            };
        }
        
        if (loginBtn) {
            loginBtn.onclick = () => {
                const username = loginUsername.value.trim();
                const password = loginPassword.value;
                
                const result = this.auth.login(username, password);
                
                if (result.success) {
                    loginError.style.display = 'none';
                    loginContainer.style.display = 'none';
                    mainApp.style.display = 'flex';
                    this.updateUIForUser();
                    this.loadSessionData();
                } else {
                    loginError.textContent = result.error;
                    loginError.style.display = 'block';
                }
            };
        }
        
        const handleEnter = (e) => {
            if (e.key === 'Enter') loginBtn.click();
        };
        loginUsername.addEventListener('keypress', handleEnter);
        loginPassword.addEventListener('keypress', handleEnter);
    }
    
    loadSessionData() {
        this.loadFromLocalStorage();
        this.loadLibraryTxtsFromLocalStorage();
        this.loadInboxFromLocalStorage();
        
        if (this.creatorView) this.creatorView.renderTable();
        if (this.epsView) this.epsView.renderPreview();
        if (this.developmentView) this.developmentView.render();
        if (this.historyView) this.historyView.render();
        if (this.assignmentView) {
            this.assignmentView.updateTxtList();
            this.assignmentView.renderHistory();
        }
        if (this.adminView) this.adminView.render();
        if (this.reportsView) {
            this.reportsView.updateFilters();
            this.reportsView.render();
        }
    }
    
    updateUIForUser() {
        const user = this.auth.getCurrentUser();
        const displaySpan = document.getElementById('currentUserDisplay');
        if (displaySpan) {
            displaySpan.textContent = `👤 ${user.username}${user.isMaster ? ' (MASTER)' : ''}`;
        }
        
        const menuItems = document.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            const requiredPerm = item.dataset.perm;
            if (requiredPerm && !this.auth.hasPermission(requiredPerm)) {
                item.style.display = 'none';
            } else {
                item.style.display = 'flex';
            }
        });
        
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.onclick = () => this.logout();
        }
    }
    
    logout() {
        this.auth.logout();
        const loginContainer = document.getElementById('loginView');
        const mainApp = document.getElementById('mainApp');
        loginContainer.style.display = 'flex';
        mainApp.style.display = 'none';
        document.getElementById('loginUsername').value = '';
        document.getElementById('loginPassword').value = '';
    }
    
    // ============================================================
    // NORMALIZACIÓN
    // ============================================================
    normalizeSpaces(str) {
        if (!str) return '';
        return str.replace(/\s+/g, ' ').trim();
    }
    
    generateGroupId(groupName) {
        let id = '';
        
        if (groupName.includes('BLACK')) id = 'BLK';
        else if (groupName.includes('WHITE')) id = 'WHT';
        else if (groupName.includes('GREY') || groupName.includes('GRAY')) id = 'GRY';
        else if (groupName.includes('ANTHRACITE')) id = 'ANT';
        else if (groupName.includes('NATURAL')) id = 'NAT';
        else if (groupName.includes('GOLD')) id = 'GLD';
        else if (groupName.includes('SILVER')) id = 'SLV';
        else if (groupName.includes('RED')) id = 'RED';
        else if (groupName.includes('MAROON')) id = 'MRN';
        else if (groupName.includes('CRIMSON')) id = 'CRM';
        else if (groupName.includes('CARDINAL')) id = 'CRD';
        else if (groupName.includes('GREEN')) id = 'GRN';
        else if (groupName.includes('OLIVE')) id = 'OLV';
        else if (groupName.includes('BLUE')) id = 'BLU';
        else if (groupName.includes('NAVY')) id = 'NVY';
        else if (groupName.includes('PURPLE')) id = 'PRP';
        else if (groupName.includes('ORCHID')) id = 'ORC';
        else if (groupName.includes('PINK')) id = 'PNK';
        else if (groupName.includes('ORANGE')) id = 'ORG';
        else if (groupName.includes('CERAMIC')) id = 'CRM';
        else if (groupName.includes('YELLOW')) id = 'YEL';
        else if (groupName.includes('BROWN')) id = 'BRN';
        else if (groupName.includes('CINDER')) id = 'CIN';
        else if (groupName.includes('TURQUOISE')) id = 'TRQ';
        else if (groupName.includes('VOLT')) id = 'VOL';
        else id = groupName.substring(0, 3).toUpperCase();
        
        const existingIds = Array.from(this.groupIds.values());
        let counter = 1;
        let finalId = id;
        while (existingIds.includes(finalId)) {
            finalId = `${id}_${counter}`;
            counter++;
        }
        
        return finalId;
    }
    
    ensureGroupIds() {
        for (const group of this.groupOrder) {
            if (group.length > 0) {
                const groupKey = group[0];
                if (!this.groupIds.has(groupKey)) {
                    this.groupIds.set(groupKey, this.generateGroupId(groupKey));
                }
            }
        }
        this.saveGroupIdsToLocalStorage();
    }
    
    saveGroupIdsToLocalStorage() {
        localStorage.setItem('alphaColorMatchGroupIds', JSON.stringify(Array.from(this.groupIds.entries())));
    }
    
    loadGroupIdsFromLocalStorage() {
        const saved = localStorage.getItem('alphaColorMatchGroupIds');
        if (saved) {
            try {
                this.groupIds = new Map(JSON.parse(saved));
            } catch(e) {
                this.groupIds = new Map();
            }
        }
    }
    
    getGroupId(groupKey) {
        return this.groupIds.get(groupKey) || groupKey.substring(0, 6).toUpperCase();
    }
    
    buildEquivalenceMap() {
        const map = new Map();
        
        for (const row of this.equivalencyRows) {
            const cleanRow = row.map(name => name ? this.normalizeSpaces(name) : '').filter(n => n);
            if (cleanRow.length === 0) continue;
            
            for (const name of cleanRow) {
                const searchKey = name.toUpperCase();
                if (!map.has(searchKey)) {
                    map.set(searchKey, []);
                }
                for (const eqName of cleanRow) {
                    if (!map.get(searchKey).includes(eqName)) {
                        map.get(searchKey).push(eqName);
                    }
                }
            }
        }
        
        return map;
    }
    
    buildGroupOrder() {
        const groups = [];
        for (const row of this.equivalencyRows) {
            const cleanRow = row.map(name => name ? this.normalizeSpaces(name) : '').filter(n => n);
            if (cleanRow.length > 0) {
                groups.push(cleanRow);
            }
        }
        return groups;
    }
    
    buildEquivalenceGroups() {
        return this.equivalenceMap;
    }
    
    getGroupKeyForColor(baseName) {
        const searchKey = baseName.toUpperCase();
        const equivalents = this.equivalenceMap.get(searchKey);
        if (equivalents && equivalents.length > 0) {
            return equivalents[0];
        }
        return baseName;
    }
    
    getAllEquivalentNamesExact(baseName) {
        const searchKey = baseName.toUpperCase();
        const equivalents = this.equivalenceMap.get(searchKey);
        if (equivalents && equivalents.length > 0) {
            return [...equivalents];
        }
        return [baseName];
    }
    
    // ============================================================
    // VALIDACIÓN DE FORMATO CMYK (CORREGIDA - MENOS ESTRICTA)
    // ============================================================
    
    validateCmykFormat(cStr, colorName, channel) {
        if (!cStr || cStr === '') {
            return { valid: false, error: `❌ ERROR: "${colorName}" - ${channel} está vacío` };
        }
        
        if (cStr.match(/\.{2,}/)) {
            return { valid: false, error: `❌ ERROR: "${colorName}" - ${channel}=${cStr} (tiene puntos de más)` };
        }
        
        const num = parseFloat(cStr);
        if (isNaN(num)) {
            return { valid: false, error: `❌ ERROR: "${colorName}" - ${channel}=${cStr} (no es un número válido)` };
        }
        
        return { valid: true };
    }
    
    // ============================================================
    // PARSEO DE ARCHIVO TXT (CORREGIDO - MÁS FLEXIBLE)
    // ============================================================
    
    parseTxtContent(content, fileType = 'primary') {
        const lines = content.split(/\r?\n/);
        let dataStarted = false;
        const records = [];
        const formatErrors = [];
        
        for (let line of lines) {
            if (line.trim() === '') continue;
            if (line.trim() === 'BEGIN_DATA') { dataStarted = true; continue; }
            if (dataStarted && line.trim() === 'END_DATA') break;
            if (!dataStarted) continue;
            
            // Patrón más flexible: acepta número seguido o no de punto
            const match = line.match(/^(\d+)\.?\s+(?:"([^"]+)"|([^\s]+))\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)/);
            if (match) {
                let rawName = match[2] || match[3];
                if (rawName) {
                    const normalizedName = this.normalizeSpaces(rawName);
                    const nk = this.extractNK(normalizedName);
                    const baseName = this.extractBaseName(normalizedName);
                    
                    const cStr = match[4];
                    const mStr = match[5];
                    const yStr = match[6];
                    const kStr = match[7];
                    
                    const cValidation = this.validateCmykFormat(cStr, normalizedName, 'C');
                    const mValidation = this.validateCmykFormat(mStr, normalizedName, 'M');
                    const yValidation = this.validateCmykFormat(yStr, normalizedName, 'Y');
                    const kValidation = this.validateCmykFormat(kStr, normalizedName, 'K');
                    
                    if (!cValidation.valid) formatErrors.push(cValidation.error);
                    if (!mValidation.valid) formatErrors.push(mValidation.error);
                    if (!yValidation.valid) formatErrors.push(yValidation.error);
                    if (!kValidation.valid) formatErrors.push(kValidation.error);
                    
                    records.push({
                        id: match[1],
                        name: normalizedName,
                        nk: nk,
                        baseName: baseName,
                        cmyk: [parseFloat(cStr), parseFloat(mStr), parseFloat(yStr), parseFloat(kStr)],
                        lab: [parseFloat(match[8]), parseFloat(match[9]), parseFloat(match[10])]
                    });
                }
            }
        }
        
        if (formatErrors.length > 0) {
            console.warn('Errores de formato:', formatErrors);
            // No bloqueamos la carga, solo mostramos advertencia
            alert(`⚠️ Advertencia: ${formatErrors.length} errores de formato encontrados.\nLos datos se cargarán igualmente.`);
        }
        
        return { records: records, corrections: [] };
    }
    
    async loadPrimaryFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            const result = this.parseTxtContent(content, 'primary');
            
            if (result.records.length === 0) {
                alert('❌ No se pudieron cargar datos del archivo principal. Verifique el formato.');
                this.updateFileInfo('primary', 'ERROR - No se cargaron datos', 0);
                return;
            }
            
            this.primaryData = result.records;
            
            this.updateFileInfo('primary', file.name, this.primaryData.length);
            this.renderDataList('primary', this.primaryData);
            this.saveToLocalStorage();
            
            alert(`✅ Archivo principal cargado: ${this.primaryData.length} colores`);
        };
        reader.onerror = (e) => {
            alert('❌ Error al leer el archivo.');
        };
        reader.readAsText(file);
    }
    
    async loadSecondaryFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            const result = this.parseTxtContent(content, 'secondary');
            
            if (result.records.length === 0) {
                alert('❌ No se pudieron cargar datos del archivo secundario. Verifique el formato.');
                this.updateFileInfo('secondary', 'ERROR - No se cargaron datos', 0);
                return;
            }
            
            this.secondaryData = result.records;
            
            this.updateFileInfo('secondary', file.name, this.secondaryData.length);
            this.renderDataList('secondary', this.secondaryData);
            this.saveToLocalStorage();
            
            alert(`✅ Archivo secundario cargado: ${this.secondaryData.length} colores`);
        };
        reader.onerror = (e) => {
            alert('❌ Error al leer el archivo.');
        };
        reader.readAsText(file);
    }
    
    saveToLocalStorage() {
        const dataToSave = {
            primaryData: this.primaryData,
            secondaryData: this.secondaryData,
            results: this.results,
            selectedPending: Array.from(this.selectedPending),
            deletedPending: Array.from(this.deletedPending),
            groupSelections: Array.from(this.groupSelections.entries()),
            manualGroupSelections: Array.from(this.manualGroupSelections)
        };
        localStorage.setItem('alphaColorMatchData', JSON.stringify(dataToSave));
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
                this.updateUIFromLoadedData();
            } catch (e) {
                console.error('Error al cargar datos:', e);
            }
        }
    }
    
    saveEquivalencyRowsToLocalStorage() {
        localStorage.setItem('alphaColorMatchEquivalencyRows', JSON.stringify(this.equivalencyRows));
    }
    
    loadEquivalencyRowsFromLocalStorage() {
        const savedRows = localStorage.getItem('alphaColorMatchEquivalencyRows');
        if (savedRows) {
            try {
                const rows = JSON.parse(savedRows);
                if (rows && rows.length > 0) {
                    this.equivalencyRows = rows;
                }
            } catch (e) {
                console.error('Error al cargar equivalencyRows:', e);
            }
        }
    }
    
    saveLibraryTxtsToLocalStorage() {
        localStorage.setItem('alphaColorMatchLibrary', JSON.stringify(this.libraryTxts));
    }
    
    loadLibraryTxtsFromLocalStorage() {
        const saved = localStorage.getItem('alphaColorMatchLibrary');
        if (saved) {
            try {
                this.libraryTxts = JSON.parse(saved);
            } catch(e) {
                this.libraryTxts = [];
            }
        }
    }
    
    addTxtToLibrary(plotter, name, content) {
        const existingIndex = this.libraryTxts.findIndex(t => t.plotter === plotter && t.name === name);
        if (existingIndex !== -1) {
            this.libraryTxts[existingIndex] = {
                plotter: parseInt(plotter),
                name: name,
                content: content,
                uploadDate: new Date().toISOString()
            };
        } else {
            this.libraryTxts.push({
                plotter: parseInt(plotter),
                name: name,
                content: content,
                uploadDate: new Date().toISOString()
            });
        }
        this.saveLibraryTxtsToLocalStorage();
        if (this.assignmentView) {
            this.assignmentView.updateTxtList();
        }
    }
    
    getTxtsByPlotter(plotter) {
        return this.libraryTxts.filter(t => t.plotter === parseInt(plotter));
    }
    
    deleteTxtFromLibrary(plotter, name) {
        const index = this.libraryTxts.findIndex(t => t.plotter === parseInt(plotter) && t.name === name);
        if (index !== -1) {
            this.libraryTxts.splice(index, 1);
            this.saveLibraryTxtsToLocalStorage();
            if (this.assignmentView) {
                this.assignmentView.updateTxtList();
            }
            return true;
        }
        return false;
    }
    
    saveInboxToLocalStorage() {
        localStorage.setItem('alphaColorMatchInbox', JSON.stringify(this.inboxItems));
    }
    
    loadInboxFromLocalStorage() {
        const saved = localStorage.getItem('alphaColorMatchInbox');
        if (saved) {
            try {
                this.inboxItems = JSON.parse(saved);
            } catch(e) {
                this.inboxItems = [];
            }
        }
    }
    
    addToInbox(filename, content, reason, plotter, colorCount) {
        const newItem = {
            id: Date.now(),
            filename: filename,
            content: content,
            user: this.currentUser,
            reason: reason,
            date: new Date().toISOString(),
            colorCount: colorCount,
            plotter: plotter,
            isRead: false
        };
        this.inboxItems.unshift(newItem);
        this.saveInboxToLocalStorage();
        return newItem;
    }
    
    getInboxItems() {
        return this.inboxItems;
    }
    
    markInboxAsRead(id) {
        const item = this.inboxItems.find(i => i.id === id);
        if (item) {
            item.isRead = true;
            this.saveInboxToLocalStorage();
            return true;
        }
        return false;
    }
    
    markInboxAsUnread(id) {
        const item = this.inboxItems.find(i => i.id === id);
        if (item) {
            item.isRead = false;
            this.saveInboxToLocalStorage();
            return true;
        }
        return false;
    }
    
    deleteFromInbox(id) {
        const index = this.inboxItems.findIndex(i => i.id === id);
        if (index !== -1) {
            this.inboxItems.splice(index, 1);
            this.saveInboxToLocalStorage();
            return true;
        }
        return false;
    }
    
    loadSecondaryFromInbox(content, filename) {
        try {
            const result = this.parseTxtContent(content, 'secondary');
            if (result.records.length === 0) return false;
            this.secondaryData = result.records;
            this.updateFileInfo('secondary', filename, this.secondaryData.length);
            this.renderDataList('secondary', this.secondaryData);
            this.saveToLocalStorage();
            return true;
        } catch (error) {
            console.error('Error al cargar desde bandeja:', error);
            return false;
        }
    }
    
    clearCache() {
        if (confirm('¿Estás seguro de que quieres limpiar toda la caché? Se perderán los datos no exportados.')) {
            localStorage.removeItem('alphaColorMatchData');
            localStorage.removeItem('alphaColorMatchEquivalencyRows');
            localStorage.removeItem('developmentColors');
            localStorage.removeItem('alphaColorMatchLibrary');
            localStorage.removeItem('alphaColorMatchInbox');
            localStorage.removeItem('alphaColorMatchGroupIds');
            this.primaryData = [];
            this.secondaryData = [];
            this.results = [];
            this.selectedPending.clear();
            this.deletedPending.clear();
            this.groupSelections.clear();
            this.manualGroupSelections.clear();
            this.libraryTxts = [];
            this.inboxItems = [];
            this.groupIds.clear();
            
            this.equivalencyRows = [
                ["00A BLACK", "03S TM Black", "03T TM BLACK", "002 BLACK"],
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
                ["87F BRIGHT CERAMIC", "87F TM BRIGHT CERAMIC"]
            ];
            this.equivalenceMap = this.buildEquivalenceMap();
            this.groupOrder = this.buildGroupOrder();
            this.ensureGroupIds();
            
            this.updateFileInfo('primary', 'Ningún archivo cargado', 0);
            this.updateFileInfo('secondary', 'Ningún archivo cargado', 0);
            this.renderDataList('primary', []);
            this.renderDataList('secondary', []);
            
            const panel = document.getElementById('resultsPanel');
            if (panel) panel.style.display = 'none';
            
            const exportBtn = document.getElementById('exportBtn');
            if (exportBtn) exportBtn.disabled = true;
            
            if (this.assignmentView) {
                this.assignmentView.updateTxtList();
                this.assignmentView.renderHistory();
            }
            
            alert('✅ Caché limpiada correctamente');
        }
    }
    
    updateUIFromLoadedData() {
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
    
    showNotification(title, message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = 'floating-notification';
        notification.innerHTML = `
            <div class="notification-content ${type}">
                <strong>${title}</strong><br>
                <span style="font-size: 0.8rem;">${message}</span>
            </div>
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 2500);
    }
    
    init() {
        if (this.auth.loadSession()) {
            document.getElementById('loginView').style.display = 'none';
            document.getElementById('mainApp').style.display = 'flex';
            this.updateUIForUser();
        } else {
            document.getElementById('loginView').style.display = 'flex';
            document.getElementById('mainApp').style.display = 'none';
        }
        
        this.bindEvents();
        this.initCreatorView();
        this.initEPSView();
        this.initDevelopmentView();
        this.initHistoryView();
        this.initAssignmentView();
        this.initAdminView();
        this.initReportsView();
        this.initViews();
        this.initLogin();
        
        const clearCacheBtn = document.getElementById('clearCacheBtn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', () => this.clearCache());
        }
        
        console.log('✅ Alpha Color Match - Versión Corregida');
        console.log('📊 Tabla de equivalencias cargada:', this.equivalencyRows.length, 'grupos');
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
    }
    
    initEPSView() {
        this.epsView = new EPSView(this);
    }
    
    initDevelopmentView() {
        this.developmentView = new DevelopmentView(this);
    }
    
    initHistoryView() {
        this.historyView = new HistoryView(this);
    }
    
    initAssignmentView() {
        this.assignmentView = new AssignmentView(this);
    }
    
    initAdminView() {
        this.adminView = new AdminView(this, this.auth);
    }
    
    initReportsView() {
        this.reportsView = new ReportsView(this);
        console.log('✅ ReportsView inicializado');
    }
    
    initViews() {
        const menuItems = document.querySelectorAll('.menu-item');
        const views = {
            comparator: document.getElementById('comparatorView'),
            history: document.getElementById('historyView'),
            creator: document.getElementById('creatorView'),
            eps: document.getElementById('epsView'),
            development: document.getElementById('developmentView'),
            assignment: document.getElementById('assignmentView'),
            reports: document.getElementById('reportsView'),
            admin: document.getElementById('adminView')
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
                this.epsView.renderPreview();
            }
            if (viewName === 'development' && this.developmentView) {
                this.developmentView.render();
            }
            if (viewName === 'history' && this.historyView) {
                this.historyView.render();
            }
            if (viewName === 'assignment' && this.assignmentView) {
                this.assignmentView.updateTxtList();
                this.assignmentView.renderHistory();
            }
            if (viewName === 'reports' && this.reportsView) {
                this.reportsView.updateFilters();
                this.reportsView.render();
            }
            if (viewName === 'admin' && this.adminView) {
                this.adminView.render();
            }
        };
        
        menuItems.forEach(item => {
            item.addEventListener('click', () => {
                const viewName = item.dataset.view;
                if (viewName && this.auth.hasPermission(viewName)) {
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
            primaryInput.addEventListener('change', (e) => this.loadPrimaryFile(e));
        }
        if (secondaryInput) {
            secondaryInput.addEventListener('change', (e) => this.loadSecondaryFile(e));
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
        this.renderResults(this.results);
        this.validateExportReady();
        this.saveToLocalStorage();
        
        const replaceBtn = document.getElementById('replaceAllSecondaryBtn');
        const originalText = replaceBtn.innerHTML;
        replaceBtn.innerHTML = `✅ REEMPLAZADOS ${groups.size} GRUPOS!`;
        replaceBtn.style.opacity = '0.7';
        setTimeout(() => {
            replaceBtn.innerHTML = originalText;
            replaceBtn.style.opacity = '1';
        }, 1500);
        
        this.showNotification('Valores actualizados', `${groups.size} grupos cambiados a valor secundario`, 'info');
    }
    
    togglePendingAdd(itemId) {
        this.selectedPending.add(itemId);
        this.deletedPending.delete(itemId);
        this.renderResults(this.results);
        this.validateExportReady();
        this.saveToLocalStorage();
    }
    
    togglePendingDelete(itemId) {
        this.selectedPending.delete(itemId);
        this.deletedPending.add(itemId);
        this.renderResults(this.results);
        this.validateExportReady();
        this.saveToLocalStorage();
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
        } else {
            exportBtn.disabled = true;
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
    
    extractNK(fullName) {
        if (!fullName) return null;
        const words = fullName.trim().split(/\s+/);
        if (words.length === 0) return null;
        
        const patterns = [
            { test: (str) => /^NK[-]?[A-Z0-9]+/i.test(str), minWords: 1, maxWords: 3 },
            { test: (str) => /^[\d\-]{4,12}$/.test(str), minWords: 1, maxWords: 1 },
            { test: (str) => /^[A-Z]{1,4}[\d]{1,4}[A-Z]{0,2}$/i.test(str) || /^[\d]{1,4}[A-Z]{1,4}$/i.test(str), minWords: 1, maxWords: 1 },
            { test: (str) => /^[A-Z][\d]{3,6}[A-Z]{0,2}$/i.test(str), minWords: 1, maxWords: 1 },
            { test: (str) => /^[\d]{3,6}[A-Z]{1,4}$/i.test(str), minWords: 1, maxWords: 1 }
        ];
        
        for (let wordCount = 1; wordCount <= 3; wordCount++) {
            if (words.length < wordCount) continue;
            const candidate = words.slice(-wordCount).join(' ');
            for (const pattern of patterns) {
                if (wordCount >= pattern.minWords && wordCount <= pattern.maxWords) {
                    if (pattern.test(candidate)) {
                        return candidate;
                    }
                }
            }
        }
        return words[words.length - 1];
    }
    
    extractBaseName(fullName) {
        if (!fullName) return '';
        const nk = this.extractNK(fullName);
        if (!nk) return this.normalizeSpaces(fullName);
        const nkPattern = new RegExp(`\\s+${nk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
        const base = fullName.replace(nkPattern, '').trim();
        return this.normalizeSpaces(base);
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
            return `<div class="data-item"><span class="nk">${nk || 'SIN NK'}</span><span class="name">${baseName}</span></div>`;
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
        this.findMatches();
        this.saveToLocalStorage();
        
        const compareBtn = document.getElementById('compareBtn');
        const originalText = compareBtn.innerHTML;
        compareBtn.innerHTML = '✅ COMPARADO!';
        compareBtn.style.opacity = '0.7';
        setTimeout(() => {
            compareBtn.innerHTML = originalText;
            compareBtn.style.opacity = '1';
        }, 1500);
        
        this.showNotification('Comparación completada', `${this.results.length} registros procesados`, 'success');
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
                fullName: color.name,
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
                fullName: color.name,
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
                const equivalentGroup = this.getAllEquivalentNamesExact(pc.baseName);
                const groupKey = equivalentGroup[0];
                if (!groups.has(groupKey)) {
                    groups.set(groupKey, { primarios: [], secundarios: [], equivalentGroup: equivalentGroup, groupKey: groupKey });
                }
                groups.get(groupKey).primarios.push(pc);
            }
            
            for (const sc of secondaryColors) {
                const equivalentGroup = this.getAllEquivalentNamesExact(sc.baseName);
                const groupKey = equivalentGroup[0];
                if (!groups.has(groupKey)) {
                    groups.set(groupKey, { primarios: [], secundarios: [], equivalentGroup: equivalentGroup, groupKey: groupKey });
                }
                groups.get(groupKey).secundarios.push(sc);
            }
            
            for (const [groupKey, group] of groups) {
                const { primarios, secundarios, equivalentGroup } = group;
                const actualGroupId = `group_${nk}_${groupCounter++}`;
                const groupDisplayId = this.getGroupId(groupKey);
                
                if (primarios.length > 0 && secundarios.length > 0) {
                    for (const primary of primarios) {
                        for (const secondary of secundarios) {
                            const isExact = primary.baseName === secondary.baseName;
                            const matchType = isExact ? 'exact' : 'equivalent';
                            results.push({
                                id: `primary_${primary.id}`,
                                groupId: actualGroupId,
                                groupDisplayId: groupDisplayId,
                                groupKey: groupKey,
                                nk: nk,
                                primaryData: { id: primary.id, baseName: primary.baseName, fullName: primary.fullName, colorData: primary.colorData },
                                secondaryData: { id: secondary.id, baseName: secondary.baseName, fullName: secondary.fullName, colorData: secondary.colorData },
                                matchType: matchType,
                                isPending: false,
                                isSelected: true,
                                equivalentGroup: equivalentGroup
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
                                groupDisplayId: groupDisplayId,
                                groupKey: groupKey,
                                nk: nk,
                                primaryData: { id: primary.id, baseName: primary.baseName, fullName: primary.fullName, colorData: primary.colorData },
                                secondaryData: null,
                                matchType: 'pending_primary',
                                isPending: true,
                                isSelected: false,
                                equivalentGroup: equivalentGroup
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
                                groupDisplayId: groupDisplayId,
                                groupKey: groupKey,
                                nk: nk,
                                primaryData: null,
                                secondaryData: { id: secondary.id, baseName: secondary.baseName, fullName: secondary.fullName, colorData: secondary.colorData },
                                matchType: 'pending_secondary',
                                isPending: true,
                                isSelected: false,
                                equivalentGroup: equivalentGroup
                            });
                            processedSecondary.add(secondary.id);
                        }
                    }
                }
            }
        }
        
        results.sort((a, b) => {
            const groupCompare = (a.groupKey || '').localeCompare(b.groupKey || '');
            if (groupCompare !== 0) return groupCompare;
            const nkCompare = a.nk.localeCompare(b.nk);
            if (nkCompare !== 0) return nkCompare;
            const nameA = a.primaryData?.fullName || a.secondaryData?.fullName || '';
            const nameB = b.primaryData?.fullName || b.secondaryData?.fullName || '';
            return nameA.localeCompare(nameB);
        });
        
        this.results = results;
        this.renderResults(results);
        this.validateExportReady();
        
        console.log('📊 Comparación completada:', results.length, 'resultados');
        console.log('📋 Grupos de equivalencia usados:', this.equivalenceMap.size);
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
        `;
        
        tbody.innerHTML = results.map(item => {
            let rowClass = '';
            let statusClass = '';
            let statusText = '';
            let actionButton = '';
            let selectionButtons = '';
            let cmykPreview = '';
            
            const groupBadge = item.groupDisplayId ? `<span style="display:inline-block; background:rgba(0,229,255,0.2); color:#00e5ff; padding:0.1rem 0.4rem; border-radius:0.25rem; font-size:0.6rem; margin-right:0.5rem;">${item.groupDisplayId}</span>` : '';
            
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
                        <button class="selection-btn ${currentSelection === 'primary' ? 'active-primary' : ''}" onclick="window.app.setGroupSelection('${item.groupId}', 'primary')">📁 Principal<br><span class="cmyk-small">C:${item.primaryData?.colorData.cmyk[0].toFixed(1)} M:${item.primaryData?.colorData.cmyk[1].toFixed(1)} Y:${item.primaryData?.colorData.cmyk[2].toFixed(1)} K:${item.primaryData?.colorData.cmyk[3].toFixed(1)}</span></button>
                        <button class="selection-btn ${currentSelection === 'secondary' ? 'active-secondary' : ''}" onclick="window.app.setGroupSelection('${item.groupId}', 'secondary')">🔄 Secundario<br><span class="cmyk-small">C:${item.secondaryData?.colorData.cmyk[0].toFixed(1)} M:${item.secondaryData?.colorData.cmyk[1].toFixed(1)} Y:${item.secondaryData?.colorData.cmyk[2].toFixed(1)} K:${item.secondaryData?.colorData.cmyk[3].toFixed(1)}</span></button>
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
                        <button class="small-btn btn-success" onclick="window.app.togglePendingAdd('${item.id}')" ${isAdded ? 'disabled style="opacity:0.5;"' : ''}>➕ Agregar</button>
                        <button class="small-btn btn-danger" onclick="window.app.togglePendingDelete('${item.id}')" ${isDeleted ? 'disabled style="opacity:0.5;"' : ''}>🗑️ Eliminar</button>
                    </div>
                `;
                const colorData = item.primaryData?.colorData || item.secondaryData?.colorData;
                if (colorData) {
                    cmykPreview = `<div style="font-size:0.65rem; color:#9ca3af; margin-top:0.25rem;">CMYK: ${colorData.cmyk.map(v => v.toFixed(1)).join(', ')}</div>`;
                }
            }
            
            const primaryName = item.primaryData ? (item.primaryData.fullName || item.primaryData.baseName) : '—';
            const secondaryName = item.secondaryData ? (item.secondaryData.fullName || item.secondaryData.baseName) : '—';
            const primaryCmyk = item.primaryData?.colorData?.cmyk;
            const secondaryCmyk = item.secondaryData?.colorData?.cmyk;
            
            return `
                <tr ${rowClass}>
                    <td>${groupBadge}<strong>${item.nk}</strong>${cmykPreview}</td>
                    <td>${primaryName}<br>${primaryCmyk ? `<span class="cmyk-small">C:${primaryCmyk[0].toFixed(1)} M:${primaryCmyk[1].toFixed(1)} Y:${primaryCmyk[2].toFixed(1)} K:${primaryCmyk[3].toFixed(1)}</span>` : ''}</td>
                    <td>${secondaryName}<br>${secondaryCmyk ? `<span class="cmyk-small">C:${secondaryCmyk[0].toFixed(1)} M:${secondaryCmyk[1].toFixed(1)} Y:${secondaryCmyk[2].toFixed(1)} K:${secondaryCmyk[3].toFixed(1)}</span>` : ''}</td>
                    <td><span class="${statusClass}">${statusText}</span></td>
                    <td>${selectionButtons || actionButton || '—'}</td>
                </tr>
            `;
        }).join('');
    }
    
    expandWithAllEquivalentsByNK(exportItems) {
        const itemsByGroup = new Map();
        
        for (const item of exportItems) {
            const nk = this.extractNK(item.name);
            if (!nk) continue;
            
            const baseName = this.extractBaseName(item.name);
            const groupKey = this.getGroupKeyForColor(baseName);
            
            if (!itemsByGroup.has(groupKey)) {
                itemsByGroup.set(groupKey, []);
            }
            itemsByGroup.get(groupKey).push({ item, nk, baseName });
        }
        
        const expandedItems = [];
        const processedKeys = new Set();
        
        const groupOrderList = [];
        for (const group of this.groupOrder) {
            if (group.length > 0) {
                groupOrderList.push(group[0]);
            }
        }
        
        const sortedGroups = Array.from(itemsByGroup.keys()).sort((a, b) => {
            const indexA = groupOrderList.indexOf(a);
            const indexB = groupOrderList.indexOf(b);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b);
        });
        
        for (const groupKey of sortedGroups) {
            const groupItems = itemsByGroup.get(groupKey);
            
            for (const { item, nk, baseName } of groupItems) {
                const equivalentNames = this.getAllEquivalentNamesExact(baseName);
                
                for (const eqName of equivalentNames) {
                    const eqFullName = `${eqName} ${nk}`;
                    const key = `${eqFullName}|${item.cmyk.join(',')}`;
                    
                    if (!processedKeys.has(key)) {
                        processedKeys.add(key);
                        expandedItems.push({
                            name: eqFullName,
                            cmyk: [...item.cmyk],
                            lab: [...item.lab],
                            nk: nk,
                            groupKey: groupKey,
                            originalName: item.name,
                            isEquivalent: eqName !== baseName
                        });
                    }
                }
            }
        }
        
        return expandedItems;
    }
    
    buildExportItems() {
        const exportItems = [];
        const processedGroups = new Set();
        
        const sortedResults = [...this.results].sort((a, b) => {
            const groupCompare = (a.groupKey || '').localeCompare(b.groupKey || '');
            if (groupCompare !== 0) return groupCompare;
            const nkCompare = a.nk.localeCompare(b.nk);
            if (nkCompare !== 0) return nkCompare;
            const nameA = a.primaryData?.fullName || a.secondaryData?.fullName || '';
            const nameB = b.primaryData?.fullName || b.secondaryData?.fullName || '';
            return nameA.localeCompare(nameB);
        });
        
        for (const item of sortedResults) {
            if (item.matchType === 'exact' || item.matchType === 'equivalent') {
                if (processedGroups.has(item.groupId)) continue;
                processedGroups.add(item.groupId);
                const cmyk = this.getEffectiveCmyk(item.groupId, item.primaryData?.colorData, item.secondaryData?.colorData);
                const lab = this.getEffectiveLab(item.groupId, item.primaryData?.colorData, item.secondaryData?.colorData);
                if (item.primaryData) {
                    exportItems.push({ 
                        name: item.primaryData.fullName || item.primaryData.colorData.name, 
                        cmyk: cmyk, 
                        lab: lab, 
                        type: item.matchType,
                        nk: item.nk,
                        baseName: item.primaryData.baseName
                    });
                }
                if (item.matchType === 'equivalent' && item.secondaryData) {
                    const secondaryName = item.secondaryData.fullName || item.secondaryData.colorData.name;
                    const alreadyExists = exportItems.some(e => e.name === secondaryName && e.nk === item.nk);
                    if (!alreadyExists) {
                        exportItems.push({ 
                            name: secondaryName, 
                            cmyk: cmyk, 
                            lab: lab, 
                            type: item.matchType,
                            nk: item.nk,
                            baseName: item.secondaryData.baseName
                        });
                    }
                }
            }
        }
        
        for (const item of this.results) {
            if (this.selectedPending.has(item.id)) {
                if (item.primaryData) {
                    exportItems.push({ 
                        name: item.primaryData.fullName || item.primaryData.colorData.name, 
                        cmyk: [...item.primaryData.colorData.cmyk], 
                        lab: [...item.primaryData.colorData.lab], 
                        type: 'added',
                        nk: item.nk,
                        baseName: item.primaryData.baseName
                    });
                } else if (item.secondaryData) {
                    exportItems.push({ 
                        name: item.secondaryData.fullName || item.secondaryData.colorData.name, 
                        cmyk: [...item.secondaryData.colorData.cmyk], 
                        lab: [...item.secondaryData.colorData.lab], 
                        type: 'added',
                        nk: item.nk,
                        baseName: item.secondaryData.baseName
                    });
                }
            }
        }
        
        const uniqueExportItems = [];
        const seenNames = new Set();
        for (const item of exportItems) {
            const key = `${item.name}|${item.nk}`;
            if (!seenNames.has(key)) {
                seenNames.add(key);
                uniqueExportItems.push(item);
            }
        }
        
        const expandedItems = this.expandWithAllEquivalentsByNK(uniqueExportItems);
        return expandedItems;
    }
    
    generateCGATSContent(exportItems) {
        const today = new Date();
        const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
        let content = 'CGATS.17\nORIGINATOR\t"ALPHA COLOR MATCH"\nFILE_DESCRIPTOR\t""\n';
        content += `CREATED\t"${dateStr}"\nNUMBER_OF_FIELDS\t9\nBEGIN_DATA_FORMAT\nSAMPLE_ID SAMPLE_NAME CMYK_C CMYK_M CMYK_Y CMYK_K LAB_L LAB_A LAB_B\nEND_DATA_FORMAT\nNUMBER_OF_SETS\t${exportItems.length}\nBEGIN_DATA\n\n`;
        
        const finalUnique = new Map();
        for (const item of exportItems) {
            if (!finalUnique.has(item.name)) {
                finalUnique.set(item.name, item);
            }
        }
        const finalItems = Array.from(finalUnique.values());
        
        finalItems.forEach((item, index) => {
            const counter = index + 1;
            content += `${counter} "${item.name}" ${item.cmyk[0].toFixed(6)} ${item.cmyk[1].toFixed(6)} ${item.cmyk[2].toFixed(6)} ${item.cmyk[3].toFixed(6)} ${item.lab[0].toFixed(6)} ${item.lab[1].toFixed(6)} ${item.lab[2].toFixed(6)}\n`;
        });
        content += '\nEND_DATA\n';
        return content;
    }
    
    showPreviewAndExport() {
        let exportItems = this.buildExportItems();
        if (exportItems.length === 0) {
            alert('No hay datos para exportar.');
            return;
        }
        
        const originalCount = exportItems.filter(i => !i.isEquivalent).length;
        const equivalentCount = exportItems.filter(i => i.isEquivalent).length;
        
        const content = this.generateCGATSContent(exportItems);
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px; max-height: 85vh;">
                <div class="modal-header" style="background: #2d4ed6;">
                    <h3 style="color: white;">📄 Vista previa de exportación</h3>
                    <button class="modal-close" style="color: white;">&times;</button>
                </div>
                <div class="modal-body" style="overflow: auto; max-height: 65vh;">
                    <div style="margin-bottom: 1rem; padding: 0.75rem; background: #1e1e2c; border-radius: 0.5rem;">
                        <strong>📊 Resumen:</strong> ${exportItems.length} registros
                        <br><small>🎨 Originales: ${originalCount}</small>
                        <br><small style="color: #00e5ff;">✨ Complementarios: ${equivalentCount}</small>
                        <br><small style="color: #4ade80;">✅ Colores agrupados por familia</small>
                    </div>
                    <div style="font-family: monospace; font-size: 0.7rem; background: #0a0a0a; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; white-space: pre-wrap; max-height: 400px; overflow-y: auto;">
                        <pre style="margin: 0; color: #e2e8f0;">${content.substring(0, 5000)}${content.length > 5000 ? '\n...' : ''}</pre>
                    </div>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-secondary cancel-preview">Cancelar</button>
                    <button class="btn btn-primary confirm-export">✅ Exportar</button>
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
    }
    
    doExport(exportItems) {
        const expandedItems = this.expandWithAllEquivalentsByNK(exportItems);
        
        const uniqueItems = [];
        const seenNames = new Set();
        for (const item of expandedItems) {
            if (!seenNames.has(item.name)) {
                seenNames.add(item.name);
                uniqueItems.push(item);
            }
        }
        
        const content = this.generateCGATSContent(uniqueItems);
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
        
        alert(`✅ Exportado: ${uniqueItems.length} colores\n✅ Familias agrupadas`);
    }
    
    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
}

window.app = new AlphaColorMatch();