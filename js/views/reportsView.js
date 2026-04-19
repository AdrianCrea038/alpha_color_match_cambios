// js/views/reportsView.js
import { supabase } from '../core/supabaseClient.js';

export class ReportsView {
    constructor(app) {
        this.app = app;
        this.rows = [];
        this.summary = null;
        this.chart = null;
        this.period = 'month';
        console.log('✅ ReportsView inicializado');
    }

    updateFilters() {
        const today = new Date();
        const from = document.getElementById('reportsDateFrom');
        const to = document.getElementById('reportsDateTo');
        if (from && !from.value) {
            const d = new Date(today);
            d.setDate(d.getDate() - 30);
            from.value = d.toISOString().slice(0, 10);
        }
        if (to && !to.value) to.value = today.toISOString().slice(0, 10);
        this.attachEvents();
    }

    attachEvents() {
        const searchBtn = document.getElementById('reportsSearchBtn');
        const clearBtn = document.getElementById('reportsClearBtn');
        const exportExcelBtn = document.getElementById('reportsExportCsvBtn');
        const printBtn = document.getElementById('reportsPrintBtn');
        const periodSel = document.getElementById('reportsPeriod');

        if (searchBtn) searchBtn.onclick = () => this.render();
        if (clearBtn) clearBtn.onclick = () => this.clearFilters();
        if (exportExcelBtn) exportExcelBtn.onclick = () => this.exportExcel();
        
        // BOTONES DE REPORTE ESPECIALIZADOS
        if (document.getElementById('reportsBtnProgress')) document.getElementById('reportsBtnProgress').onclick = () => this.exportPdfProgress();
        if (document.getElementById('reportsBtnErrors')) document.getElementById('reportsBtnErrors').onclick = () => this.exportPdfErrors();
        if (document.getElementById('reportsBtnColors')) document.getElementById('reportsBtnColors').onclick = () => this.exportPdfColors();
        
        if (periodSel) periodSel.onchange = () => this.render();
    }

    clearFilters() {
        const ids = ['reportsSearchText', 'reportsDateFrom', 'reportsDateTo', 'reportsUserFilter', 'reportsPlotterFilter', 'reportsTxtFilter'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        this.updateFilters();
        this.render();
    }

    async fetchAssignments() {
        const { data, error } = await supabase
            .from('assignments')
            .select('*')
            .order('fecha_asignacion', { ascending: false });
        if (error) throw error;
        return data || [];
    }

    getComparisonLogs() {
        try {
            return JSON.parse(localStorage.getItem('comparisonReportLogs') || '[]');
        } catch (e) {
            return [];
        }
    }

    getDevelopmentHistory() {
        try {
            return JSON.parse(localStorage.getItem('developmentHistory') || '[]');
        } catch (e) {
            return [];
        }
    }

    async buildReportRows() {
        const assignments = await this.fetchAssignments();
        const comparisonLogs = this.getComparisonLogs();
        const devHistory = this.getDevelopmentHistory();

        const rows = [];
        for (const a of assignments) {
            const start = new Date(a.fecha_asignacion);
            const end = a.estado === 'completado' ? new Date(a.fecha_actualizacion || a.updated_at || a.fecha_asignacion) : new Date();
            const hours = Math.max(0, (end - start) / 36e5);
            rows.push({
                type: 'assignment_time',
                date: a.fecha_asignacion,
                usuario: a.usuario_asignado || 'N/A',
                periodo: this.getPeriodLabel(start, this.period),
                metric: 'Tiempo aprobación (h)',
                value: Number(hours.toFixed(2)),
                txt: a.txt_nombre || a.txt_id || '',
                plotter: a.plotter || ''
            });
        }

        for (const c of comparisonLogs) {
            const dt = new Date(c.createdAt);
            rows.push({
                type: 'compare_mismatch',
                date: c.createdAt,
                usuario: c.user || 'N/A',
                periodo: this.getPeriodLabel(dt, this.period),
                metric: 'Sin coincidencia',
                value: c.unmatched || 0,
                txt: `${c.primaryFile || '-'} vs ${c.secondaryFile || '-'}`,
                plotter: ''
            });
            rows.push({
                type: 'compare_cmyk',
                date: c.createdAt,
                usuario: c.user || 'N/A',
                periodo: this.getPeriodLabel(dt, this.period),
                metric: 'CMYK fuera regla',
                value: c.invalidCmyk || 0,
                txt: `${c.primaryFile || '-'} vs ${c.secondaryFile || '-'}`,
                plotter: ''
            });
        }

        for (const h of devHistory) {
            if (!['APPROVE_COLOR', 'ADD_PENDING', 'CREATE_GROUP'].includes(h.action)) continue;
            const dt = new Date(h.timestamp);
            rows.push({
                type: 'development',
                date: h.timestamp,
                usuario: h.user || 'N/A',
                periodo: this.getPeriodLabel(dt, this.period),
                metric: h.action === 'APPROVE_COLOR' ? 'Colores nuevos desarrollo' : 'TXT/Grupo nuevos desarrollo',
                value: 1,
                txt: h.details || '',
                plotter: ''
            });
        }
        return rows;
    }

    getPeriodLabel(dateObj, period) {
        const d = new Date(dateObj);
        if (period === 'day') return d.toISOString().slice(0, 10);
        if (period === 'week') {
            const first = new Date(d);
            first.setDate(d.getDate() - d.getDay());
            return `Sem ${first.toISOString().slice(0, 10)}`;
        }
        if (period === 'year') return String(d.getFullYear());
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    applyFilters(rows) {
        const search = (document.getElementById('reportsSearchText')?.value || '').toLowerCase();
        const from = document.getElementById('reportsDateFrom')?.value;
        const to = document.getElementById('reportsDateTo')?.value;
        const user = document.getElementById('reportsUserFilter')?.value || '';
        const plotter = document.getElementById('reportsPlotterFilter')?.value || '';

        return rows.filter(r => {
            if (search && !`${r.metric} ${r.txt} ${r.usuario}`.toLowerCase().includes(search)) return false;
            if (user && r.usuario !== user) return false;
            if (plotter && String(r.plotter) !== String(plotter)) return false;
            if (from && new Date(r.date) < new Date(from)) return false;
            if (to) {
                const toDate = new Date(to);
                toDate.setHours(23, 59, 59, 999);
                if (new Date(r.date) > toDate) return false;
            }
            return true;
        });
    }

    renderTable(rows) {
        const tbody = document.getElementById('reportsTableBody');
        const count = document.getElementById('reportsCount');
        if (!tbody || !count) return;
        count.textContent = `Mostrando ${rows.length} registros`;
        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No hay datos para los filtros seleccionados</td></tr>';
            return;
        }
        tbody.innerHTML = rows.map(r => `
            <tr>
                <td>${new Date(r.date).toLocaleString()}</td>
                <td>${r.usuario}</td>
                <td>${r.plotter || '-'}</td>
                <td class="report-filename">${this.escapeHtml(r.txt || '-')}</td>
                <td><strong>${this.escapeHtml(r.metric)}</strong>: ${r.value}</td>
                <td>${this.escapeHtml(r.periodo)}</td>
            </tr>
        `).join('');
    }

    summarize(rows) {
        const sum = { mismatches: 0, invalidCmyk: 0, avgApprovalHours: 0, newColors: 0, newTxt: 0 };
        const approvalValues = [];
        for (const r of rows) {
            if (r.metric === 'Sin coincidencia') sum.mismatches += r.value;
            if (r.metric === 'CMYK fuera regla') sum.invalidCmyk += r.value;
            if (r.metric === 'Tiempo aprobación (h)') approvalValues.push(r.value);
            if (r.metric === 'Colores nuevos desarrollo') sum.newColors += r.value;
            if (r.metric === 'TXT/Grupo nuevos desarrollo') sum.newTxt += r.value;
        }
        sum.avgApprovalHours = approvalValues.length
            ? Number((approvalValues.reduce((a, b) => a + b, 0) / approvalValues.length).toFixed(2))
            : 0;
        return sum;
    }

    async render() {
        const periodMap = { '': 'month', day: 'day', week: 'week', month: 'month', year: 'year' };
        const periodControl = document.getElementById('reportsPeriod');
        this.period = periodMap[periodControl?.value || 'month'] || 'month';

        try {
            const rawRows = await this.buildReportRows();
            this.rows = this.applyFilters(rawRows);
            this.summary = this.summarize(this.rows);
            this.renderTable(this.rows);
            this.populateUserFilter(this.rows);
        } catch (error) {
            const tbody = document.getElementById('reportsTableBody');
            if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Error cargando reportes: ${this.escapeHtml(error.message || String(error))}</td></tr>`;
        }
    }

    populateUserFilter(rows) {
        const sel = document.getElementById('reportsUserFilter');
        if (!sel) return;
        const current = sel.value;
        const users = [...new Set(rows.map(r => r.usuario).filter(Boolean))].sort();
        sel.innerHTML = '<option value="">-- Todos los usuarios --</option>' + users.map(u => `<option value="${u}">${u}</option>`).join('');
        if (users.includes(current)) sel.value = current;
    }

    async ensureExcelJs() {
        if (window.ExcelJS) return;
        await this.loadScript('https://cdn.jsdelivr.net/npm/exceljs@4.3.0/dist/exceljs.min.js');
    }

    async ensureJsPdf() {
        if (window.jspdf?.jsPDF) return;
        await this.loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
        await this.loadScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.5.25/dist/jspdf.plugin.autotable.min.js');
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const existing = [...document.querySelectorAll('script')].find(s => s.src === src);
            if (existing) {
                existing.addEventListener('load', () => resolve());
                if (existing.dataset.loaded === '1') resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => {
                script.dataset.loaded = '1';
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async exportExcel() {
        await this.ensureExcelJs();
        const workbook = new window.ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reporte Ejecutivo');

        // TÍTULO DEL REPORTE
        worksheet.mergeCells('A1:G1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = 'ALPHA COLOR MATCH - REPORTE EJECUTIVO';
        titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0EA5E9' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

        worksheet.getRow(1).height = 40;

        // FECHA Y RESUMEN
        worksheet.getCell('A2').value = `Fecha de Generación: ${new Date().toLocaleString()}`;
        worksheet.getCell('A2').font = { italic: true };
        
        // ENCABEZADOS DE TABLA
        const headerRow = worksheet.getRow(4);
        headerRow.values = ['Fecha', 'Usuario', 'Plotter', 'Archivo', 'Métrica', 'Valor', 'Periodo'];
        headerRow.font = { bold: true, color: { argb: 'FF1E293B' } };
        headerRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            cell.border = { bottom: { style: 'thin' } };
        });

        // DATOS
        this.rows.forEach(r => {
            worksheet.addRow([
                new Date(r.date).toLocaleString(),
                r.usuario,
                r.plotter || 'N/A',
                r.txt || '',
                r.metric,
                r.value,
                r.periodo
            ]);
        });

        // AJUSTE DE COLUMNAS
        worksheet.columns.forEach(column => {
            column.width = 25;
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Reporte_AlphaColor_${new Date().toISOString().slice(0,10)}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    // ============================================
    // GENERADORES DE REPORTES ESPECIALIZADOS (PDF)
    // ============================================

    async drawPdfHeader(doc, title) {
        doc.setFillColor(248, 250, 252); // Fondo muy suave de cabecera
        doc.rect(0, 0, doc.internal.pageSize.width, 40, 'F');
        
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('ALPHA COLOR MATCH', 14, 25);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text('EXECUTIVE QUALITY REPORT', 14, 32);
        
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(16);
        doc.text(title.toUpperCase(), doc.internal.pageSize.width - 14, 25, { align: 'right' });
        
        doc.setFontSize(9);
        doc.text(`Fecha: ${new Date().toLocaleString()}`, doc.internal.pageSize.width - 14, 32, { align: 'right' });
        
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 40, doc.internal.pageSize.width - 14, 40);
    }

    drawPdfBar(doc, x, y, width, height, label, value, color) {
        doc.setFillColor(241, 245, 249); 
        doc.rect(x, y, width, height, 'F');
        
        const progressWidth = (width * Math.min(100, value)) / 100;
        doc.setFillColor(color[0], color[1], color[2]);
        doc.rect(x, y, progressWidth, height, 'F');
        
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(8);
        doc.text(`${label}: ${value}%`, x, y - 2);
    }

    drawPdfDonut(doc, x, y, radius, value, label, color) {
        // Círculo de fondo (Gris claro)
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(4);
        doc.ellipse(x, y, radius, radius, 'S');
        
        // Arco de progreso (Con color)
        // Como jsPDF no tiene un 'drawArc' simple, usamos una técnica de líneas para simular el arco
        doc.setDrawColor(color[0], color[1], color[2]);
        doc.setLineWidth(4);
        
        const segments = 100;
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (Math.PI * 2 * (value / 100));
        
        for (let i = 0; i < segments * (value / 100); i++) {
            const angle1 = startAngle + (i / segments) * Math.PI * 2;
            const angle2 = startAngle + ((i + 1) / segments) * Math.PI * 2;
            
            const x1 = x + radius * Math.cos(angle1);
            const y1 = y + radius * Math.sin(angle1);
            const x2 = x + radius * Math.cos(angle2);
            const y2 = y + radius * Math.sin(angle2);
            
            doc.line(x1, y1, x2, y2);
        }
        
        // Texto central
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`${value}%`, x, y + 2, { align: 'center' });
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(label, x, y + 10, { align: 'center' });
    }

    async exportPdfProgress() {
        await this.ensureJsPdf();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        await this.drawPdfHeader(doc, 'Reporte de Avances');
        
        const assignments = await this.fetchAssignments();
        
        // Dibujar mini-gráficas de resumen primero
        let chartY = 50;
        const top3 = assignments.slice(0, 3);
        doc.setFontSize(10);
        doc.text('RESUMEN DE AVANCES POR ARCHIVO:', 14, chartY - 5);
        
        top3.forEach((a, i) => {
            this.drawPdfBar(doc, 14, chartY + (i * 15), 180, 8, a.txt_nombre, a.progreso, [14, 165, 233]);
        });

        const tableData = assignments.map(a => [
            new Date(a.fecha_asignacion).toLocaleDateString(),
            a.usuario_asignado,
            `Plotter ${a.plotter}`,
            a.txt_nombre,
            `${a.progreso}%`
        ]);

        doc.autoTable({
            startY: chartY + 50,
            head: [['Fecha', 'Usuario', 'Plotter', 'Archivo', 'Progreso']],
            body: tableData,
            headStyles: { fillColor: [14, 165, 233], textColor: 255 },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            margin: { top: 50 }
        });

        // NUEVA SECCIÓN DE ACUMULADOS AL FINAL
        let finalY = doc.lastAutoTable.finalY + 20;
        if (finalY > 230) { doc.addPage(); finalY = 20; }

        doc.setDrawColor(226, 232, 240);
        doc.line(14, finalY, 196, finalY);
        finalY += 10;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('ANÁLISIS ACUMULADO POR EQUIPO', 14, finalY);
        finalY += 15;

        // Calcular promedios por usuario
        const userStats = {};
        assignments.forEach(a => {
            if (!userStats[a.usuario_asignado]) userStats[a.usuario_asignado] = { total: 0, count: 0 };
            userStats[a.usuario_asignado].total += a.progreso;
            userStats[a.usuario_asignado].count++;
        });

        let globalTotal = 0;
        let globalCount = 0;
        
        Object.keys(userStats).forEach((user, i) => {
            const avg = Math.round(userStats[user].total / userStats[user].count);
            this.drawPdfBar(doc, 14, finalY + (i * 15), 120, 6, user, avg, [16, 185, 129]);
            globalTotal += userStats[user].total;
            globalCount += userStats[user].count;
        });

        // Círculo acumulado global
        const globalAvg = globalCount > 0 ? Math.round(globalTotal / globalCount) : 0;
        this.drawPdfDonut(doc, 165, finalY + 15, 20, globalAvg, 'TOTAL GLOBAL', [14, 165, 233]);

        // Asegurar que el texto final no pegue con los gráficos
        const chartHeight = Math.max(Object.keys(userStats).length * 15, 40);
        finalY += chartHeight + 15;
        
        if (finalY > 270) { doc.addPage(); finalY = 20; }
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 116, 139);
        doc.text('Este reporte muestra el acumulado de todo el periodo en la validación de paletas, integrando el esfuerzo individual y colectivo del equipo.', 14, finalY);

        doc.save(`Avances_AlphaColor_${new Date().toISOString().slice(0,10)}.pdf`);
    }

    async exportPdfErrors() {
        await this.ensureJsPdf();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        await this.drawPdfHeader(doc, 'Reporte de Errores');
        
        const logs = this.getComparisonLogs();

        // Gráfica de intensidad de errores
        let chartY = 50;
        doc.setFontSize(10);
        doc.text('INTENSIDAD DE ERRORES POR COMPARACIÓN:', 14, chartY - 5);
        
        logs.slice(0, 3).forEach((l, i) => {
            const totalErr = (l.unmatched || 0) + (l.invalidCmyk || 0);
            const intensity = Math.min(100, totalErr * 5); // Escala visual
            this.drawPdfBar(doc, 14, chartY + (i * 15), 180, 8, l.primaryFile, intensity, [244, 63, 94]);
        });

        const tableData = logs.map(l => [
            new Date(l.createdAt).toLocaleDateString(),
            l.user,
            l.primaryFile,
            l.unmatched || 0,
            l.invalidCmyk || 0
        ]);

        doc.autoTable({
            startY: chartY + 50,
            head: [['Fecha', 'Usuario', 'Archivo Base', 'Sin Coincidencia', 'CMYK Inválido']],
            body: tableData,
            headStyles: { fillColor: [244, 63, 94], textColor: 255 },
            alternateRowStyles: { fillColor: [255, 241, 242] },
            margin: { top: 50 }
        });

        doc.save(`Errores_AlphaColor_${new Date().toISOString().slice(0,10)}.pdf`);
    }

    async exportPdfColors() {
        await this.ensureJsPdf();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        await this.drawPdfHeader(doc, 'Reporte de Colores (Inventario)');
        
        const { data: groups, error } = await supabase
            .from('equivalency_groups')
            .select('*')
            .order('group_id');
            
        const tableData = [];
        if (!error && groups) {
            groups.forEach(row => {
                const gid = row.group_id;
                // Manejar si colors es array o si tenemos que inferir
                const colors = Array.isArray(row.colors) ? row.colors : [row.color_name || row.color];
                colors.forEach(c => {
                    if (c && c !== gid) {
                        tableData.push([c, gid]);
                    } else if (c === gid) {
                        tableData.push([c, `GRUPO MAESTRO (${gid})`]);
                    }
                });
            });
        }

        // Ordenar alfabéticamente
        tableData.sort((a, b) => a[0].localeCompare(b[0]));

        doc.autoTable({
            startY: 50,
            head: [['Nombre del Color', 'Grupo / Lista']],
            body: tableData,
            headStyles: { fillColor: [16, 185, 129], textColor: 255 },
            alternateRowStyles: { fillColor: [240, 253, 244] },
            margin: { top: 50 }
        });

        doc.save(`InventarioColores_AlphaColor_${new Date().toISOString().slice(0,10)}.pdf`);
    }

    async exportPdf() {
        await this.ensureJsPdf();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(16);
        doc.text('Reporte Ejecutivo - Alpha Color Match', 14, 14);
        doc.setFontSize(10);
        doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 22);
        const lines = [
            `Sin coincidencia: ${this.summary?.mismatches || 0}`,
            `CMYK fuera regla: ${this.summary?.invalidCmyk || 0}`,
            `Promedio aprobación (h): ${this.summary?.avgApprovalHours || 0}`,
            `Colores nuevos: ${this.summary?.newColors || 0}`,
            `TXT/Grupos nuevos: ${this.summary?.newTxt || 0}`
        ];
        let y = 32;
        lines.forEach(line => {
            doc.text(line, 14, y);
            y += 7;
        });
        y += 3;
        doc.text('Detalle:', 14, y);
        y += 6;
        this.rows.slice(0, 35).forEach(r => {
            const t = `${new Date(r.date).toLocaleDateString()} | ${r.usuario} | ${r.metric}: ${r.value} | ${String(r.txt || '').slice(0, 70)}`;
            doc.text(t, 14, y);
            y += 5;
            if (y > 190) {
                doc.addPage();
                y = 14;
            }
        });
        doc.save(`reportes_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.pdf`);
    }

    escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}