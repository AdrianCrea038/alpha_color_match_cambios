// js/main.js
import { Auth } from './core/auth.js';
import { loadFile, parseTxtContent } from './modules/fileLoader.js';
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
import { DashboardView } from './views/dashboardView.js';
import { supabase } from './core/supabaseClient.js';

class AlphaColorMatch {
    constructor() {
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
        
        // Vistas
        this.paletteValidatorView = null;
        this.developmentView = null;
        this.historyView = null;
        this.assignmentView = null;
        this.adminView = null;
        this.reportsView = null;
        this.dashboardView = null;
        
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
        await this.loadInbox();
        
        // RECUPERAR VISTA GUARDADA
        const lastView = localStorage.getItem('currentView') || 'dashboard';
        if (this.switchView) this.switchView(lastView);
        
        // ACTIVAR SINCRONIZACIÓN EN TIEMPO REAL
        this.setupRealtimeSync();

        // ACTIVAR BACKUP PROGRAMADO (5:40 PM)
        this.initScheduledBackup();
        
        // Recuperar la última vista visitada
        const savedView = localStorage.getItem('currentView') || 'dashboard';
        this.showView(savedView);
        
        // Configurar sincronización en tiempo real
        this.setupRealtimeSync();
        
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
            this.primaryFileName = fileName;
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
            this.secondaryFileName = fileName;
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
        this.logComparisonSession();
        
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
            admin: document.getElementById('adminView')
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
            if (viewName === 'dashboard' && this.dashboardView) {
                this.dashboardView.render();
            }
            if (viewName === 'admin' && this.adminView) {
                this.adminView.render();
            }
        };
        this.switchView = switchView;
        
        menuItems.forEach(item => {
            item.addEventListener('click', () => {
                const viewName = item.dataset.view;
                if (viewName && this.auth.hasPermission(viewName)) {
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

    logComparisonSession() {
        const unmatched = this.results.filter(item =>
            item.matchType === 'pending_primary' || item.matchType === 'pending_secondary'
        ).length;
        const invalidCmyk = [...this.primaryData, ...this.secondaryData].filter(rec =>
            !Array.isArray(rec.cmyk) || rec.cmyk.length < 4 || rec.cmyk.some(v => !Number.isFinite(v) || v < 0 || v > 100)
        ).length;
        const entry = {
            id: `cmp_${Date.now()}`,
            createdAt: new Date().toISOString(),
            user: this.auth.getCurrentUser()?.username || 'usuario',
            primaryFile: this.primaryFileName || 'principal',
            secondaryFile: this.secondaryFileName || 'secundario',
            unmatched,
            invalidCmyk
        };
        let logs = [];
        try {
            logs = JSON.parse(localStorage.getItem('comparisonReportLogs') || '[]');
        } catch (e) {
            logs = [];
        }
        logs.unshift(entry);
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
            showNotification('✅ Backup automático completado con éxito', 'success');
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