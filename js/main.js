// js/main.js
import { Auth } from './core/auth.js';
import { loadFile, parseTxtContent } from './modules/fileLoader.js';
import { validateAndCorrectRecords, setAppInstance, ensureValidColorCatalogLoaded } from './modules/nameValidator.js';
import { compareFiles as compareLogic } from './modules/comparator.js';
import { renderResults as renderResultsUI } from './modules/resultsRenderer.js';
import { exportResults } from './modules/exporter.js';
import { clearAllCache, saveComparatorState, loadComparatorState } from './modules/cacheManager.js';
import { showNotification, escapeHtml } from './core/utils.js';
import { findDuplicateGroups, showDuplicateModal } from './modules/duplicateHandler.js';
import { showFusionWizard } from './modules/fusionWizard.js';
import { initAuditHandler } from './modules/auditHandler.js';

// Hacer globales para acceso desde otros módulos y eventos inline
window.showNotification = showNotification;
window.escapeHtml = escapeHtml;
window.FileLoader = {
    parseTxt: parseTxtContent,
    loadFile: loadFile
};

// Importar vistas
import { PaletteValidatorView } from './views/paletteValidatorView.js';
import { DevelopmentView } from './views/developmentView.js';
import { HistoryView } from './views/historyView.js';
import { AssignmentView } from './views/assignmentView.js';
import { AdminView } from './views/adminView.js';
import { ReportsView } from './views/reportsView.js';
import { DashboardView } from './views/dashboardView.js';
import { CyclicHubView } from './views/cyclicHubView.js';
import { supabase, getAllMasterNks, getCustomValidColorNames } from './core/supabaseClient.js';

class AlphaColorMatch {
    constructor() {
        window.app = this;
        this.auth = new Auth();
        
        this.primaryData = [];
        this.secondaryData = [];
        this.primaryFileName = '';
        this.secondaryFileName = '';
        this.results = [];
        this.selectedPending = new Set();
        this.deletedPending = new Set();
        this.groupSelections = new Map();
        this.manualGroupSelections = new Set();
        this.inboxItems = [];
        this.pendingAudit = new Map(); // [id] -> record con errores
        
        // Vistas
        this.paletteValidatorView = null;
        this.developmentView = null;
        this.historyView = null;
        this.assignmentView = null;
        this.adminView = null;
        this.reportsView = null;
        this.dashboardView = null;
        this.cyclicHubView = null;

        // Inicializar el validador con la instancia de la app
        setAppInstance(this);
        initAuditHandler(this);
        
        this.init();
        window.app = this;
    }
    
    async init() {
        if (!this.auth.loadSession()) {
            window.location.href = 'login.html';
            return;
        }
        
        this.updateUIForUser();
        this.loadSavedState();
        await this.loadMasterData();
        this.initViews();
        this.initMenuNavigation();

        this.bindEvents();
        await this.loadInbox();
        
        // RECUPERAR VISTA GUARDADA
        const lastView = localStorage.getItem('currentView') || 'dashboard';
        if (this.switchView) this.switchView(lastView);
        
        // ACTIVAR SINCRONIZACIÓN EN TIEMPO REAL
        this.setupRealtimeSync();

        // ACTIVAR BACKUP PROGRAMADO (5:40 PM)
        this.initScheduledBackup();
        

        window.selectGroup = (groupId, source) => this.selectGroup(groupId, source);
        window.togglePendingAdd = (itemId) => this.togglePendingAdd(itemId);
        window.togglePendingDelete = (itemId) => this.togglePendingDelete(itemId);
        
        if (this.primaryData.length > 0) {
            this.renderDataList('primary', this.primaryData);
            this.updateFileInfo('primary', this.primaryFileName || 'Archivo Recuperado', this.primaryData.length);
        }
        if (this.secondaryData.length > 0) {
            this.renderDataList('secondary', this.secondaryData);
            this.updateFileInfo('secondary', this.secondaryFileName || 'Archivo Recuperado', this.secondaryData.length);
        }
        if (this.results.length > 0) {
            this.renderResults(this.results, this.groupSelections, this.selectedPending, this.deletedPending);
            this.validateExportReady();
        }
        
        console.log('✅ Alpha Color Match iniciado');
    }

    async loadMasterData() {
        try {
            // Sincronizar catálogos y EQUIVALENCIAS desde DB (Supabase)
            console.log('📡 Sincronizando catálogos maestros y equivalencias...');
            await ensureValidColorCatalogLoaded();
            
            // Cargar NKs maestros (Fallback/Seguridad)
            window.ALL_MASTER_NKS = await getAllMasterNks();
            
            // NUEVO: Cargar todos los registros maestros (CMYK) para referencia en auditoría
            try {
                const { getTxtVersions } = await import('./core/supabaseClient.js');
                const versions = await getTxtVersions();
                const activeTxts = versions.filter(v => v.activo);
                let allMaster = [];
                const { parseTxtContent } = await import('./modules/fileLoader.js');
                
                for (const txt of activeTxts) {
                    const records = parseTxtContent(txt.contenido);
                    if (records.length > 0) {
                        allMaster = allMaster.concat(records);
                        console.log(`📦 Cargados ${records.length} colores de: ${txt.nombre}`);
                    } else {
                        console.warn(`⚠️ El archivo maestro "${txt.nombre}" devolvió 0 registros. Posible error de formato.`);
                    }
                }
                window.ALL_MASTER_RECORDS = allMaster;
                console.log(`✅ TOTAL: ${allMaster.length} registros maestros en memoria.`);
            } catch (e) {
                console.warn('⚠️ No se pudieron cargar los registros maestros para referencia:', e);
            }

            console.log('✅ Catálogos sincronizados desde Supabase');
        } catch (error) {
            console.error('Error al sincronizar catálogos:', error);
            window.ALL_MASTER_NKS = [];
            window.ALL_VALID_COLOR_NAMES = [];
        }
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
            this.primaryFileName = saved.primaryFileName || '';
            this.secondaryFileName = saved.secondaryFileName || '';
        }
    }
    
    saveCurrentState() {
        saveComparatorState(
            this.primaryData, this.secondaryData, this.results,
            this.selectedPending, this.deletedPending,
            this.groupSelections, this.manualGroupSelections,
            this.primaryFileName, this.secondaryFileName
        );
    }
    
    updateUIForUser() {
        const user = this.auth.getCurrentUser();
        const displaySpan = document.getElementById('currentUserDisplay');
        if (displaySpan) {
            displaySpan.textContent = `👤 ${user.username}${user.isMaster ? ' (MASTER)' : ''}`;
        }

        this.ensureInboxBell();
        
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
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportFiles());
        if (replaceAllSecondaryBtn) replaceAllSecondaryBtn.addEventListener('click', () => this.replaceAllWithSecondary());
        if (clearCacheBtn) clearCacheBtn.addEventListener('click', () => this.clearCache());
        
        const keepAllMasterBtn = document.getElementById('keepAllMasterBtn');
        const addAllSecBtn = document.getElementById('addAllSecondaryBtn');

        
        if (addAllSecBtn) {
            addAllSecBtn.onclick = () => this.addAllPendingItems();
        }

        // Eventos de Colapso Unificado (Triángulo)
        const toggleBtn = document.getElementById('toggleDataGridBtn');
        const container = document.getElementById('dataGridContainer');
        console.log('🔍 Buscando elementos de toggle:', { toggleBtn: !!toggleBtn, container: !!container });
        
        if (toggleBtn && container) {
            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('📐 Toggling data grid state...');
                container.classList.toggle('collapsed');
                toggleBtn.classList.toggle('collapsed');
                
                // Forzar reflow para asegurar que la animación se dispare
                void container.offsetHeight;
            });
        } else {
            console.error('❌ No se encontró toggleBtn o dataGridContainer');
        }
    }


    keepAllMasterItems() {
        if (!this.results || this.results.length === 0) return;
        
        let count = 0;
        for (const item of this.results) {
            if (item.matchType === 'pending_primary') {
                this.selectedPending.add(item.id);
                this.deletedPending.delete(item.id);
                count++;
            }
        }
        
        renderResults(this.results, this.groupSelections, this.selectedPending, this.deletedPending);
        this.validateExportReady();
        window.showNotification('Acción Masiva', `Se conservarán ${count} colores del archivo Master.`, 'success');
    }
    
    addAllPendingItems() {
        if (!this.results || this.results.length === 0) return;
        
        const btn = document.getElementById('addAllSecondaryBtn');
        let count = 0;

        for (const item of this.results) {
            if (item.matchType === 'pending_primary' || item.matchType === 'pending_secondary') {
                if (!this.selectedPending.has(item.id)) {
                    this.selectedPending.add(item.id);
                    this.deletedPending.delete(item.id);
                    count++;
                }
            }
        }
        
        // Feedback visual
        if (btn) {
            btn.innerHTML = '<i class="fas fa-check-circle"></i> ¡TODO AGREGADO! (' + count + ')';
            btn.style.background = '#059669';
            btn.style.transform = 'scale(1.05)';
            
            setTimeout(() => {
                btn.style.transform = '';
                this.renderResults();
            }, 600);
        } else {
            this.renderResults();
        }
        
        this.validateExportReady();
        window.showNotification('Acción Masiva', `Se agregaron ${count} colores (Master + Secundario) satisfactoriamente.`, 'success');
    }

    async loadPrimaryFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            // ELIMINADA CARGA RÁPIDA: Todo archivo debe ser validado estrictamente
            const result = await this.processFileWithValidation(file, 'primary');

            if (result) {
                this.primaryData = result.records;
                this.primaryFileName = result.fileName;
                this.updateFileInfo('primary', result.fileName, this.primaryData.length);
                this.renderDataList('primary', this.primaryData);
                this.saveCurrentState();
                
                window.showNotification('Archivo Cargado', `Master: ${this.primaryData.length} registros.`, 'success');
                
                // Comparación automática
                if (this.secondaryData.length > 0) this.compareFiles();
            }
        } catch (error) {
            console.error('❌ Error:', error);
            alert(`❌ Error al cargar archivo principal: ${error.message || error}`);
        }
    }
    
    async loadSecondaryFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            // El secundario SIEMPRE se valida estrictamente en ambos modos
            const result = await this.processFileWithValidation(file, 'secondary');
            if (result) {
                this.secondaryData = result.records;
                this.secondaryFileName = result.fileName;
                this.updateFileInfo('secondary', result.fileName, this.secondaryData.length);
                this.renderDataList('secondary', this.secondaryData);
                
                this.saveCurrentState();
                window.showNotification('Archivo de Cambios Cargado', `Listo: ${this.secondaryData.length} registros validados.`, 'success');
                
                // Comparación automática
                if (this.primaryData.length > 0) this.compareFiles();
            }
        } catch (error) {
            console.error('❌ Error:', error);
            alert(`❌ Error al cargar archivo secundario: ${error.message || error}`);
        }
    }

    async processFileWithValidation(file, fileType) {
        console.log(`📁 Procesando archivo ${fileType}: ${file.name}`);
        const { records: rawRecords, fileName } = await loadFile(file, true); 
        
        // 1. Calcular sugerencia de NK
        const nkCounts = {};
        rawRecords.forEach(r => {
            if (r.nk) {
                const cleanNk = (r.nk || '').trim().toUpperCase();
                nkCounts[cleanNk] = (nkCounts[cleanNk] || 0) + 1;
            }
        });
        const suggestedNk = Object.entries(nkCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

        // 2. Detectar problemas
        const duplicateGroups = findDuplicateGroups(rawRecords);
        const hasParentheses = rawRecords.some(r => /\([^)]*\)/.test(r.name)); 
        const masterNks = (window.ALL_MASTER_NKS || []).map(n => n.toUpperCase());
        const hasMissingNks = rawRecords.some(r => !r.nk || (masterNks.length > 0 && !masterNks.includes(r.nk.toUpperCase())));

        if (duplicateGroups.length > 0 || hasParentheses || hasMissingNks) {
            window.showNotification('Auditoría de Archivo', `Se detectaron problemas en ${fileType}.`, 'info');
        }

        let currentRecords = [...rawRecords];
        let duplicatesResolved = 0;

        // 3. Resolver Duplicados
        if (duplicateGroups.length > 0) {
            const indicesToRemove = await showDuplicateModal(duplicateGroups);
            if (indicesToRemove.length > 0) {
                currentRecords = currentRecords.filter((_, idx) => !indicesToRemove.includes(idx));
                duplicatesResolved = duplicateGroups.length;
            }
        }

        // 4. Auditoría Interactiva (Ventana Emergente)
        const validationResult = await validateAndCorrectRecords(currentRecords, fileType, { silent: false });
        
        if (validationResult.cancelled) {
            this.clearFile(fileType);
            return;
        }
        
        // Limpiar auditorías anteriores para este archivo
        for (const [id, rec] of this.pendingAudit.entries()) {
            if (rec._fileType === fileType) this.pendingAudit.delete(id);
        }
        
        currentRecords = validationResult.records;
        if (currentRecords.length === 0) {
            this.clearFile(fileType);
            return;
        }

        // 5. RE-VALIDACIÓN DE DUPLICADOS (Crucial después de las correcciones de nombres)
        let finalDuplicateGroups = findDuplicateGroups(currentRecords);
        while (finalDuplicateGroups.length > 0) {
            window.showNotification('Duplicados Detectados', 'Las correcciones de nombre generaron duplicados o ya existían en el archivo. Por favor, resuélvalos para continuar.', 'warning');
            const indicesToRemove = await showDuplicateModal(finalDuplicateGroups);
            
            if (indicesToRemove.length > 0) {
                currentRecords = currentRecords.filter((_, idx) => !indicesToRemove.includes(idx));
                duplicatesResolved += indicesToRemove.length;
                // Volver a buscar por si quedaron más (el usuario pudo elegir mal)
                finalDuplicateGroups = findDuplicateGroups(currentRecords);
            } else {
                // Si el usuario cierra sin elegir, rompemos el bucle pero ya se le avisó
                break;
            }
        }

        return {
            records: currentRecords,
            fileName,
            correctionsApplied: validationResult.correctionsApplied || 0,
            duplicatesResolved,
            totalOriginal: rawRecords.length
        };
    }
    
    renderResults() {
        renderResultsUI(this.results, this.groupSelections, this.selectedPending, this.deletedPending);
    }

    async compareFiles() {
        if (this.primaryData.length === 0) {
            alert('⚠️ Cargue archivo principal primero.');
            return;
        }
        if (this.secondaryData.length === 0) {
            alert('⚠️ Cargue archivo secundario primero.');
            return;
        }
        
        console.log('🔍 Comparando archivos...');
        
        this.selectedPending.clear();
        this.deletedPending.clear();
        this.groupSelections.clear();
        this.manualGroupSelections.clear();
        
        this.results = compareLogic(this.primaryData, this.secondaryData);
        
        // --- AUDITORÍA FINAL: AUTO-AGREGAR MAESTRO ---
        // Si el color está en el principal pero no en el secundario, 
        // se agrega solo para no obligar al usuario a hacer miles de clics.
        this.results.forEach(item => {
            if (item.matchType === 'pending_primary') {
                this.selectedPending.add(item.id);
            }
        });
        // ---------------------------------------------

        this.logComparisonSession();
        this.renderResults();
        this.validateExportReady();
        this.saveCurrentState();
        
        window.showNotification('Proceso completado', `${this.results.length} registros listos.`, 'success');
    }
    
    selectGroup(groupId, source) {
        this.groupSelections.set(groupId, source);
        this.manualGroupSelections.add(groupId);
        this.renderResults();
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
        this.renderResults();
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
        
        window.showNotification('Valores actualizados', `${groups.size} grupos cambiados a valor secundario`, 'info');
    }
    
    togglePendingAdd(itemId) {
        if (this.selectedPending.has(itemId)) return;
        this.selectedPending.add(itemId);
        this.deletedPending.delete(itemId);
        this.renderResults();
        this.validateExportReady();
        this.saveCurrentState();
    }
    
    togglePendingDelete(itemId) {
        if (this.deletedPending.has(itemId)) return;
        this.deletedPending.add(itemId);
        this.selectedPending.delete(itemId);
        this.renderResults();
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
        
        const hasPendingAudit = this.pendingAudit.size > 0;
        const isReady = pendingUndecided.length === 0 && !hasPendingAudit;
        exportBtn.disabled = !isReady;
        
        const validationMsg = document.getElementById('validationMessage');
        if (validationMsg) {
            if (hasPendingAudit) {
                validationMsg.innerHTML = `❌ SE REQUIERE ATENCIÓN: Hay ${this.pendingAudit.size} registros con errores (Paréntesis, CMYK > 100 o NKs inválidos) que deben ser corregidos en la tabla inferior.`;
                validationMsg.style.display = 'block';
                validationMsg.style.background = 'rgba(239, 68, 68, 0.2)';
                validationMsg.style.borderColor = '#ef4444';
                validationMsg.style.color = '#f87171';
            } else if (pendingUndecided.length > 0) {
                validationMsg.innerHTML = `⚠️ Faltan ${pendingUndecided.length} colores pendientes por decidir (Agregar o Eliminar)`;
                validationMsg.style.display = 'block';
                validationMsg.style.background = 'rgba(180, 83, 9, 0.2)';
                validationMsg.style.borderColor = '#b45309';
                validationMsg.style.color = '#fbbf24';
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
        if (success) {
            this.logComparisonSession(); // Guardar estado final (colores agregados, etc)
            this.saveCurrentState();
        }
    }
    
    clearCache() {
        if (confirm('¿Estás seguro de que quieres limpiar toda la caché? Se perderán los datos no exportados.')) {
            clearAllCache();
            this.primaryData = [];
            this.secondaryData = [];
            this.primaryFileName = '';
            this.secondaryFileName = '';
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

        // Sugerir nombre de exportación basado en el archivo principal
        if (type === 'primary' && filename !== 'Ningún archivo cargado') {
            const exportNameInput = document.getElementById('exportFileName');
            if (exportNameInput) {
                // Quitar extensión .txt y limpiar caracteres raros
                const cleanName = filename.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
                exportNameInput.value = cleanName;
            }
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
        this.dashboardView = new DashboardView(this);
        this.cyclicHubView = new CyclicHubView();
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
            dashboard: document.getElementById('dashboardView'),
            admin: document.getElementById('adminView'),
            comparator: document.getElementById('comparatorView'),
            cyclicHub: document.getElementById('cyclicHubView')
        };
        
        const switchView = (viewName) => {
            console.log(`🚀 Cambiando a vista: ${viewName}`);
            localStorage.setItem('currentView', viewName);
            
            Object.values(views).forEach(view => {
                if (view) view.classList.remove('active');
            });
            if (views[viewName]) views[viewName].classList.add('active');
            
            menuItems.forEach(item => {
                item.classList.remove('active');
                if (item.dataset.view === viewName) item.classList.add('active');
            });
            
            // Removido showTaskSelectorModal de aquí para evitar que salte al refrescar
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
                this.assignmentView.loadTxtList();
                this.assignmentView.loadAssignmentsFromSupabase();
            }
            if (viewName === 'reports' && this.reportsView) {
                this.reportsView.updateFilters();
                this.reportsView.render();
            }
            if (viewName === 'assignment' && this.assignmentView) {
                this.assignmentView.loadTxtList();
                this.assignmentView.loadAssignmentsFromSupabase();
            }
            if (viewName === 'dashboard' && this.dashboardView) {
                this.dashboardView.render();
            }
            if (viewName === 'admin' && this.adminView) {
                this.adminView.render();
            }
            if (viewName === 'cyclicHub' && this.cyclicHubView) {
                this.cyclicHubView.init();
            }
            if (viewName === 'comparator') {
                 // El comparador ya se maneja por eventos globales
            }

            // Controlar visibilidad del footer de instrucciones (solo para comparador)
            const footer = document.querySelector('.footer');
            if (footer) {
                footer.style.display = (viewName === 'comparator') ? 'block' : 'none';
            }
        };
        this.switchView = switchView;
        
        menuItems.forEach(item => {
            item.addEventListener('click', () => {
                const viewName = item.dataset.view;
                const requiredPerm = item.dataset.perm;
                if (viewName && (!requiredPerm || this.auth.hasPermission(requiredPerm))) {
                    // Modal de selección eliminado - flujo directo a vista
                    switchView(viewName);
                }
            });
        });
    }

    ensureInboxBell() {
        const userInfo = document.querySelector('.header .user-info');
        if (!userInfo) return;
        if (document.getElementById('inboxBellBtn')) return;

        const bellBtn = document.createElement('button');
        bellBtn.id = 'inboxBellBtn';
        bellBtn.className = 'logout-btn';
        bellBtn.style.marginRight = '0.5rem';
        bellBtn.innerHTML = '<i class="fas fa-bell"></i> Bandeja <span id="inboxBellCount" style="margin-left:0.25rem;">0</span>';
        bellBtn.onclick = () => {
            if (this.switchView) this.switchView('history');
        };
        userInfo.insertBefore(bellBtn, userInfo.firstChild);
    }

    async loadInbox() {
        try {
            console.log('📡 Cargando bandeja desde base de datos...');
            const { data, error } = await supabase
                .from('inbox')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            this.inboxItems = data || [];
            console.log(`📥 ${this.inboxItems.length} mensajes cargados de la base de datos.`);
        } catch (e) {
            console.warn('⚠️ Error al cargar desde DB, usando respaldo local:', e);
            const raw = localStorage.getItem('alphaColorInbox');
            this.inboxItems = raw ? JSON.parse(raw) : [];
        }
        this.updateInboxBell();
    }

    async logComparisonSession() {
        const unmatched = this.results.filter(item =>
            item.matchType === 'pending_primary' || item.matchType === 'pending_secondary'
        ).length;
        
        const addedColors = Array.from(this.selectedPending).filter(id => id.startsWith('pending_secondary')).length;
        const lastCargas = JSON.parse(localStorage.getItem('lastFileLoadStats') || '{"corrections":0, "duplicates":0}');
        const totalColors = this.primaryData.length;

        const entry = {
            created_at: new Date().toISOString(),
            user: this.auth.getCurrentUser()?.username || 'usuario',
            primary_file: this.primaryFileName || 'principal',
            secondary_file: this.secondaryFileName || 'secundario',
            total_colors: totalColors,
            unmatched: unmatched,
            added_colors: addedColors,
            corrections: lastCargas.corrections || 0,
            duplicates: lastCargas.duplicates || 0,
            invalid_cmyk: lastCargas.invalidCmyk || 0
        };

        // 1. Guardar en Supabase para Reportes Reales
        try {
            const { error } = await supabase.from('comparison_logs').insert(entry);
            if (error) throw error;
            console.log('✅ Auditoría guardada en la nube');
        } catch (e) {
            console.warn('⚠️ No se pudo guardar en DB, usando LocalStorage:', e.message);
        }

        // 2. Respaldo en LocalStorage (Legacy)
        let logs = [];
        try {
            logs = JSON.parse(localStorage.getItem('comparisonReportLogs') || '[]');
        } catch (e) {
            logs = [];
        }
        logs.unshift({ ...entry, id: `cmp_${Date.now()}`, primaryFile: entry.primary_file });
        if (logs.length > 2000) logs = logs.slice(0, 2000);
        localStorage.setItem('comparisonReportLogs', JSON.stringify(logs));
    }

    async saveInbox() {
        // En el nuevo sistema, el guardado es individual por mensaje en addToInbox
        // pero mantenemos esto para guardar la caché local como respaldo
        localStorage.setItem('alphaColorInbox', JSON.stringify(this.inboxItems));
    }

    getInboxItems() {
        return [...this.inboxItems].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }


    updateInboxBell() {
        const count = this.inboxItems.filter(item => !item.is_read && !item.read).length;
        const bellCount = document.getElementById('inboxBellCount');
        if (bellCount) bellCount.textContent = String(count);
        const menuHistory = document.querySelector('.menu-item[data-view="history"] span');
        if (menuHistory) menuHistory.textContent = count > 0 ? `Bandeja (${count})` : 'Bandeja';
    }

    async addToInbox(fileName, content, reason, plotter, colorCount, extra = {}) {
        const currentUser = this.auth.getCurrentUser()?.username || 'usuario';
        const item = {
            subject: fileName,
            content,
            reason,
            plotter,
            color_count: colorCount,
            created_by: currentUser,
            created_at: new Date().toISOString(),
            is_read: false,
            assignment_id: extra.assignmentId || null
        };

        try {
            // Intentar guardar en base de datos
            const { error } = await supabase.from('inbox').insert(item);
            if (error) throw error;
            console.log('✅ Mensaje guardado en base de datos.');
        } catch (e) {
            console.error('❌ Error guardando en base de datos, guardando localmente:', e);
            // Fallback local
            item.id = `inbox_${Date.now()}`;
            this.inboxItems.unshift(item);
            this.saveInbox();
        }

        // Recargar para ver el cambio
        await this.loadInbox();
        
        if (this.historyView?.render) this.historyView.render();
        if (this.switchView) this.switchView('history');
    }

    async markInboxAsRead(id, read = true) {
        try {
            // Si el ID es un UUID (base de datos)
            if (typeof id === 'string' && id.includes('-')) {
                const { error } = await supabase
                    .from('inbox')
                    .update({ is_read: read })
                    .eq('id', id);
                if (error) throw error;
            } else {
                // Si es un ID local
                const item = this.inboxItems.find(x => x.id === id);
                if (item) item.read = read;
                this.saveInbox();
            }
        } catch (e) {
            console.error('Error al marcar como leído:', e);
        }
        
        await this.loadInbox();
        if (this.historyView?.render) this.historyView.render();
    }

    loadInboxItemAsSecondary(id) {
        const item = this.inboxItems.find(x => x.id === id);
        if (!item) {
            alert('❌ No se encontró el mensaje de bandeja.');
            return false;
        }
        try {
            const records = parseTxtContent(item.content);
            if (!records.length) {
                alert('⚠️ El mensaje no contiene colores válidos.');
                return false;
            }
            this.secondaryData = records;
            this.updateFileInfo('secondary', item.subject || 'Bandeja', records.length);
            this.renderDataList('secondary', this.secondaryData);
            this.saveCurrentState();
            this.markInboxAsRead(id, true);
            if (this.switchView) this.switchView('comparator');
            alert(`✅ Cargado como secundario: ${records.length} colores.`);
            return true;
        } catch (error) {
            alert(`❌ Error cargando secundario desde bandeja: ${error.message || error}`);
            return false;
        }
    }

    setupRealtimeSync() {
        try {
            console.log('📡 Iniciando escucha en tiempo real (Asignaciones y Progreso)...');
            
            // Suscribirse a cambios en Asignaciones
            supabase
                .channel('assignments_realtime')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, () => {
                    this.refreshDashboard('assignments');
                })
                .subscribe();

            // Suscribirse a cambios en Progreso de Validación
            supabase
                .channel('progress_realtime')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'validation_progress' }, () => {
                    this.refreshDashboard('validation_progress');
                })
                .subscribe();

            // RECARGA INTELIGENTE: Eliminamos el heartbeat de 5s y lo dejamos solo como respaldo cada 2 minutos
            setInterval(() => {
                this.refreshDashboard('heartbeat');
            }, 120000);
            
        } catch (e) {
            console.error('Error en setupRealtimeSync:', e);
        }
    }

    initScheduledBackup() {
        console.log('⏰ Programador de backup activado (5:40 PM)');
        setInterval(() => {
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();
            
            // Si son las 5:40 PM (17:40) y el usuario tiene permiso de backup
            if (hours === 17 && minutes === 40) {
                const alreadyDoneToday = localStorage.getItem('lastBackupDate') === now.toDateString();
                if (!alreadyDoneToday && this.auth.hasPermission('backup')) {
                    this.triggerBackup();
                }
            }
        }, 60000); // Revisar cada minuto
    }

    async triggerBackup() {
        try {
            console.log('📦 Iniciando backup automático de seguridad...');
            const tables = [
                'usuarios', 
                'assignments', 
                'validation_progress', 
                'library_txt', 
                'valid_color_names',
                'inbox',
                'equivalency_groups'
            ];
            const backupData = {
                timestamp: new Date().toISOString(),
                version: '1.1',
                data: {}
            };

            for (const table of tables) {
                const { data } = await supabase.from(table).select('*');
                backupData.data[table] = data || [];
            }

            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `AlphaColor_Backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            localStorage.setItem('lastBackupDate', new Date().toDateString());
            window.showNotification('✅ Backup automático completado con éxito', 'success');
        } catch (e) {
            console.error('Error en backup:', e);
        }
    }

    refreshDashboard(source) {
        if (this.dashboardView) {
            console.log(`🔄 Refrescando dashboard (Origen: ${source})`);
            this.dashboardView.render().catch(err => console.error('Error refrescando dashboard:', err));
        }
    }
}

new AlphaColorMatch();