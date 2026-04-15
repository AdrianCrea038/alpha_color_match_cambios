// js/main.js
import { Auth } from './core/auth.js';
import { loadFile } from './modules/fileLoader.js';
import { validateAndCorrectRecords } from './modules/nameValidator.js';
import { compareFiles } from './modules/comparator.js';
import { renderResults } from './modules/resultsRenderer.js';
import { exportResults } from './modules/exporter.js';
import { clearAllCache, saveComparatorState, loadComparatorState } from './modules/cacheManager.js';
import { showNotification } from './core/utils.js';

// Importar vistas
import { PaletteValidatorView } from './views/paletteValidatorView.js';
import { DevelopmentView } from './views/developmentView.js';
import { HistoryView } from './views/historyView.js';
import { AssignmentView } from './views/assignmentView.js';
import { AdminView } from './views/adminView.js';
import { ReportsView } from './views/reportsView.js';

class AlphaColorMatch {
    constructor() {
        this.auth = new Auth();
        
        this.primaryData = [];
        this.secondaryData = [];
        this.results = [];
        this.selectedPending = new Set();
        this.deletedPending = new Set();
        this.groupSelections = new Map();
        this.manualGroupSelections = new Set();
        
        // Vistas
        this.paletteValidatorView = null;
        this.developmentView = null;
        this.historyView = null;
        this.assignmentView = null;
        this.adminView = null;
        this.reportsView = null;
        
        this.init();
    }
    
    async init() {
        if (!this.auth.loadSession()) {
            window.location.href = 'login.html';
            return;
        }
        
        this.updateUIForUser();
        this.loadSavedState();
        this.initViews();
        this.initMenuNavigation();
        this.bindEvents();
        
        window.selectGroup = (groupId, source) => this.selectGroup(groupId, source);
        window.togglePendingAdd = (itemId) => this.togglePendingAdd(itemId);
        window.togglePendingDelete = (itemId) => this.togglePendingDelete(itemId);
        
        if (this.primaryData.length > 0) {
            this.renderDataList('primary', this.primaryData);
            this.updateFileInfo('primary', 'Datos cargados desde caché', this.primaryData.length);
        }
        if (this.secondaryData.length > 0) {
            this.renderDataList('secondary', this.secondaryData);
            this.updateFileInfo('secondary', 'Datos cargados desde caché', this.secondaryData.length);
        }
        if (this.results.length > 0) {
            renderResults(this.results, this.groupSelections, this.selectedPending, this.deletedPending);
            this.validateExportReady();
        }
        
        console.log('✅ Alpha Color Match iniciado');
    }
    
    loadSavedState() {
        const saved = loadComparatorState();
        if (saved) {
            this.primaryData = saved.primaryData;
            this.secondaryData = saved.secondaryData;
            this.results = saved.results;
            this.selectedPending = saved.selectedPending;
            this.deletedPending = saved.deletedPending;
            this.groupSelections = saved.groupSelections;
            this.manualGroupSelections = saved.manualGroupSelections;
        }
    }
    
    saveCurrentState() {
        saveComparatorState(
            this.primaryData, this.secondaryData, this.results,
            this.selectedPending, this.deletedPending,
            this.groupSelections, this.manualGroupSelections
        );
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
        
        const adminBtn = document.getElementById('adminBtn');
        if (adminBtn) {
            adminBtn.onclick = () => window.open('admin.html', '_blank');
        }
        
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.onclick = () => this.logout();
    }
    
    logout() {
        this.auth.logout();
        window.location.href = 'login.html';
    }
    
    bindEvents() {
        const primaryInput = document.getElementById('primaryFileInput');
        const secondaryInput = document.getElementById('secondaryFileInput');
        const compareBtn = document.getElementById('compareBtn');
        const exportBtn = document.getElementById('exportBtn');
        const replaceAllSecondaryBtn = document.getElementById('replaceAllSecondaryBtn');
        const clearCacheBtn = document.getElementById('clearCacheBtn');
        
        if (primaryInput) primaryInput.addEventListener('change', (e) => this.loadPrimaryFile(e));
        if (secondaryInput) secondaryInput.addEventListener('change', (e) => this.loadSecondaryFile(e));
        if (compareBtn) compareBtn.addEventListener('click', () => this.compareFiles());
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportFiles());
        if (replaceAllSecondaryBtn) replaceAllSecondaryBtn.addEventListener('click', () => this.replaceAllWithSecondary());
        if (clearCacheBtn) clearCacheBtn.addEventListener('click', () => this.clearCache());
    }
    
    async loadPrimaryFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        console.log('📁 Cargando archivo principal:', file.name);
        
        try {
            const { records, fileName } = await loadFile(file);
            console.log('📊 Registros parseados:', records.length);
            
            let correctionsApplied = 0;
            
            const onCorrection = (oldName, newName, reason) => {
                correctionsApplied++;
                console.log(`✏️ Corrección ${correctionsApplied}: "${oldName}" → "${newName}" (Motivo: ${reason})`);
                this.saveCorrectionHistory(oldName, newName, reason);
            };
            
            const result = await validateAndCorrectRecords(records, 'primary', onCorrection);
            
            if (result.records.length === 0) {
                alert('❌ No se pudieron cargar los datos del archivo principal.');
                return;
            }
            
            this.primaryData = result.records;
            this.updateFileInfo('primary', fileName, this.primaryData.length);
            this.renderDataList('primary', this.primaryData);
            this.saveCurrentState();
            
            if (correctionsApplied > 0) {
                alert(`✅ Archivo principal cargado: ${this.primaryData.length} colores\n✏️ Correcciones aplicadas: ${correctionsApplied}`);
            } else {
                alert(`✅ Archivo principal cargado: ${this.primaryData.length} colores`);
            }
        } catch (error) {
            console.error('❌ Error:', error);
            alert(`❌ Error al cargar archivo principal: ${error.message || error}`);
        }
    }
    
    async loadSecondaryFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        console.log('📁 Cargando archivo secundario:', file.name);
        
        try {
            const { records, fileName } = await loadFile(file);
            console.log('📊 Registros parseados:', records.length);
            
            let correctionsApplied = 0;
            
            const onCorrection = (oldName, newName, reason) => {
                correctionsApplied++;
                console.log(`✏️ Corrección ${correctionsApplied}: "${oldName}" → "${newName}" (Motivo: ${reason})`);
                this.saveCorrectionHistory(oldName, newName, reason);
            };
            
            const result = await validateAndCorrectRecords(records, 'secondary', onCorrection);
            
            if (result.records.length === 0) {
                alert('❌ No se pudieron cargar los datos del archivo secundario.');
                return;
            }
            
            this.secondaryData = result.records;
            this.updateFileInfo('secondary', fileName, this.secondaryData.length);
            this.renderDataList('secondary', this.secondaryData);
            this.saveCurrentState();
            
            if (correctionsApplied > 0) {
                alert(`✅ Archivo secundario cargado: ${this.secondaryData.length} colores\n✏️ Correcciones aplicadas: ${correctionsApplied}`);
            } else {
                alert(`✅ Archivo secundario cargado: ${this.secondaryData.length} colores`);
            }
        } catch (error) {
            console.error('❌ Error:', error);
            alert(`❌ Error al cargar archivo secundario: ${error.message || error}`);
        }
    }
    
    compareFiles() {
        if (this.primaryData.length === 0) {
            alert('⚠️ Cargue archivo principal primero.');
            return;
        }
        if (this.secondaryData.length === 0) {
            alert('⚠️ Cargue archivo secundario primero.');
            return;
        }
        
        console.log('🔍 Comparando archivos...');
        console.log('Primary:', this.primaryData.length, 'colores');
        console.log('Secondary:', this.secondaryData.length, 'colores');
        
        this.selectedPending.clear();
        this.deletedPending.clear();
        this.groupSelections.clear();
        this.manualGroupSelections.clear();
        
        this.results = compareFiles(this.primaryData, this.secondaryData);
        console.log('📊 Resultados:', this.results.length);
        
        renderResults(this.results, this.groupSelections, this.selectedPending, this.deletedPending);
        this.validateExportReady();
        this.saveCurrentState();
        
        showNotification('Comparación completada', `${this.results.length} registros procesados`, 'success');
    }
    
    selectGroup(groupId, source) {
        this.groupSelections.set(groupId, source);
        this.manualGroupSelections.add(groupId);
        renderResults(this.results, this.groupSelections, this.selectedPending, this.deletedPending);
        this.validateExportReady();
        this.saveCurrentState();
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
        renderResults(this.results, this.groupSelections, this.selectedPending, this.deletedPending);
        this.validateExportReady();
        this.saveCurrentState();
        
        const replaceBtn = document.getElementById('replaceAllSecondaryBtn');
        const originalText = replaceBtn.innerHTML;
        replaceBtn.innerHTML = `✅ REEMPLAZADOS ${groups.size} GRUPOS!`;
        replaceBtn.style.opacity = '0.7';
        setTimeout(() => {
            replaceBtn.innerHTML = originalText;
            replaceBtn.style.opacity = '1';
        }, 1500);
        
        showNotification('Valores actualizados', `${groups.size} grupos cambiados a valor secundario`, 'info');
    }
    
    togglePendingAdd(itemId) {
        if (this.selectedPending.has(itemId)) return;
        this.selectedPending.add(itemId);
        this.deletedPending.delete(itemId);
        renderResults(this.results, this.groupSelections, this.selectedPending, this.deletedPending);
        this.validateExportReady();
        this.saveCurrentState();
    }
    
    togglePendingDelete(itemId) {
        if (this.deletedPending.has(itemId)) return;
        this.deletedPending.add(itemId);
        this.selectedPending.delete(itemId);
        renderResults(this.results, this.groupSelections, this.selectedPending, this.deletedPending);
        this.validateExportReady();
        this.saveCurrentState();
    }
    
    validateExportReady() {
        const exportBtn = document.getElementById('exportBtn');
        if (!exportBtn) return;
        
        const pendingUndecided = this.results.filter(item => 
            (item.matchType === 'pending_primary' || item.matchType === 'pending_secondary') && 
            !this.selectedPending.has(item.id) && 
            !this.deletedPending.has(item.id)
        );
        
        const isReady = pendingUndecided.length === 0;
        exportBtn.disabled = !isReady;
        
        const validationMsg = document.getElementById('validationMessage');
        if (validationMsg) {
            if (pendingUndecided.length > 0) {
                validationMsg.innerHTML = `⚠️ Faltan ${pendingUndecided.length} colores pendientes por decidir (Agregar o Eliminar)`;
                validationMsg.style.display = 'block';
            } else {
                validationMsg.style.display = 'none';
            }
        }
    }
    
    exportFiles() {
        const success = exportResults(
            this.results, this.groupSelections, this.selectedPending, this.deletedPending,
            this.primaryData, this.secondaryData
        );
        if (success) this.saveCurrentState();
    }
    
    clearCache() {
        if (confirm('¿Estás seguro de que quieres limpiar toda la caché? Se perderán los datos no exportados.')) {
            clearAllCache();
            this.primaryData = [];
            this.secondaryData = [];
            this.results = [];
            this.selectedPending.clear();
            this.deletedPending.clear();
            this.groupSelections.clear();
            this.manualGroupSelections.clear();
            this.updateFileInfo('primary', 'Ningún archivo cargado', 0);
            this.updateFileInfo('secondary', 'Ningún archivo cargado', 0);
            this.renderDataList('primary', []);
            this.renderDataList('secondary', []);
            document.getElementById('resultsPanel').style.display = 'none';
            document.getElementById('exportBtn').disabled = true;
            alert('✅ Caché limpiada correctamente');
        }
    }
    
    saveCorrectionHistory(oldName, newName, reason) {
        let corrections = [];
        const history = localStorage.getItem('nameCorrectionHistory');
        if (history) {
            try { corrections = JSON.parse(history); } catch(e) {}
        }
        const currentUser = this.auth.getCurrentUser()?.username || 'usuario';
        corrections.unshift({
            id: Date.now(),
            oldName: oldName,
            newName: newName,
            reason: reason,
            user: currentUser,
            date: new Date().toISOString()
        });
        if (corrections.length > 100) corrections = corrections.slice(0, 100);
        localStorage.setItem('nameCorrectionHistory', JSON.stringify(corrections));
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
            return `<div class="data-item"><span class="nk">${color.nk || 'SIN NK'}</span><span class="name">${color.baseName}</span></div>`;
        }).join('');
    }
    
    initViews() {
        this.paletteValidatorView = new PaletteValidatorView(this);
        this.developmentView = new DevelopmentView(this);
        this.historyView = new HistoryView(this);
        this.assignmentView = new AssignmentView(this);
        this.adminView = new AdminView(this, this.auth);
        this.reportsView = new ReportsView(this);
    }
    
    initMenuNavigation() {
        const menuItems = document.querySelectorAll('.menu-item');
        const views = {
            comparator: document.getElementById('comparatorView'),
            history: document.getElementById('historyView'),
            paletteValidator: document.getElementById('paletteValidatorView'),
            development: document.getElementById('developmentView'),
            assignment: document.getElementById('assignmentView'),
            reports: document.getElementById('reportsView'),
            admin: document.getElementById('adminView')
        };
        
        const switchView = (viewName) => {
            Object.values(views).forEach(view => {
                if (view) view.classList.remove('active');
            });
            if (views[viewName]) views[viewName].classList.add('active');
            
            menuItems.forEach(item => {
                item.classList.remove('active');
                if (item.dataset.view === viewName) item.classList.add('active');
            });
            
            if (viewName === 'paletteValidator' && this.paletteValidatorView) {
                this.paletteValidatorView.renderTable();
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
}

new AlphaColorMatch();