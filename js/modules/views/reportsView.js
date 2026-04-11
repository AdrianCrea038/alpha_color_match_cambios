// ============================================================
// REPORTS VIEW - Reportes de asignaciones
// ============================================================

export class ReportsView {
    constructor(app) {
        this.app = app;
        this.assignments = [];
        this.filteredAssignments = [];
        
        this.container = null;
        this.tableBody = null;
        this.searchText = '';
        this.dateFrom = '';
        this.dateTo = '';
        this.userFilter = '';
        this.plotterFilter = '';
        this.txtFilter = '';
        
        this.init();
    }
    
    init() {
        this.container = document.getElementById('reportsView');
        if (!this.container) return;
        
        this.tableBody = this.container.querySelector('#reportsTableBody');
        this.searchInput = this.container.querySelector('#reportsSearchText');
        this.dateFromInput = this.container.querySelector('#reportsDateFrom');
        this.dateToInput = this.container.querySelector('#reportsDateTo');
        this.userSelect = this.container.querySelector('#reportsUserFilter');
        this.plotterSelect = this.container.querySelector('#reportsPlotterFilter');
        this.txtSelect = this.container.querySelector('#reportsTxtFilter');
        this.searchBtn = this.container.querySelector('#reportsSearchBtn');
        this.clearBtn = this.container.querySelector('#reportsClearBtn');
        this.exportBtn = this.container.querySelector('#reportsExportCsvBtn');
        this.printBtn = this.container.querySelector('#reportsPrintBtn');
        this.countSpan = this.container.querySelector('#reportsCount');
        
        // Agregar botón de limpiar historial si no existe
        this.addClearHistoryButton();
        
        this.loadData();
        this.updateFilters();
        this.render();
        this.bindEvents();
        
        console.log('✅ ReportsView inicializado');
    }
    
    addClearHistoryButton() {
        const actionsDiv = this.container.querySelector('.reports-actions');
        if (actionsDiv && !this.container.querySelector('#reportsClearHistoryBtn')) {
            const clearHistoryBtn = document.createElement('button');
            clearHistoryBtn.id = 'reportsClearHistoryBtn';
            clearHistoryBtn.className = 'btn-danger';
            clearHistoryBtn.innerHTML = '<i class="fas fa-trash-alt"></i> 🗑️ LIMPIAR HISTORIAL';
            clearHistoryBtn.style.marginLeft = '0.5rem';
            clearHistoryBtn.onclick = () => this.clearAllHistory();
            actionsDiv.appendChild(clearHistoryBtn);
        }
    }
    
    clearAllHistory() {
        if (confirm('⚠️ ¿Estás seguro de que quieres ELIMINAR TODO EL HISTORIAL DE ASIGNACIONES?\n\nEsta acción no se puede deshacer.')) {
            this.assignments = [];
            this.filteredAssignments = [];
            localStorage.setItem('alphaColorMatchAssignments', JSON.stringify([]));
            this.loadData();
            this.updateFilters();
            this.render();
            alert('✅ Todo el historial de asignaciones ha sido eliminado.');
        }
    }
    
    loadData() {
        const saved = localStorage.getItem('alphaColorMatchAssignments');
        if (saved) {
            try {
                this.assignments = JSON.parse(saved);
            } catch(e) {
                this.assignments = [];
            }
        } else {
            this.assignments = [];
        }
    }
    
    updateFilters() {
        const users = new Set();
        for (const a of this.assignments) {
            users.add(a.user);
        }
        
        let userHtml = '<option value="">-- Todos los usuarios --</option>';
        for (const user of users) {
            let displayName = user;
            switch(user) {
                case 'usuario_admin': displayName = '👤 Usuario Admin'; break;
                case 'produccion_1': displayName = '🏭 Producción 1'; break;
                case 'produccion_2': displayName = '🏭 Producción 2'; break;
                case 'calidad': displayName = '✅ Calidad'; break;
                case 'desarrollo': displayName = '🎨 Desarrollo'; break;
                case 'supervisor': displayName = '👔 Supervisor'; break;
            }
            userHtml += `<option value="${this.escapeHtml(user)}">${displayName}</option>`;
        }
        if (this.userSelect) this.userSelect.innerHTML = userHtml;
        
        const txts = new Set();
        for (const a of this.assignments) {
            txts.add(a.fileName);
        }
        
        let txtHtml = '<option value="">-- Todos los archivos --</option>';
        for (const txt of txts) {
            txtHtml += `<option value="${this.escapeHtml(txt)}">${this.escapeHtml(txt)}</option>`;
        }
        if (this.txtSelect) this.txtSelect.innerHTML = txtHtml;
    }
    
    bindEvents() {
        if (this.searchBtn) {
            this.searchBtn.onclick = () => this.applyFilters();
        }
        if (this.clearBtn) {
            this.clearBtn.onclick = () => this.clearFilters();
        }
        if (this.exportBtn) {
            this.exportBtn.onclick = () => this.exportToExcel();
        }
        if (this.printBtn) {
            this.printBtn.onclick = () => this.printReport();
        }
        
        if (this.searchInput) {
            this.searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.applyFilters();
            });
        }
    }
    
    applyFilters() {
        this.searchText = this.searchInput ? this.searchInput.value.trim().toLowerCase() : '';
        this.dateFrom = this.dateFromInput ? this.dateFromInput.value : '';
        this.dateTo = this.dateToInput ? this.dateToInput.value : '';
        this.userFilter = this.userSelect ? this.userSelect.value : '';
        this.plotterFilter = this.plotterSelect ? this.plotterSelect.value : '';
        this.txtFilter = this.txtSelect ? this.txtSelect.value : '';
        
        this.filteredAssignments = this.assignments.filter(assignment => {
            if (this.searchText) {
                const searchable = `${assignment.fileName} ${assignment.user} ${assignment.comment || ''} ${assignment.plotter}`.toLowerCase();
                if (!searchable.includes(this.searchText)) {
                    return false;
                }
            }
            
            if (this.dateFrom) {
                const assignmentDate = new Date(assignment.timestamp).toISOString().split('T')[0];
                if (assignmentDate < this.dateFrom) return false;
            }
            
            if (this.dateTo) {
                const assignmentDate = new Date(assignment.timestamp).toISOString().split('T')[0];
                if (assignmentDate > this.dateTo) return false;
            }
            
            if (this.userFilter && assignment.user !== this.userFilter) return false;
            if (this.plotterFilter && assignment.plotter.toString() !== this.plotterFilter) return false;
            if (this.txtFilter && assignment.fileName !== this.txtFilter) return false;
            
            return true;
        });
        
        this.render();
    }
    
    clearFilters() {
        if (this.searchInput) this.searchInput.value = '';
        if (this.dateFromInput) this.dateFromInput.value = '';
        if (this.dateToInput) this.dateToInput.value = '';
        if (this.userSelect) this.userSelect.value = '';
        if (this.plotterSelect) this.plotterSelect.value = '';
        if (this.txtSelect) this.txtSelect.value = '';
        
        this.searchText = '';
        this.dateFrom = '';
        this.dateTo = '';
        this.userFilter = '';
        this.plotterFilter = '';
        this.txtFilter = '';
        this.filteredAssignments = [...this.assignments];
        this.render();
    }
    
    render() {
        if (!this.tableBody) return;
        
        const dataToShow = this.filteredAssignments.length > 0 ? this.filteredAssignments : this.assignments;
        
        if (dataToShow.length === 0) {
            this.tableBody.innerHTML = '<tr><td colspan="6" class="empty-state">No hay asignaciones registradas<\/td><\/tr>';
            if (this.countSpan) this.countSpan.innerHTML = 'Mostrando 0 de 0 asignaciones';
            return;
        }
        
        this.tableBody.innerHTML = dataToShow.map(assignment => {
            const date = new Date(assignment.timestamp);
            const dateStr = date.toLocaleDateString();
            
            let userName = assignment.user;
            switch(assignment.user) {
                case 'usuario_admin': userName = '👤 Usuario Admin'; break;
                case 'produccion_1': userName = '🏭 Producción 1'; break;
                case 'produccion_2': userName = '🏭 Producción 2'; break;
                case 'calidad': userName = '✅ Calidad'; break;
                case 'desarrollo': userName = '🎨 Desarrollo'; break;
                case 'supervisor': userName = '👔 Supervisor'; break;
                default: userName = assignment.user;
            }
            
            const percentage = assignment.progressPercentage || 0;
            const approved = assignment.progressApproved || 0;
            const total = assignment.progressTotal || 0;
            
            let progressClass = '';
            let progressText = `${percentage}% (${approved}/${total})`;
            if (percentage === 100) progressText = '✅ COMPLETADO';
            else if (percentage >= 75) progressClass = 'progress-high';
            else if (percentage >= 50) progressClass = 'progress-medium';
            else progressClass = 'progress-low';
            
            return `
                <tr>
                    <td>${dateStr}</td>
                    <td>${this.escapeHtml(userName)}</td>
                    <td>Plotter ${assignment.plotter}</td>
                    <td><span class="report-filename">${this.escapeHtml(assignment.fileName)}</span></td>
                    <td class="progress-cell">
                        <div class="report-progress-container">
                            <div class="report-progress-bar ${progressClass}" style="width: ${percentage}%;"></div>
                        </div>
                        <span class="report-progress-text">${progressText}</span>
                    </td>
                    <td class="report-comment">${assignment.comment ? this.escapeHtml(assignment.comment.substring(0, 50)) + (assignment.comment.length > 50 ? '...' : '') : '—'}</td>
                </tr>
            `;
        }).join('');
        
        if (this.countSpan) {
            this.countSpan.innerHTML = `Mostrando ${dataToShow.length} de ${this.assignments.length} asignaciones`;
        }
    }
    
    // ============================================================
    // EXPORTAR A EXCEL (.xlsx)
    // ============================================================
    exportToExcel() {
        const dataToExport = this.filteredAssignments.length > 0 ? this.filteredAssignments : this.assignments;
        
        if (dataToExport.length === 0) {
            alert('No hay datos para exportar.');
            return;
        }
        
        // Crear datos para la hoja de Excel
        const excelData = [];
        
        // Encabezados
        excelData.push(['Fecha', 'Usuario', 'Plotter', 'Archivo', 'Progreso (%)', 'Colores Aprobados', 'Colores Totales', 'Motivo']);
        
        // Datos
        for (const a of dataToExport) {
            const date = new Date(a.timestamp).toLocaleDateString();
            const percentage = a.progressPercentage || 0;
            const approved = a.progressApproved || 0;
            const total = a.progressTotal || 0;
            
            let userName = a.user;
            switch(a.user) {
                case 'usuario_admin': userName = 'Usuario Admin'; break;
                case 'produccion_1': userName = 'Producción 1'; break;
                case 'produccion_2': userName = 'Producción 2'; break;
                case 'calidad': userName = 'Calidad'; break;
                case 'desarrollo': userName = 'Desarrollo'; break;
                case 'supervisor': userName = 'Supervisor'; break;
            }
            
            excelData.push([
                date,
                userName,
                `Plotter ${a.plotter}`,
                a.fileName,
                percentage,
                approved,
                total,
                a.comment || ''
            ]);
        }
        
        // Generar archivo XLSX
        this.generateXLSX(excelData);
    }
    
    generateXLSX(data) {
        // Crear una hoja de cálculo en formato HTML (compatible con Excel)
        let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Reporte de Asignaciones - Alpha Color Match</title>
<style>
    th { background-color: #00e5ff; color: #000; }
    td { border: 1px solid #ccc; }
</style>
</head>
<body>
<h2>Alpha Color Match - Reporte de Asignaciones</h2>
<p>Fecha de generación: ${new Date().toLocaleString()}</p>
<p>Total de asignaciones: ${data.length - 1}</p>
<table border="1" cellpadding="5" cellspacing="0">
`;
        
        for (let i = 0; i < data.length; i++) {
            html += '<tr>';
            for (let j = 0; j < data[i].length; j++) {
                const tag = i === 0 ? 'th' : 'td';
                html += `<${tag}>${this.escapeExcel(data[i][j])}</${tag}>`;
            }
            html += '</tr>';
        }
        
        html += `
</table>
<p>Generado por Alpha Color Match</p>
</body>
</html>`;
        
        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_asignaciones_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        
        alert(`✅ Reporte exportado a Excel con ${data.length - 1} registros.`);
    }
    
    printReport() {
        const dataToPrint = this.filteredAssignments.length > 0 ? this.filteredAssignments : this.assignments;
        
        if (dataToPrint.length === 0) {
            alert('No hay datos para imprimir.');
            return;
        }
        
        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Reporte de Asignaciones - Alpha Color Match</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #00e5ff; }
                    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #0c0c12; color: #00e5ff; }
                    .progress-bar-container { background: #ddd; border-radius: 10px; height: 10px; width: 100px; }
                    .progress-bar { background: #00e5ff; height: 10px; border-radius: 10px; }
                    .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
                </style>
            </head>
            <body>
                <h1>Alpha Color Match - Reporte de Asignaciones</h1>
                <p>Fecha de generación: ${new Date().toLocaleString()}</p>
                <p>Total de asignaciones: ${dataToPrint.length}</p>
                <table>
                    <thead>
                        <tr><th>Fecha</th><th>Usuario</th><th>Plotter</th><th>Archivo</th><th>Progreso</th><th>Motivo</th></tr>
                    </thead>
                    <tbody>
        `;
        
        for (const a of dataToPrint) {
            const date = new Date(a.timestamp).toLocaleDateString();
            const percentage = a.progressPercentage || 0;
            let userName = a.user;
            switch(a.user) {
                case 'usuario_admin': userName = 'Usuario Admin'; break;
                case 'produccion_1': userName = 'Producción 1'; break;
                case 'produccion_2': userName = 'Producción 2'; break;
                case 'calidad': userName = 'Calidad'; break;
                case 'desarrollo': userName = 'Desarrollo'; break;
                case 'supervisor': userName = 'Supervisor'; break;
            }
            
            html += `
                <tr>
                    <td>${date}</td>
                    <td>${this.escapeHtml(userName)}</td>
                    <td>Plotter ${a.plotter}</td>
                    <td>${this.escapeHtml(a.fileName)}</td>
                    <td>${percentage}% (${a.progressApproved || 0}/${a.progressTotal || 0})</td>
                    <td>${this.escapeHtml(a.comment || '—')}</td>
                </tr>
            `;
        }
        
        html += `
                    </tbody>
                </table>
                <div class="footer">
                    <p>Alpha Color Match - Sistema de gestión de colores</p>
                </div>
            </body>
            </html>
        `;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
    }
    
    escapeExcel(str) {
        if (!str) return '';
        str = str.toString();
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    
    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
}