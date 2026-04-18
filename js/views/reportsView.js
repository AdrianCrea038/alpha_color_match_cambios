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
        if (printBtn) printBtn.onclick = () => this.exportPdf();
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

    async ensureSheetJs() {
        if (window.XLSX) return;
        await this.loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
    }

    async ensureJsPdf() {
        if (window.jspdf?.jsPDF) return;
        await this.loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
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
        await this.ensureSheetJs();
        const rows = this.rows.map(r => ({
            Fecha: new Date(r.date).toLocaleString(),
            Usuario: r.usuario,
            Plotter: r.plotter || '',
            Métrica: r.metric,
            Valor: r.value,
            Contexto: r.txt || '',
            Periodo: r.periodo
        }));
        const ws = window.XLSX.utils.json_to_sheet(rows);
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, 'Reportes');
        window.XLSX.writeFile(wb, `reportes_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`);
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