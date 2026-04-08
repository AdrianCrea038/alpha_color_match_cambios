// ============================================================
// DEVELOPMENT VIEW - Gestión de colores en desarrollo
// ============================================================

export class DevelopmentView {
    constructor(app) {
        this.app = app;
        this.colors = [];
        this.nextId = 1;
        this.currentUser = 'usuario';
        
        this.container = null;
        this.tableBody = null;
        this.addBtn = null;
        this.groupsList = null;
        this.groupsCollapsed = false;
        
        this.loadFromLocalStorage();
        this.loadHistoryFromLocalStorage();
        this.init();
    }
    
    init() {
        this.container = document.getElementById('developmentView');
        if (!this.container) return;
        
        this.render();
        this.bindEvents();
        console.log('✅ DevelopmentView inicializado');
    }
    
    loadFromLocalStorage() {
        const saved = localStorage.getItem('developmentColors');
        if (saved) {
            try {
                this.colors = JSON.parse(saved);
                this.nextId = Math.max(...this.colors.map(c => c.id), 0) + 1;
                console.log('📂 Colores de desarrollo cargados:', this.colors.length);
            } catch(e) { console.error(e); }
        }
    }
    
    saveToLocalStorage() {
        localStorage.setItem('developmentColors', JSON.stringify(this.colors));
        console.log('💾 Colores de desarrollo guardados');
    }
    
    // ============================================================
    // IMPORTAR - Cargar tabla de colores desde archivo
    // ============================================================
    
    importCSV() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,.xls,.txt';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target.result;
                this.parseImportedData(content);
            };
            reader.readAsText(file);
        };
        
        input.click();
    }
    
    parseImportedData(content) {
        if (content.includes('<table') && content.includes('<td>')) {
            this.parseHTMLTable(content);
            return;
        }
        this.parseCSVAndLoad(content);
    }
    
    parseHTMLTable(htmlContent) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const table = doc.querySelector('table');
        
        if (!table) {
            alert('⚠️ No se encontró una tabla válida en el archivo.');
            return;
        }
        
        const rows = table.querySelectorAll('tr');
        if (rows.length === 0) {
            alert('⚠️ No se encontraron datos en la tabla.');
            return;
        }
        
        const newEquivalencyRows = [];
        const columnCount = rows[0].querySelectorAll('td, th').length;
        
        for (let col = 0; col < columnCount; col++) {
            newEquivalencyRows.push([]);
        }
        
        for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
            const cells = rows[rowIdx].querySelectorAll('td, th');
            for (let col = 0; col < cells.length && col < columnCount; col++) {
                const cellText = cells[col].textContent.trim();
                if (cellText !== '') {
                    newEquivalencyRows[col].push(cellText);
                }
            }
        }
        
        const filteredGroups = newEquivalencyRows.filter(group => group.length > 0);
        if (filteredGroups.length === 0) {
            alert('⚠️ No se encontraron datos válidos en el archivo.');
            return;
        }
        
        this.applyImportedGroups(filteredGroups);
    }
    
    parseCSVAndLoad(csvContent) {
        let separator = ',';
        const firstLine = csvContent.split(/\r?\n/)[0];
        if (firstLine && firstLine.includes(';')) {
            separator = ';';
        }
        
        const lines = csvContent.split(/\r?\n/);
        const newEquivalencyRows = [];
        let startLine = 0;
        if (lines[0] && lines[0].trim() === 'sep=;') {
            startLine = 1;
        }
        
        let maxCols = 0;
        const rowsData = [];
        
        for (let i = startLine; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() === '') continue;
            const row = this.parseCSVLine(line, separator);
            if (row.length > maxCols) maxCols = row.length;
            rowsData.push(row);
        }
        
        for (let col = 0; col < maxCols; col++) {
            const group = [];
            for (let row = 0; row < rowsData.length; row++) {
                const value = rowsData[row][col];
                if (value && value.trim() !== '') {
                    group.push(value.trim());
                }
            }
            if (group.length > 0) {
                newEquivalencyRows.push(group);
            }
        }
        
        if (newEquivalencyRows.length === 0) {
            alert('⚠️ No se encontraron datos válidos en el archivo.');
            return;
        }
        
        this.applyImportedGroups(newEquivalencyRows);
    }
    
    parseCSVLine(line, separator = ',') {
        const result = [];
        let inQuotes = false;
        let current = '';
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === separator && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        
        return result.map(cell => cell.replace(/^"|"$/g, '').trim());
    }
    
    applyImportedGroups(newEquivalencyRows) {
        if (!this.app) return;
        
        this.app.equivalencyRows = newEquivalencyRows;
        this.app.saveEquivalencyRowsToLocalStorage();
        this.app.equivalenceGroups = this.app.buildEquivalenceGroups();
        
        if (this.app.creatorView) {
            this.app.creatorView.renderTable();
        }
        
        this.renderGroups();
        
        const totalColors = newEquivalencyRows.reduce((sum, g) => sum + g.length, 0);
        this.addHistoryEntry('IMPORT_CSV', `Tabla importada: ${newEquivalencyRows.length} grupos, ${totalColors} colores`, 'Importación masiva de colores');
        
        alert(`✅ Tabla importada correctamente: ${newEquivalencyRows.length} grupos, ${totalColors} colores.`);
    }
    
    // ============================================================
    // EXPORTAR TABLA A XLS - Compatible con Excel
    // ============================================================
    
    exportColorTable() {
        if (!this.app || !this.app.equivalencyRows) {
            alert('❌ No hay datos para exportar.');
            return;
        }
        
        let maxRows = 0;
        for (const group of this.app.equivalencyRows) {
            if (group.length > maxRows) maxRows = group.length;
        }
        
        if (maxRows === 0) {
            alert('❌ No hay datos para exportar.');
            return;
        }
        
        let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Tabla de Colores - Alpha Color Match</title>
<style>
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    tr:nth-child(even) { background-color: #f2f2f2; }
</style>
</head>
<body>
<h2>Tabla de Colores - Alpha Color Match</h2>
<p>Exportado: ${new Date().toLocaleString()}</p>
<table border="1" cellpadding="5" cellspacing="0">
`;
        
        for (let row = 0; row < maxRows; row++) {
            html += '<tr>';
            for (const group of this.app.equivalencyRows) {
                const color = group[row] || '';
                html += `<td>${this.escapeHtml(color)}</td>`;
            }
            html += '</tr>';
        }
        
        html += `
</table>
<p>Total: ${this.app.equivalencyRows.length} grupos, ${maxRows} filas</p>
</body>
</html>`;
        
        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tabla_colores_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xls`;
        a.click();
        URL.revokeObjectURL(url);
        
        alert('✅ Tabla exportada como Excel (.xls).');
    }
    
    // ============================================================
    // CARGAR TXT A LIBRERÍA POR PLOTTER
    // ============================================================
    
    uploadTxtToLibrary() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 450px;">
                <div class="modal-header" style="background: #2d4ed6;">
                    <h3 style="color: white;">📚 Cargar TXT a librería</h3>
                    <button class="modal-close" style="color: white;">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Seleccionar plotter:</label>
                        <select id="libraryPlotter" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;">
                            <option value="1">1</option><option value="2">2</option><option value="3">3</option>
                            <option value="4">4</option><option value="5">5</option><option value="6">6</option>
                            <option value="7">7</option><option value="8">8</option><option value="9">9</option>
                            <option value="10">10</option><option value="11">11</option><option value="12">12</option>
                            <option value="13">13</option><option value="14" selected>14</option>
                            <option value="15">15</option><option value="16">16</option><option value="17">17</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-top: 1rem;">
                        <label>Archivo TXT:</label>
                        <input type="file" id="libraryTxtFile" accept=".txt" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;">
                    </div>
                    <div class="form-group" style="margin-top: 1rem;">
                        <label>Motivo de la carga:</label>
                        <textarea id="libraryUploadReason" rows="2" placeholder="Ej: Nuevo archivo para plotter 14..." style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></textarea>
                    </div>
                    <p style="color: #fbbf24; font-size: 0.75rem;">⚠️ El motivo es obligatorio.</p>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-secondary cancel-upload">Cancelar</button>
                    <button class="btn btn-primary confirm-upload">Cargar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        
        const plotterSelect = modal.querySelector('#libraryPlotter');
        const fileInput = modal.querySelector('#libraryTxtFile');
        const reasonTextarea = modal.querySelector('#libraryUploadReason');
        
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.cancel-upload').onclick = closeModal;
        
        modal.querySelector('.confirm-upload').onclick = () => {
            const file = fileInput.files[0];
            const reason = reasonTextarea.value.trim();
            const plotter = parseInt(plotterSelect.value);
            
            if (!file) {
                alert('⚠️ Debe seleccionar un archivo TXT.');
                return;
            }
            if (!reason) {
                alert('⚠️ El motivo es obligatorio.');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                if (this.app) {
                    this.app.addTxtToLibrary(plotter, file.name, content);
                    this.addHistoryEntry('UPLOAD_TXT_LIBRARY', `TXT "${file.name}" cargado a librería del plotter ${plotter}`, reason);
                    alert(`✅ Archivo "${file.name}" cargado a librería del plotter ${plotter}.`);
                    
                    // Actualizar el selector de "Crear TXT"
                    if (this.app.creatorView) {
                        this.app.creatorView.updateLibrarySelect();
                    }
                    
                    closeModal();
                }
            };
            reader.readAsText(file);
        };
        
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    }
    
    // ============================================================
    // ELIMINAR TABLA COMPLETA - Seguridad de 3 fases
    // ============================================================
    
    deleteAllTable() {
        const modal1 = document.createElement('div');
        modal1.className = 'modal-overlay';
        modal1.innerHTML = `
            <div class="modal-content" style="max-width: 450px;">
                <div class="modal-header" style="background: #991b1b;">
                    <h3 style="color: white;">⚠️ ELIMINAR TODA LA TABLA DE COLORES</h3>
                    <button class="modal-close" style="color: white;">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="color: #fbbf24; margin-bottom: 1rem;">Esta acción eliminará TODOS los grupos y colores de la tabla de equivalencias.<br><strong>No se puede deshacer.</strong></p>
                    <div class="form-group">
                        <label for="deleteAllReason">Motivo de la eliminación:</label>
                        <textarea id="deleteAllReason" rows="3" placeholder="Ej: Reinicio de la base de datos..." style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></textarea>
                    </div>
                    <p style="color: #fbbf24; font-size: 0.75rem;">⚠️ El motivo es obligatorio.</p>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-secondary cancel-delete-all">Cancelar</button>
                    <button class="btn btn-danger next-delete-all">Siguiente</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal1);
        setTimeout(() => modal1.classList.add('active'), 10);
        
        const closeModal1 = () => {
            modal1.classList.remove('active');
            setTimeout(() => modal1.remove(), 300);
        };
        
        let motivo = '';
        
        modal1.querySelector('.modal-close').onclick = closeModal1;
        modal1.querySelector('.cancel-delete-all').onclick = closeModal1;
        
        modal1.querySelector('.next-delete-all').onclick = () => {
            motivo = modal1.querySelector('#deleteAllReason').value.trim();
            if (!motivo) {
                alert('⚠️ Debe ingresar un motivo para eliminar la tabla.');
                return;
            }
            closeModal1();
            
            const modal2 = document.createElement('div');
            modal2.className = 'modal-overlay';
            modal2.innerHTML = `
                <div class="modal-content" style="max-width: 450px;">
                    <div class="modal-header" style="background: #991b1b;">
                        <h3 style="color: white;">⚠️ CONFIRMACIÓN FINAL</h3>
                        <button class="modal-close" style="color: white;">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p style="color: #fbbf24; margin-bottom: 1rem;">¿Estás <strong>ABSOLUTAMENTE SEGURO</strong> de que quieres eliminar TODOS los colores de la tabla de equivalencias?</p>
                        <p><strong>Motivo:</strong> ${this.escapeHtml(motivo)}</p>
                    </div>
                    <div class="modal-buttons">
                        <button class="btn btn-secondary cancel-delete-all">Cancelar</button>
                        <button class="btn btn-danger confirm-delete-all">Sí, eliminar todo</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal2);
            setTimeout(() => modal2.classList.add('active'), 10);
            
            const closeModal2 = () => {
                modal2.classList.remove('active');
                setTimeout(() => modal2.remove(), 300);
            };
            
            modal2.querySelector('.modal-close').onclick = closeModal2;
            modal2.querySelector('.cancel-delete-all').onclick = closeModal2;
            
            modal2.querySelector('.confirm-delete-all').onclick = () => {
                closeModal2();
                
                const modal3 = document.createElement('div');
                modal3.className = 'modal-overlay';
                modal3.innerHTML = `
                    <div class="modal-content" style="max-width: 400px;">
                        <div class="modal-header" style="background: #991b1b;">
                            <h3 style="color: white;">🔒 VERIFICACIÓN DE SEGURIDAD</h3>
                            <button class="modal-close" style="color: white;">&times;</button>
                        </div>
                        <div class="modal-body">
                            <p>Ingrese la contraseña para confirmar la eliminación:</p>
                            <input type="password" id="securityPassword" placeholder="Contraseña" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white; margin-top:0.5rem;">
                        </div>
                        <div class="modal-buttons">
                            <button class="btn btn-secondary cancel-delete-all">Cancelar</button>
                            <button class="btn btn-danger final-delete-all">Confirmar</button>
                        </div>
                    </div>
                `;
                
                document.body.appendChild(modal3);
                setTimeout(() => modal3.classList.add('active'), 10);
                
                const closeModal3 = () => {
                    modal3.classList.remove('active');
                    setTimeout(() => modal3.remove(), 300);
                };
                
                modal3.querySelector('.modal-close').onclick = closeModal3;
                modal3.querySelector('.cancel-delete-all').onclick = closeModal3;
                
                modal3.querySelector('.final-delete-all').onclick = () => {
                    const password = modal3.querySelector('#securityPassword').value;
                    if (password === 'admin123') {
                        closeModal3();
                        this.executeDeleteAllTable(motivo);
                    } else {
                        alert('❌ Contraseña incorrecta. Eliminación cancelada.');
                        closeModal3();
                    }
                };
                
                modal3.onclick = (e) => { if (e.target === modal3) closeModal3(); };
            };
            
            modal2.onclick = (e) => { if (e.target === modal2) closeModal2(); };
        };
        
        modal1.onclick = (e) => { if (e.target === modal1) closeModal1(); };
    }
    
    executeDeleteAllTable(motivo) {
        if (!this.app) return;
        
        const backup = JSON.stringify(this.app.equivalencyRows);
        localStorage.setItem('equivalencyBackup', backup);
        
        this.app.equivalencyRows = [];
        this.app.saveEquivalencyRowsToLocalStorage();
        this.app.equivalenceGroups = this.app.buildEquivalenceGroups();
        
        if (this.app.creatorView) {
            this.app.creatorView.renderTable();
        }
        
        this.renderGroups();
        
        this.addHistoryEntry('DELETE_ALL_TABLE', 'Toda la tabla de equivalencias ha sido eliminada', motivo);
        
        alert('✅ Todos los grupos y colores han sido eliminados.');
    }
    
    // ============================================================
    // HISTORIAL - Gestión del registro de cambios
    // ============================================================
    
    loadHistoryFromLocalStorage() {
        const saved = localStorage.getItem('equivalencyHistory');
        if (saved) {
            try {
                this.history = JSON.parse(saved);
                console.log('📂 Historial cargado:', this.history.length, 'registros');
            } catch(e) { 
                console.error(e);
                this.history = [];
            }
        } else {
            this.history = [];
        }
    }
    
    saveHistoryToLocalStorage() {
        localStorage.setItem('equivalencyHistory', JSON.stringify(this.history));
        console.log('💾 Historial guardado');
    }
    
    addHistoryEntry(action, details, reason = '') {
        const entry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            user: this.currentUser,
            action: action,
            details: details,
            reason: reason
        };
        this.history.unshift(entry);
        if (this.history.length > 500) this.history = this.history.slice(0, 500);
        this.saveHistoryToLocalStorage();
        console.log(`📝 Historial: ${action} - ${details}`);
    }
    
    showHistoryModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay history-modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px; max-height: 85vh;">
                <div class="modal-header" style="background: #2d4ed6;">
                    <h3 style="color: white;"><i class="fas fa-history"></i> Historial de cambios - Tabla de equivalencias</h3>
                    <button class="modal-close" style="color: white;">&times;</button>
                </div>
                <div class="modal-body" style="overflow: auto; max-height: 65vh;">
                    <div class="history-filter" style="margin-bottom: 1rem;">
                        <input type="text" id="historySearchInput" placeholder="🔍 Buscar por usuario, acción, color, grupo o motivo..." style="width:100%; padding:0.6rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.5rem; color:white;">
                    </div>
                    <div id="historyTableContainer" style="overflow-x: auto;">
                        <table class="history-table" style="width:100%; border-collapse: collapse;">
                            <thead>
                                66<th style="text-align:left; padding:0.5rem; background:#111117;">Fecha/Hora</th>
                                <th style="text-align:left; padding:0.5rem; background:#111117;">Usuario</th>
                                <th style="text-align:left; padding:0.5rem; background:#111117;">Acción</th>
                                <th style="text-align:left; padding:0.5rem; background:#111117;">Detalle</th>
                            </thead>
                            <tbody id="historyTableBody"></tbody>
                          </table>
                    </div>
                    <div id="historyCount" style="margin-top: 1rem; font-size: 0.8rem; color: #6b7280; text-align: center;"></div>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-secondary close-history-modal">Cerrar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        
        const renderHistoryTable = (filterText = '') => {
            const tbody = modal.querySelector('#historyTableBody');
            const filterLower = filterText.toLowerCase();
            
            let filteredHistory = this.history;
            if (filterText) {
                filteredHistory = this.history.filter(entry => 
                    entry.user.toLowerCase().includes(filterLower) ||
                    this.getActionText(entry.action).toLowerCase().includes(filterLower) ||
                    entry.details.toLowerCase().includes(filterLower) ||
                    (entry.reason && entry.reason.toLowerCase().includes(filterLower))
                );
            }
            
            if (filteredHistory.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="padding:2rem; text-align:center; color:#6b7280;">No hay registros en el historial<\/td><\/tr>';
                modal.querySelector('#historyCount').innerHTML = 'Mostrando 0 de 0 registros';
                return;
            }
            
            tbody.innerHTML = filteredHistory.map(entry => {
                const date = new Date(entry.timestamp);
                const dateStr = date.toLocaleString();
                const actionClass = this.getActionClass(entry.action);
                const actionIcon = this.getActionIcon(entry.action);
                const actionText = this.getActionText(entry.action);
                
                let detailHtml = entry.details;
                if (entry.reason) {
                    detailHtml += `<br><span style="color: #fbbf24; font-size: 0.7rem;">📝 Motivo: ${this.escapeHtml(entry.reason)}</span>`;
                }
                
                return `
                    <tr style="border-bottom: 1px solid #1e1e2c;">
                        <td style="padding:0.75rem 0.5rem; font-size:0.75rem; white-space:nowrap;">${dateStr}<\/td>
                        <td style="padding:0.75rem 0.5rem; font-size:0.75rem;">${this.escapeHtml(entry.user)}<\/td>
                        <td style="padding:0.75rem 0.5rem; font-size:0.75rem;"><span class="history-action ${actionClass}">${actionIcon} ${actionText}</span><\/td>
                        <td style="padding:0.75rem 0.5rem; font-size:0.75rem;">${detailHtml}<\/td>
                    </tr>
                `;
            }).join('');
            
            modal.querySelector('#historyCount').innerHTML = `Mostrando ${filteredHistory.length} de ${this.history.length} registros`;
        };
        
        const searchInput = modal.querySelector('#historySearchInput');
        searchInput.addEventListener('input', (e) => renderHistoryTable(e.target.value));
        
        renderHistoryTable();
        
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.close-history-modal').onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    }
    
    getActionClass(action) {
        switch(action) {
            case 'APPROVE': return 'history-approve';
            case 'DELETE_FROM_GROUP': return 'history-delete';
            case 'CREATE_GROUP': return 'history-create';
            case 'ADD_TO_GROUP': return 'history-add';
            case 'EDIT_APPROVED': return 'history-edit';
            case 'IMPORT_CSV': return 'history-import';
            case 'DELETE_ALL_TABLE': return 'history-delete-all';
            case 'UPLOAD_TXT_LIBRARY': return 'history-import';
            default: return '';
        }
    }
    
    getActionIcon(action) {
        switch(action) {
            case 'APPROVE': return '✅';
            case 'DELETE_FROM_GROUP': return '🗑️';
            case 'CREATE_GROUP': return '➕';
            case 'ADD_TO_GROUP': return '📎';
            case 'EDIT_APPROVED': return '✏️';
            case 'IMPORT_CSV': return '📂';
            case 'DELETE_ALL_TABLE': return '⚠️';
            case 'UPLOAD_TXT_LIBRARY': return '📚';
            default: return '📝';
        }
    }
    
    getActionText(action) {
        switch(action) {
            case 'APPROVE': return 'APROBADO';
            case 'DELETE_FROM_GROUP': return 'ELIMINADO DE GRUPO';
            case 'CREATE_GROUP': return 'GRUPO CREADO';
            case 'ADD_TO_GROUP': return 'AGREGADO A GRUPO';
            case 'EDIT_APPROVED': return 'MODIFICADO (APROBADO)';
            case 'IMPORT_CSV': return 'IMPORTADO CSV';
            case 'DELETE_ALL_TABLE': return 'TABLA ELIMINADA';
            case 'UPLOAD_TXT_LIBRARY': return 'TXT CARGADO A LIBRERÍA';
            default: return action;
        }
    }
    
    getGroups() {
        const groups = new Map();
        if (this.app && this.app.equivalencyRows) {
            for (const row of this.app.equivalencyRows) {
                if (row.length > 0) {
                    const groupName = this.normalizeGroupName(row[0]);
                    groups.set(groupName, [...row]);
                }
            }
        }
        return groups;
    }
    
    normalizeGroupName(name) {
        return name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
    }
    
    showDeleteFromGroupModal(groupName, colorName) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 450px;">
                <div class="modal-header" style="background: #991b1b;">
                    <h3 style="color: white;">🗑️ Eliminar color del grupo</h3>
                    <button class="modal-close" style="color: white;">&times;</button>
                </div>
                <div class="modal-body">
                    <p><strong>Grupo:</strong> ${this.escapeHtml(groupName)}</p>
                    <p><strong>Color a eliminar:</strong> ${this.escapeHtml(colorName)}</p>
                    <div class="form-group" style="margin-top: 1rem;">
                        <label for="deleteReason">Motivo de la eliminación:</label>
                        <textarea id="deleteReason" rows="3" placeholder="Ej: Color duplicado, no se usa, etc..." style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></textarea>
                    </div>
                    <p style="color: #fbbf24; font-size: 0.75rem;">⚠️ El motivo es obligatorio para eliminar el color.</p>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-secondary cancel-delete">Cancelar</button>
                    <button class="btn btn-danger confirm-delete">🗑️ Eliminar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        
        const reasonTextarea = modal.querySelector('#deleteReason');
        const confirmBtn = modal.querySelector('.confirm-delete');
        
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.cancel-delete').onclick = closeModal;
        
        confirmBtn.onclick = () => {
            const reason = reasonTextarea.value.trim();
            if (!reason) {
                alert('⚠️ Debe ingresar un motivo para eliminar el color.');
                return;
            }
            this.deleteColorFromGroup(groupName, colorName, reason);
            closeModal();
        };
        
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    }
    
    deleteColorFromGroup(groupName, colorName, reason) {
        if (!this.app || !this.app.equivalencyRows) return;
        
        let found = false;
        for (let i = 0; i < this.app.equivalencyRows.length; i++) {
            const row = this.app.equivalencyRows[i];
            const currentGroupName = this.normalizeGroupName(row[0]);
            if (currentGroupName === groupName) {
                const index = row.indexOf(colorName);
                if (index !== -1) {
                    row.splice(index, 1);
                    if (row.length === 0) {
                        this.app.equivalencyRows.splice(i, 1);
                    }
                    found = true;
                    break;
                }
            }
        }
        
        if (found) {
            this.app.saveEquivalencyRowsToLocalStorage();
            this.app.equivalenceGroups = this.app.buildEquivalenceGroups();
            if (this.app.creatorView) {
                this.app.creatorView.renderTable();
            }
            this.renderGroups();
            this.addHistoryEntry('DELETE_FROM_GROUP', `Color "${colorName}" eliminado del grupo "${groupName}"`, reason);
            alert(`✅ "${colorName}" eliminado del grupo "${groupName}".`);
        } else {
            alert(`⚠️ "${colorName}" no encontrado en el grupo "${groupName}".`);
        }
    }
    
    // ============================================================
    // AGREGAR/EDITAR COLOR - Con checkboxes de complementarios
    // ============================================================
    
    showAddModal(colorToEdit = null) {
        const groups = this.getGroups();
        const groupOptions = Array.from(groups.keys()).sort();
        const isEditingApproved = colorToEdit && colorToEdit.approved === true;
        
        // Obtener los complementarios del grupo seleccionado
        const getComplementaryFromGroup = (selectedGroup) => {
            if (!selectedGroup || !this.app) return [];
            const groupColors = groups.get(selectedGroup) || [];
            return groupColors.filter(c => c !== colorToEdit?.name);
        };
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header" style="background: ${isEditingApproved ? '#b45309' : '#15803d'};">
                    <h3 style="color: white;">${colorToEdit ? (isEditingApproved ? '✏️ Modificar color aprobado' : '✏️ Editar color') : '➕ Agregar nuevo color'}</h3>
                    <button class="modal-close" style="color: white;">&times;</button>
                </div>
                <div class="modal-body">
                    ${isEditingApproved ? `<div style="background: rgba(180, 83, 9, 0.2); border: 1px solid #b45309; border-radius: 0.5rem; padding: 0.75rem; margin-bottom: 1rem;"><p style="color: #fbbf24; margin: 0; font-size: 0.8rem;">⚠️ Este color ya está <strong>APROBADO</strong>. Debe ingresar un motivo para modificarlo.</p></div>` : ''}
                    <div class="form-group">
                        <label>Nombre del color:</label>
                        <input type="text" id="devColorName" value="${colorToEdit ? this.escapeHtml(colorToEdit.name) : ''}" placeholder="Ej: 00A BLACK" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;">
                    </div>
                    <div class="form-group" style="margin-top: 0.75rem;">
                        <label>NK (Código de tela):</label>
                        <input type="text" id="devColorNK" value="${colorToEdit ? this.escapeHtml(colorToEdit.nk) : ''}" placeholder="Ej: T36943" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;">
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-top: 0.75rem;">
                        <div><label>C (%)</label><input type="number" id="devC" value="${colorToEdit ? colorToEdit.cmyk.c : 0}" step="1" min="0" max="100" style="width:100%; padding:0.3rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></div>
                        <div><label>M (%)</label><input type="number" id="devM" value="${colorToEdit ? colorToEdit.cmyk.m : 0}" step="1" min="0" max="100" style="width:100%; padding:0.3rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></div>
                        <div><label>Y (%)</label><input type="number" id="devY" value="${colorToEdit ? colorToEdit.cmyk.y : 0}" step="1" min="0" max="100" style="width:100%; padding:0.3rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></div>
                        <div><label>K (%)</label><input type="number" id="devK" value="${colorToEdit ? colorToEdit.cmyk.k : 0}" step="1" min="0" max="100" style="width:100%; padding:0.3rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-top: 0.75rem;">
                        <div><label>L*</label><input type="number" id="devL" value="${colorToEdit ? colorToEdit.lab.l : 0}" step="1" style="width:100%; padding:0.3rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></div>
                        <div><label>a*</label><input type="number" id="devA" value="${colorToEdit ? colorToEdit.lab.a : 0}" step="1" style="width:100%; padding:0.3rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></div>
                        <div><label>b*</label><input type="number" id="devB" value="${colorToEdit ? colorToEdit.lab.b : 0}" step="1" style="width:100%; padding:0.3rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></div>
                    </div>
                    <div class="form-group" style="margin-top: 0.75rem;">
                        <label>Grupo de equivalencia:</label>
                        <select id="devGroup" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;">
                            <option value="">-- Seleccionar grupo existente --</option>
                            ${groupOptions.map(g => `<option value="${this.escapeHtml(g)}" ${colorToEdit && colorToEdit.group === g ? 'selected' : ''}>${this.escapeHtml(g)}</option>`).join('')}
                            <option value="__NEW__">+ Crear nuevo grupo...</option>
                        </select>
                    </div>
                    <div id="newGroupContainer" style="margin-top: 0.5rem; display: none;">
                        <input type="text" id="newGroupName" placeholder="Nombre del nuevo grupo (ej: BLACK)" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;">
                    </div>
                    
                    <!-- CHECKBOXES DE COLORES COMPLEMENTARIOS -->
                    <div id="complementaryContainer" style="margin-top: 1rem; display: none;">
                        <label>Colores complementarios del grupo:</label>
                        <div id="complementaryCheckboxes" style="margin-top: 0.5rem; padding: 0.5rem; background: #1e1e2c; border-radius: 0.4rem; max-height: 150px; overflow-y: auto;"></div>
                        <div style="margin-top: 0.5rem;">
                            <label style="font-size: 0.8rem; display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="selectAllComplementary" checked> Seleccionar todos los complementarios
                            </label>
                        </div>
                    </div>
                    
                    ${!colorToEdit ? `
                    <div class="form-group" style="margin-top: 0.75rem;">
                        <label>Motivo:</label>
                        <textarea id="devReason" rows="2" placeholder="Motivo de la operación..." style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></textarea>
                        <p style="color: #fbbf24; font-size: 0.7rem; margin-top: 0.25rem;">⚠️ El motivo es obligatorio para agregar un color.</p>
                    </div>
                    ` : (isEditingApproved ? `
                    <div class="form-group" style="margin-top: 0.75rem;">
                        <label for="editReason">Motivo de la modificación:</label>
                        <textarea id="editReason" rows="2" placeholder="Ej: Se detectó un error en el valor CMYK, el cliente solicitó cambio..." style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></textarea>
                        <p style="color: #fbbf24; font-size: 0.7rem; margin-top: 0.25rem;">⚠️ El motivo es obligatorio para modificar un color aprobado.</p>
                    </div>
                    ` : '')}
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-secondary cancel-modal">Cancelar</button>
                    <button class="btn btn-primary confirm-modal">${colorToEdit ? 'Guardar cambios' : 'Agregar'}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        
        const groupSelect = modal.querySelector('#devGroup');
        const newGroupContainer = modal.querySelector('#newGroupContainer');
        const newGroupInput = modal.querySelector('#newGroupName');
        const complementaryContainer = modal.querySelector('#complementaryContainer');
        const complementaryCheckboxes = modal.querySelector('#complementaryCheckboxes');
        const selectAllCheckbox = modal.querySelector('#selectAllComplementary');
        
        // Función para actualizar los checkboxes de complementarios
        const updateComplementaryCheckboxes = () => {
            const selectedGroup = groupSelect.value;
            if (!selectedGroup || selectedGroup === '__NEW__') {
                complementaryContainer.style.display = 'none';
                return;
            }
            
            const groupColors = groups.get(selectedGroup) || [];
            const currentColorName = colorToEdit ? colorToEdit.name : null;
            const otherColors = groupColors.filter(c => c !== currentColorName);
            
            if (otherColors.length === 0) {
                complementaryContainer.style.display = 'none';
                return;
            }
            
            complementaryCheckboxes.innerHTML = otherColors.map(color => `
                <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; cursor: pointer;">
                    <input type="checkbox" class="complementary-cb" value="${this.escapeHtml(color)}" checked>
                    <span>${this.escapeHtml(color)}</span>
                </label>
            `).join('');
            
            complementaryContainer.style.display = 'block';
            
            // Actualizar select all
            const updateSelectAll = () => {
                const cbs = complementaryCheckboxes.querySelectorAll('.complementary-cb');
                const allChecked = cbs.length > 0 && Array.from(cbs).every(cb => cb.checked);
                selectAllCheckbox.checked = allChecked;
            };
            
            complementaryCheckboxes.querySelectorAll('.complementary-cb').forEach(cb => {
                cb.addEventListener('change', updateSelectAll);
            });
            updateSelectAll();
        };
        
        groupSelect.addEventListener('change', (e) => {
            if (e.target.value === '__NEW__') {
                newGroupContainer.style.display = 'block';
                complementaryContainer.style.display = 'none';
                newGroupInput.focus();
            } else {
                newGroupContainer.style.display = 'none';
                updateComplementaryCheckboxes();
            }
        });
        
        selectAllCheckbox.addEventListener('change', (e) => {
            complementaryCheckboxes.querySelectorAll('.complementary-cb').forEach(cb => {
                cb.checked = e.target.checked;
            });
        });
        
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.cancel-modal').onclick = closeModal;
        
        modal.querySelector('.confirm-modal').onclick = () => {
            const name = modal.querySelector('#devColorName').value.trim();
            const nk = modal.querySelector('#devColorNK').value.trim();
            const c = parseFloat(modal.querySelector('#devC').value) || 0;
            const m = parseFloat(modal.querySelector('#devM').value) || 0;
            const y = parseFloat(modal.querySelector('#devY').value) || 0;
            const k = parseFloat(modal.querySelector('#devK').value) || 0;
            const l = parseFloat(modal.querySelector('#devL').value) || 0;
            const a = parseFloat(modal.querySelector('#devA').value) || 0;
            const b = parseFloat(modal.querySelector('#devB').value) || 0;
            
            let selectedGroup = groupSelect.value;
            let isNewGroup = false;
            if (selectedGroup === '__NEW__') {
                selectedGroup = newGroupInput.value.trim().toUpperCase();
                if (!selectedGroup) {
                    alert('⚠️ Debe ingresar un nombre para el nuevo grupo.');
                    return;
                }
                isNewGroup = true;
            }
            
            if (!name) { alert('⚠️ Debe ingresar el nombre del color.'); return; }
            if (!nk) { alert('⚠️ Debe ingresar el NK.'); return; }
            
            let reason = '';
            let editReason = '';
            
            if (!colorToEdit) {
                reason = modal.querySelector('#devReason').value.trim();
                if (!reason) { alert('⚠️ El motivo es obligatorio para agregar el color.'); return; }
            } else if (isEditingApproved) {
                editReason = modal.querySelector('#editReason').value.trim();
                if (!editReason) { alert('⚠️ El motivo es obligatorio para modificar un color aprobado.'); return; }
            }
            
            const colorData = {
                id: colorToEdit ? colorToEdit.id : this.nextId++,
                name: name,
                nk: nk,
                cmyk: { c, m, y, k },
                lab: { l, a, b },
                group: selectedGroup,
                approved: colorToEdit ? colorToEdit.approved : false,
                createdAt: colorToEdit ? colorToEdit.createdAt : new Date().toISOString(),
                modifiedAt: new Date().toISOString()
            };
            
            if (colorToEdit) {
                const index = this.colors.findIndex(c => c.id === colorToEdit.id);
                if (index !== -1) this.colors[index] = colorData;
                if (isEditingApproved) {
                    this.addHistoryEntry('EDIT_APPROVED', `Color "${name}" (${nk}) modificado. Grupo: ${selectedGroup}`, editReason);
                }
            } else {
                this.colors.push(colorData);
                if (isNewGroup) {
                    this.addHistoryEntry('CREATE_GROUP', `Nuevo grupo "${selectedGroup}" creado con color "${name}"`, reason);
                }
            }
            
            // Agregar complementarios seleccionados
            const selectedComplementaries = Array.from(complementaryCheckboxes.querySelectorAll('.complementary-cb:checked'))
                .map(cb => cb.value);
            
            for (const compName of selectedComplementaries) {
                const alreadyExists = this.colors.some(c => 
                    this.normalizeName(c.name) === this.normalizeName(compName) && c.nk === nk
                );
                if (!alreadyExists) {
                    this.addColor({
                        name: compName,
                        nk: nk,
                        cmyk: { c, m, y, k },
                        lab: { l, a, b },
                        isLocked: false
                    });
                    this.addHistoryEntry('ADD_COMPLEMENTARY', `Complementario "${compName}" agregado al grupo ${selectedGroup}`, reason);
                }
            }
            
            this.saveToLocalStorage();
            this.renderTable();
            this.renderGroups();
            closeModal();
        };
        
        // Si hay un grupo seleccionado por defecto, mostrar complementarios
        if (colorToEdit && colorToEdit.group) {
            groupSelect.value = colorToEdit.group;
            updateComplementaryCheckboxes();
        }
        
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    }
    
    addComplementaryColor(name, nk) {
        this.addColor({
            name: name,
            nk: nk,
            cmyk: { c: 0, m: 0, y: 0, k: 0 },
            lab: { l: 100, a: 0, b: 0 },
            isLocked: false
        });
        this.addToHistory(this.nextId - 1, 'ADD_COMPLEMENTARY', `Complementario de ${name} agregado automáticamente`);
    }
    
    approveColor(colorId) {
        const color = this.colors.find(c => c.id === colorId);
        if (!color) return;
        
        if (!this.app || !this.app.equivalencyRows) {
            alert('❌ No se puede acceder a la tabla de equivalencias.');
            return;
        }
        
        let groupRow = null;
        for (const row of this.app.equivalencyRows) {
            for (const existingColor of row) {
                if (this.normalizeGroupName(existingColor) === this.normalizeGroupName(color.group)) {
                    groupRow = row;
                    break;
                }
            }
            if (groupRow) break;
        }
        
        if (groupRow) {
            if (!groupRow.includes(color.name)) {
                groupRow.push(color.name);
                this.addHistoryEntry('ADD_TO_GROUP', `Color "${color.name}" agregado al grupo "${color.group}"`, `Aprobado desde desarrollo`);
            } else {
                alert(`⚠️ "${color.name}" ya existe en el grupo "${color.group}".`);
                return;
            }
        } else {
            this.app.equivalencyRows.push([color.name]);
            this.addHistoryEntry('CREATE_GROUP', `Nuevo grupo "${color.group}" creado con color "${color.name}"`, `Aprobado desde desarrollo`);
        }
        
        this.app.saveEquivalencyRowsToLocalStorage();
        this.app.equivalenceGroups = this.app.buildEquivalenceGroups();
        if (this.app.creatorView) {
            this.app.creatorView.renderTable();
        }
        
        this.addHistoryEntry('APPROVE', `Color "${color.name}" (${color.nk}) aprobado y agregado al grupo "${color.group}"`, `Aprobado desde desarrollo`);
        
        color.approved = true;
        this.saveToLocalStorage();
        this.renderTable();
        this.renderGroups();
        
        alert(`✅ "${color.name}" aprobado y agregado a la tabla de equivalencias.`);
    }
    
    deleteColor(colorId) {
        if (confirm('¿Estás seguro de que quieres eliminar este color de desarrollo?')) {
            this.colors = this.colors.filter(c => c.id !== colorId);
            this.saveToLocalStorage();
            this.renderTable();
        }
    }
    
    exportEPS(color) {
        const c_dec = (color.cmyk.c / 100).toFixed(4);
        const m_dec = (color.cmyk.m / 100).toFixed(4);
        const y_dec = (color.cmyk.y / 100).toFixed(4);
        const k_dec = (color.cmyk.k / 100).toFixed(4);
        const cmykVal = `${c_dec} ${m_dec} ${y_dec} ${k_dec}`;
        const fullName = `${color.name} ${color.nk}`;
        
        const epsContent = `%!PS-Adobe-3.0 EPSF-3.0
%%BoundingBox: 0 0 283 283
%%Title: ${fullName}
%%Creator: Alpha Color Match - Desarrollo
%%LanguageLevel: 2
%%Pages: 1
%%DocumentCustomColors: (${fullName})
%%CMYKCustomColor: ${cmykVal} (${fullName})
%%EndComments

%%Page: 1 1
%%BeginPageSetup
<< /PageSize [283 283] >> setpagedevice
%%EndPageSetup

gsave
[/Separation (${fullName}) /DeviceCMYK { ${cmykVal} }] setcolorspace
0 0 283 283 rectfill

/Times-Roman findfont 10 scalefont setfont
0 0 0 1 setcmykcolor
10 10 moveto (Color: ${color.name}) show
10 25 moveto (NK: ${color.nk}) show
10 40 moveto (CMYK: ${color.cmyk.c}% ${color.cmyk.m}% ${color.cmyk.y}% ${color.cmyk.k}%) show
10 55 moveto (Grupo: ${color.group}) show
grestore
showpage
%%EOF`;
        
        const blob = new Blob([epsContent], { type: 'application/postscript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${color.name.replace(/\s/g, '_')}_${color.nk}.eps`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    renderTable() {
        if (!this.tableBody) return;
        if (this.colors.length === 0) {
            this.tableBody.innerHTML = '<tr><td colspan="10" class="empty-state">No hay colores en desarrollo. Agregue uno nuevo.<\/td><\/tr>';
            return;
        }
        
        this.tableBody.innerHTML = this.colors.map(color => {
            const statusBadge = color.approved 
                ? '<span class="status-badge approved" style="background:#15803d; color:white; padding:0.2rem 0.5rem; border-radius:1rem; font-size:0.7rem;">✅ Aprobado</span>'
                : '<span class="status-badge pending" style="background:#b45309; color:white; padding:0.2rem 0.5rem; border-radius:1rem; font-size:0.7rem;">⏳ Pendiente</span>';
            
            return `
                <tr data-id="${color.id}">
                    <td>${color.id}</td>
                    <td><strong>${this.escapeHtml(color.name)}</strong></td>
                    <td>${this.escapeHtml(color.nk)}</td>
                    <td>${color.cmyk.c}%</td>
                    <td>${color.cmyk.m}%</td>
                    <td>${color.cmyk.y}%</td>
                    <td>${color.cmyk.k}%</td>
                    <td>${this.escapeHtml(color.group)}</td>
                    <td>${statusBadge}</td>
                    <td class="actions-cell">
                        <button class="dev-btn dev-edit" data-id="${color.id}" title="Editar"><i class="fas fa-edit"></i></button>
                        ${!color.approved ? `<button class="dev-btn dev-approve" data-id="${color.id}" title="Aprobar"><i class="fas fa-check-circle"></i></button>` : ''}
                        <button class="dev-btn dev-eps" data-id="${color.id}" title="Exportar EPS"><i class="fas fa-file-image"></i></button>
                        <button class="dev-btn dev-delete" data-id="${color.id}" title="Eliminar"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
        this.attachTableEvents();
    }
    
    attachTableEvents() {
        this.tableBody.querySelectorAll('.dev-edit').forEach(btn => {
            btn.onclick = () => {
                const id = parseInt(btn.dataset.id);
                const color = this.colors.find(c => c.id === id);
                if (color) this.showAddModal(color);
            };
        });
        this.tableBody.querySelectorAll('.dev-approve').forEach(btn => {
            btn.onclick = () => {
                const id = parseInt(btn.dataset.id);
                this.approveColor(id);
            };
        });
        this.tableBody.querySelectorAll('.dev-eps').forEach(btn => {
            btn.onclick = () => {
                const id = parseInt(btn.dataset.id);
                const color = this.colors.find(c => c.id === id);
                if (color) this.exportEPS(color);
            };
        });
        this.tableBody.querySelectorAll('.dev-delete').forEach(btn => {
            btn.onclick = () => {
                const id = parseInt(btn.dataset.id);
                this.deleteColor(id);
            };
        });
    }
    
    toggleGroupsCollapse() {
        this.groupsCollapsed = !this.groupsCollapsed;
        const groupsContainer = document.querySelector('.development-groups .groups-list');
        const toggleIcon = document.querySelector('.groups-toggle-icon');
        
        if (groupsContainer) {
            if (this.groupsCollapsed) {
                groupsContainer.style.display = 'none';
                if (toggleIcon) toggleIcon.innerHTML = '<i class="fas fa-chevron-right"></i>';
            } else {
                groupsContainer.style.display = 'flex';
                if (toggleIcon) toggleIcon.innerHTML = '<i class="fas fa-chevron-down"></i>';
            }
        }
    }
    
    renderGroups() {
        if (!this.groupsList) return;
        const groups = this.getGroups();
        
        if (groups.size === 0) {
            this.groupsList.innerHTML = '<div class="empty-state">No hay grupos de equivalencia creados</div>';
            return;
        }
        
        this.groupsList.innerHTML = Array.from(groups.entries()).map(([groupName, colors]) => `
            <div class="group-card">
                <div class="group-header">
                    <strong><i class="fas fa-layer-group"></i> ${this.escapeHtml(groupName)}</strong>
                    <div class="group-header-actions">
                        <span class="group-count">${colors.length} colores</span>
                    </div>
                </div>
                <div class="group-colors">
                    ${colors.map(c => `
                        <div class="group-color-item">
                            <span class="group-color-tag">${this.escapeHtml(c)}</span>
                            <button class="group-delete-btn" data-group="${this.escapeHtml(groupName)}" data-color="${this.escapeHtml(c)}" title="Eliminar color del grupo"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
        
        this.groupsList.querySelectorAll('.group-delete-btn').forEach(btn => {
            btn.onclick = () => {
                const groupName = btn.dataset.group;
                const colorName = btn.dataset.color;
                this.showDeleteFromGroupModal(groupName, colorName);
            };
        });
    }
    
    render() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="development-container">
                <div class="development-header">
                    <h3><i class="fas fa-palette"></i> Desarrollo de colores</h3>
                    <div class="development-header-buttons">
                        <button id="devAddColorBtn" class="btn-primary"><i class="fas fa-plus"></i> Agregar color</button>
                        <button id="devExportTableBtn" class="btn-secondary" style="background:#2d3748;"><i class="fas fa-download"></i> Exportar Excel</button>
                        <button id="devImportCsvBtn" class="btn-secondary" style="background:#2d3748;"><i class="fas fa-upload"></i> Importar</button>
                        <button id="devDeleteAllTableBtn" class="btn-danger" style="background:#991b1b;"><i class="fas fa-trash-alt"></i> Eliminar tabla</button>
                        <button id="devHistoryBtn" class="btn-secondary" style="background:#2d3748;"><i class="fas fa-history"></i> Ver historial</button>
                        <button id="devUploadTxtBtn" class="btn-secondary" style="background:#2d3748;"><i class="fas fa-upload"></i> Cargar TXT a librería</button>
                    </div>
                </div>
                
                <div class="development-table-wrapper">
                    <table class="development-table">
                        <thead>
                            60<th>ID</th><th>Nombre</th><th>NK</th><th>C</th><th>M</th><th>Y</th><th>K</th><th>Grupo</th><th>Estado</th><th>Acciones</th>
                            </thead>
                        <tbody id="devTableBody"></tbody>
                      </table>
                </div>
                
                <div class="development-groups">
                    <div class="groups-header">
                        <h4><i class="fas fa-link"></i> Grupos de equivalencia existentes</h4>
                        <button class="groups-toggle-btn" id="groupsToggleBtn">
                            <span class="groups-toggle-icon"><i class="fas fa-chevron-down"></i></span>
                        </button>
                    </div>
                    <div id="devGroupsList" class="groups-list"></div>
                </div>
            </div>
        `;
        
        this.tableBody = this.container.querySelector('#devTableBody');
        this.groupsList = this.container.querySelector('#devGroupsList');
        this.addBtn = this.container.querySelector('#devAddColorBtn');
        const exportTableBtn = this.container.querySelector('#devExportTableBtn');
        const importCsvBtn = this.container.querySelector('#devImportCsvBtn');
        const deleteAllTableBtn = this.container.querySelector('#devDeleteAllTableBtn');
        const historyBtn = this.container.querySelector('#devHistoryBtn');
        const uploadTxtBtn = this.container.querySelector('#devUploadTxtBtn');
        const groupsToggleBtn = this.container.querySelector('#groupsToggleBtn');
        
        if (this.addBtn) {
            this.addBtn.onclick = () => this.showAddModal();
        }
        if (exportTableBtn) {
            exportTableBtn.onclick = () => this.exportColorTable();
        }
        if (importCsvBtn) {
            importCsvBtn.onclick = () => this.importCSV();
        }
        if (deleteAllTableBtn) {
            deleteAllTableBtn.onclick = () => this.deleteAllTable();
        }
        if (historyBtn) {
            historyBtn.onclick = () => this.showHistoryModal();
        }
        if (uploadTxtBtn) {
            uploadTxtBtn.onclick = () => this.uploadTxtToLibrary();
        }
        if (groupsToggleBtn) {
            groupsToggleBtn.onclick = () => this.toggleGroupsCollapse();
        }
        
        this.renderTable();
        this.renderGroups();
    }
    
    bindEvents() {}
    
    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
}