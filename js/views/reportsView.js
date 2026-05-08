// js/views/reportsView.js
import { supabase } from '../core/supabaseClient.js';

export class ReportsView {
    constructor(app) {
        this.app = app;
        this.rows = [];
        this.assignments = [];
        this.comparisonLogs = [];
        this.chart = null;
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
        const exportExcelBtn = document.getElementById('reportsExportCsvBtn');
        const printBtn = document.getElementById('reportsPrintBtn');
        const toggleTable = document.getElementById('toggleTable');
        const exportGapBtn = document.getElementById('reportsExportGapBtn');

        if (searchBtn) searchBtn.onclick = () => this.render();
        if (exportExcelBtn) exportExcelBtn.onclick = () => this.exportExcel();
        if (printBtn) printBtn.onclick = () => this.exportPdf();
        if (exportGapBtn) exportGapBtn.onclick = () => this.exportGapPdf();
        
        if (toggleTable) {
            toggleTable.onclick = () => {
                const area = document.getElementById('reportsTableArea');
                if (area) {
                    const isHidden = area.style.display === 'none';
                    area.style.display = isHidden ? 'block' : 'none';
                    toggleTable.querySelector('i.fa-chevron-down').style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
                }
            };
        }
    }

    clearFilters() {
        const ids = ['reportsSearchText', 'reportsDateFrom', 'reportsDateTo', 'reportsUserFilter', 'reportsPlotterFilter'];
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
        this.assignments = data || [];
        return this.assignments;
    }

    async fetchComparisonLogs() {
        try {
            const from = document.getElementById('reportsDateFrom')?.value;
            const to = document.getElementById('reportsDateTo')?.value;

            let query = supabase.from('comparison_logs').select('*');
            if (from) query = query.gte('created_at', from);
            if (to) query = query.lte('created_at', to + 'T23:59:59');

            const { data, error } = await query.order('created_at', { ascending: false });
            
            if (error) {
                console.warn('⚠️ No se pudo leer de Supabase (posible tabla faltante), usando LocalStorage:', error.message);
                return JSON.parse(localStorage.getItem('comparisonReportLogs') || '[]');
            }
            return data || [];
        } catch (e) {
            return JSON.parse(localStorage.getItem('comparisonReportLogs') || '[]');
        }
    }

    async buildReportData() {
        const assignments = await this.fetchAssignments();
        const logs = await this.fetchComparisonLogs();
        
        // Traer historial completo (sin filtros) para saber la última fecha real de cada TXT
        const { data: allLogs } = await supabase.from('comparison_logs').select('primary_file, created_at').order('created_at', { ascending: false });
        const lastValidations = {};
        if (allLogs) {
            allLogs.forEach(l => {
                const name = l.primary_file || l.primaryFile;
                if (name && !lastValidations[name]) lastValidations[name] = l.created_at;
            });
        }

        this.comparisonLogs = logs;
        this.assignments = assignments;

        // Filtrar assignments por fecha también para coherencia
        const from = document.getElementById('reportsDateFrom')?.value;
        const to = document.getElementById('reportsDateTo')?.value;
        
        this.filteredAssignments = assignments.filter(a => {
            if (from && new Date(a.fecha_asignacion) < new Date(from)) return false;
            if (to && new Date(a.fecha_asignacion) > new Date(to + 'T23:59:59')) return false;
            return true;
        });

        // Identificar qué archivos NO se auditaron en este periodo
        const auditedFilesThisPeriod = new Set(logs.map(l => l.primary_file || l.primaryFile));
        this.pendingAudits = this.filteredAssignments.filter(a => !auditedFilesThisPeriod.has(a.txt_nombre)).map(a => {
            const lastDate = lastValidations[a.txt_nombre];
            let daysSince = 'N/A';
            if (lastDate) {
                const diff = new Date() - new Date(lastDate);
                daysSince = Math.floor(diff / (1000 * 60 * 60 * 24));
            } else {
                daysSince = 'Nunca';
            }
            return {
                ...a,
                lastValidationDate: lastDate,
                daysSinceToday: daysSince
            };
        });

        this.calculateKpis(logs, this.filteredAssignments);
    }

    calculateKpis(logs, assignments) {
        const totalEvaluated = logs.reduce((s, l) => s + (l.total_colors || 0), 0);
        const totalErrors = logs.reduce((s, l) => s + (l.unmatched || 0) + (l.duplicates || 0) + (l.invalid_cmyk || 0), 0);
        
        const errorPercent = totalEvaluated > 0 ? ((totalErrors / totalEvaluated) * 100).toFixed(1) : 0;
        const qualityPercent = (100 - errorPercent).toFixed(1);

        document.getElementById('kpiTotalEvaluated').textContent = totalEvaluated;
        document.getElementById('kpiErrorPercent').textContent = `${errorPercent}%`;
        document.getElementById('kpiQualityPercent').textContent = `${qualityPercent}%`;
        
        const qBar = document.getElementById('kpiQualityBar');
        if (qBar) qBar.style.width = `${qualityPercent}%`;

        // Alertas Activas
        const REVALIDATION_DAYS = 30;
        const now = new Date();
        const activeAlarms = assignments.filter(a => {
            if (a.estado !== 'completado') return false;
            const completionDate = new Date(a.updated_at || a.fecha_asignacion);
            const daysSince = (now - completionDate) / (1000 * 60 * 60 * 24);
            return daysSince >= REVALIDATION_DAYS - 5;
        }).length;
        document.getElementById('kpiActiveAlarms').textContent = activeAlarms;

        this.renderChart(totalEvaluated - totalErrors, totalErrors);
        this.renderDetailedStats(logs);
    }

    renderDetailedStats(logs) {
        const statsContainer = document.getElementById('reportsErrorStats');
        if (!statsContainer) return;

        const totals = {
            mismatch: logs.reduce((s, l) => s + (l.unmatched || 0), 0),
            cmyk: logs.reduce((s, l) => s + (l.invalid_cmyk || 0), 0),
            dup: logs.reduce((s, l) => s + (l.duplicates || 0), 0),
            corr: logs.reduce((s, l) => s + (l.corrections || 0), 0)
        };

        statsContainer.innerHTML = `
            <div class="stat-badge-detailed">
                <span class="val" style="color: #f43f5e;">${totals.mismatch}</span>
                <span class="lab">No coinciden</span>
            </div>
            <div class="stat-badge-detailed">
                <span class="val" style="color: #ec4899;">${totals.cmyk}</span>
                <span class="lab">Dif. CMYK</span>
            </div>
            <div class="stat-badge-detailed">
                <span class="val" style="color: #fbbf24;">${totals.dup}</span>
                <span class="lab">Duplicados</span>
            </div>
            <div class="stat-badge-detailed">
                <span class="val" style="color: #3b82f6;">${totals.corr}</span>
                <span class="lab">Corregidos</span>
            </div>
        `;

        const listContainer = document.getElementById('recentErrorsList');
        if (listContainer) {
            const recent = logs.slice(0, 5);
            listContainer.innerHTML = recent.map(l => `
                <div class="mini-list-item">
                    <span class="name">${String(l.primary_file || l.primaryFile).split('_').pop()}</span>
                    <span class="count">${(l.unmatched || 0) + (l.duplicates || 0)} err</span>
                </div>
            `).join('') || '<div class="empty-state">No hay registros</div>';
        }
    }

    getPeriodLabel(dateObj, period) {
        const d = new Date(dateObj);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    async ensureChartJs() {
        if (window.Chart) return;
        await this.loadScript('https://cdn.jsdelivr.net/npm/chart.js');
    }

    async renderChart(correct, errors) {
        await this.ensureChartJs();
        const ctx = document.getElementById('reportsMainChart')?.getContext('2d');
        if (!ctx) return;

        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        
        // Verificación adicional de seguridad para Chart.js
        const existingChart = Chart.getChart(ctx.canvas);
        if (existingChart) {
            existingChart.destroy();
        }

        this.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Correctos', 'Con Incidencias'],
                datasets: [{
                    data: [correct, errors],
                    backgroundColor: ['#00e5ff', '#f43f5e'],
                    borderColor: 'rgba(0,0,0,0.1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 10 } } }
                },
                cutout: '70%'
            }
        });
    }

    renderTable(logs) {
        const tbody = document.getElementById('reportsTableBody');
        const pendingBody = document.getElementById('reportsPendingTableBody');
        if (!tbody || !pendingBody) return;
        
        // 1. Tabla de Auditados
        if (!logs.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No hay auditorías en este periodo</td></tr>';
        } else {
            tbody.innerHTML = logs.map(l => {
                const total = l.total_colors || 1;
                const errs = (l.unmatched || 0) + (l.duplicates || 0) + (l.invalid_cmyk || 0);
                const percent = ((errs / total) * 100).toFixed(1);
                return `
                    <tr>
                        <td><span style="font-size: 0.75rem; color: #94a3b8;">${new Date(l.created_at || l.createdAt).toLocaleString()}</span></td>
                        <td><div style="font-weight: 600; color: #e2e8f0;">${l.user}</div></td>
                        <td class="report-filename">${this.escapeHtml(l.primary_file || l.primaryFile || '-')}</td>
                        <td style="text-align:center;">${l.total_colors || '-'}</td>
                        <td style="text-align:center; color: #f43f5e; font-weight: 700;">${errs}</td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div class="kpi-pro-bar-bg" style="flex:1; height:6px; margin-top:0;">
                                    <div class="kpi-pro-bar-fill" style="width: ${percent}%; background: #f43f5e;"></div>
                                </div>
                                <span style="font-size: 0.75rem; font-weight:700; color: #f43f5e;">${percent}%</span>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // 2. Tabla de No Auditados (Pendientes)
        if (!this.pendingAudits || !this.pendingAudits.length) {
            pendingBody.innerHTML = '<tr><td colspan="4" class="empty-state">Todos los archivos del periodo fueron auditados</td></tr>';
        } else {
            pendingBody.innerHTML = this.pendingAudits.map(p => {
                const isNever = p.daysSinceToday === 'Nunca';
                const days = isNever ? '∞' : p.daysSinceToday;
                const color = isNever || p.daysSinceToday > 30 ? '#f43f5e' : (p.daysSinceToday > 15 ? '#fbbf24' : '#10b981');
                
                return `
                    <tr style="background: rgba(244, 63, 94, 0.02);">
                        <td class="report-filename">${this.escapeHtml(p.txt_nombre)}</td>
                        <td><div style="font-weight: 600; color: #94a3b8;">${p.usuario_asignado || 'Sin asignar'}</div></td>
                        <td><span style="font-size: 0.75rem; color: #64748b;">${p.lastValidationDate ? new Date(p.lastValidationDate).toLocaleDateString() : 'NUNCA'}</span></td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-weight: 800; color: ${color};">${days} días</span>
                                <span style="font-size: 0.65rem; color: #64748b;">hasta hoy</span>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    renderPaletteValidation(assignments) {
        const list = document.getElementById('paletteValidationList');
        if (!list) return;

        if (!assignments.length) {
            list.innerHTML = '<div class="empty-state">No hay asignaciones en este periodo</div>';
            return;
        }

        list.innerHTML = assignments.slice(0, 4).map(a => `
            <div class="mini-list-item" style="flex-direction: column; align-items: flex-start; gap: 4px;">
                <div style="display: flex; justify-content: space-between; width: 100%; font-size: 0.8rem;">
                    <span style="font-weight: 600; color: #e2e8f0;">${a.txt_nombre.split('_').pop()}</span>
                    <span style="color: #a78bfa;">${a.progreso}%</span>
                </div>
                <div class="kpi-pro-bar-bg" style="width: 100%; height: 6px; margin-top: 0;">
                    <div class="kpi-pro-bar-fill" style="width: ${a.progreso}%; background: linear-gradient(90deg, #a78bfa, #7c3aed);"></div>
                </div>
            </div>
        `).join('');
    }

    renderAlarms(assignments) {
        const list = document.getElementById('reportsAlarmsList');
        if (!list) return;

        const REVALIDATION_DAYS = 30;
        const now = new Date();
        const alarms = assignments.filter(a => {
            if (a.estado !== 'completado') return false;
            const completionDate = new Date(a.updated_at || a.fecha_asignacion);
            const daysSince = (now - completionDate) / (1000 * 60 * 60 * 24);
            return daysSince >= REVALIDATION_DAYS - 5;
        });

        if (!alarms.length) {
            list.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle" style="color: #10b981;"></i> Sin alertas de re-validación</div>';
            return;
        }

        list.innerHTML = alarms.slice(0, 4).map(a => {
            const completionDate = new Date(a.updated_at || a.fecha_asignacion);
            const daysSince = Math.floor((now - completionDate) / (1000 * 60 * 60 * 24));
            const isUrgent = daysSince >= REVALIDATION_DAYS;
            return `
                <div class="mini-list-item" style="border-left: 3px solid ${isUrgent ? '#f43f5e' : '#fbbf24'}; padding-left: 10px;">
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-weight: 600; color: #e2e8f0; font-size: 0.8rem;">${a.txt_nombre.split('_').pop()}</span>
                        <span style="font-size: 0.7rem; color: #94a3b8;">Validado hace ${daysSince} días</span>
                    </div>
                    <i class="fas fa-exclamation-triangle" style="color: ${isUrgent ? '#f43f5e' : '#fbbf24'};"></i>
                </div>
            `;
        }).join('');
    }

    async render() {
        try {
            await this.buildReportData();
            this.renderTable(this.comparisonLogs);
            this.renderPaletteValidation(this.filteredAssignments);
            this.renderAlarms(this.assignments); // Alarmas usan historial total
            this.populateUserFilter(this.comparisonLogs);
            this.attachEvents();
        } catch (error) {
            console.error('Error rendering reports:', error);
            const tbody = document.getElementById('reportsTableBody');
            if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Error cargando reportes: ${error.message}</td></tr>`;
        }
    }

    populateUserFilter(logs) {
        const sel = document.getElementById('reportsUserFilter');
        if (!sel) return;
        const current = sel.value;
        const users = [...new Set(logs.map(l => l.user).filter(Boolean))].sort();
        sel.innerHTML = '<option value="">Todos</option>' + users.map(u => `<option value="${u}">${u}</option>`).join('');
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
                if (existing.dataset.loaded === '1') resolve();
                else existing.addEventListener('load', () => resolve());
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => { script.dataset.loaded = '1'; resolve(); };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async exportExcel() {
        await this.ensureExcelJs();
        const workbook = new window.ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reporte Ejecutivo');

        worksheet.addRow(['ALPHA COLOR MATCH - REPORTE DE GESTIÓN']);
        worksheet.addRow(['Fecha:', new Date().toLocaleString()]);
        worksheet.addRow([]);
        worksheet.addRow(['Fecha', 'Usuario', 'Archivo', 'Total Colores', 'Errores', '% Error']);
        
        this.comparisonLogs.forEach(l => {
            const errs = (l.unmatched || 0) + (l.duplicates || 0) + (l.invalid_cmyk || 0);
            worksheet.addRow([
                new Date(l.created_at || l.createdAt).toLocaleString(),
                l.user,
                l.primary_file || l.primaryFile || '',
                l.total_colors || 0,
                errs,
                `${l.total_colors > 0 ? ((errs / l.total_colors) * 100).toFixed(1) : 0}%`
            ]);
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Reporte_Calidad_${new Date().toISOString().slice(0,10)}.xlsx`;
        a.click();
    }

    async exportPdf() {
        await this.ensureJsPdf();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const logs = this.comparisonLogs;
        
        // 1. Cabecera Premium
        await this.drawPdfHeader(doc, 'Reporte Ejecutivo de Calidad');
        
        // 2. Sección de KPIs de Calidad
        let startY = 45;
        const totalEvaluated = logs.reduce((s, l) => s + (l.total_colors || 0), 0);
        const totalErrors = logs.reduce((s, l) => s + (l.unmatched || 0) + (l.duplicates || 0) + (l.invalid_cmyk || 0), 0);
        const errorPercent = totalEvaluated > 0 ? ((totalErrors / totalEvaluated) * 100).toFixed(1) : 0;
        const qualityPercent = (100 - errorPercent).toFixed(1);

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('RESUMEN DE CALIDAD DEL PERIODO', 14, startY);
        
        startY += 8;
        // Dibujar cajas de KPIs
        const kw = 58;
        const kh = 22;
        
        // Caja 1: Total
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(14, startY, kw, kh, 3, 3, 'F');
        doc.setFontSize(8); doc.setTextColor(100, 116, 139); doc.text('COLORES EVALUADOS', 14 + kw/2, startY + 8, { align: 'center' });
        doc.setFontSize(14); doc.setTextColor(30, 41, 59); doc.text(String(totalEvaluated), 14 + kw/2, startY + 16, { align: 'center' });

        // Caja 2: % Calidad (Verde)
        doc.setFillColor(240, 253, 244);
        doc.roundedRect(14 + kw + 5, startY, kw, kh, 3, 3, 'F');
        doc.setFontSize(8); doc.setTextColor(22, 163, 74); doc.text('% DE CALIDAD', 14 + kw + 5 + kw/2, startY + 8, { align: 'center' });
        doc.setFontSize(14); doc.text(`${qualityPercent}%`, 14 + kw + 5 + kw/2, startY + 16, { align: 'center' });

        // Caja 3: % Error (Rojo)
        doc.setFillColor(254, 242, 242);
        doc.roundedRect(14 + (kw + 5) * 2, startY, kw, kh, 3, 3, 'F');
        doc.setFontSize(8); doc.setTextColor(220, 38, 38); doc.text('% DE ERROR', 14 + (kw + 5) * 2 + kw/2, startY + 8, { align: 'center' });
        doc.setFontSize(14); doc.text(`${errorPercent}%`, 14 + (kw + 5) * 2 + kw/2, startY + 16, { align: 'center' });

        // 3. Tabla de Auditados
        const tableData = logs.map(l => {
            const errs = (l.unmatched || 0) + (l.duplicates || 0) + (l.invalid_cmyk || 0);
            return [
                new Date(l.created_at || l.createdAt).toLocaleDateString(),
                l.user,
                String(l.primary_file || l.primaryFile || '').split('_').pop().slice(0, 40),
                l.total_colors || 0,
                errs,
                `${l.total_colors > 0 ? ((errs / l.total_colors) * 100).toFixed(1) : 0}%`
            ];
        });

        doc.autoTable({
            startY: startY + kh + 15,
            head: [['Fecha', 'Usuario', 'Archivo', 'Total Col.', 'Errores', '% Error']],
            body: tableData,
            headStyles: { fillColor: [30, 41, 59], textColor: 255 },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            margin: { left: 14, right: 14 }
        });

        // 4. Nueva Sección: Brecha de Auditoría
        if (this.pendingAudits && this.pendingAudits.length > 0) {
            doc.addPage();
            await this.drawPdfHeader(doc, 'Brecha de Auditoría (Pendientes)');
            
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(220, 38, 38);
            doc.text('ARCHIVOS QUE NO SE AUDITARON EN ESTE PERIODO', 14, 45);
            
            const pendingData = this.pendingAudits.map(p => [
                p.txt_nombre,
                p.usuario_asignado || 'Sin asignar',
                p.lastValidationDate ? new Date(p.lastValidationDate).toLocaleDateString() : 'NUNCA',
                `${p.daysSinceToday} días`
            ]);

            doc.autoTable({
                startY: 52,
                head: [['Archivo TXT', 'Responsable', 'Últ. Val. Real', 'Días sin Validar (Hasta Hoy)']],
                body: pendingData,
                headStyles: { fillColor: [220, 38, 38], textColor: 255 },
                alternateRowStyles: { fillColor: [254, 242, 242] },
                margin: { left: 14, right: 14 }
            });
        }

        const from = document.getElementById('reportsDateFrom')?.value || 'inicio';
        const to = document.getElementById('reportsDateTo')?.value || 'fin';
        doc.save(`Reporte_Calidad_${from}_a_${to}.pdf`);
    }

    async exportGapPdf() {
        if (!this.pendingAudits || this.pendingAudits.length === 0) {
            alert('No hay archivos pendientes para exportar en este periodo.');
            return;
        }

        await this.ensureJsPdf();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        await this.drawPdfHeader(doc, 'Brecha de Auditoría y Envejecimiento');
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 38, 38);
        doc.text('RESUMEN DE ARCHIVOS NO AUDITADOS (DÍAS DE RETRASO)', 14, 45);
        
        const pendingData = this.pendingAudits.map(p => [
            p.txt_nombre,
            p.usuario_asignado || 'Sin asignar',
            p.lastValidationDate ? new Date(p.lastValidationDate).toLocaleDateString() : 'NUNCA',
            `${p.daysSinceToday} días`
        ]);

        doc.autoTable({
            startY: 52,
            head: [['Archivo TXT', 'Responsable', 'Últ. Val. Real', 'Días sin Validar (Hasta Hoy)']],
            body: pendingData,
            headStyles: { fillColor: [220, 38, 38], textColor: 255 },
            alternateRowStyles: { fillColor: [254, 242, 242] },
            margin: { left: 14, right: 14 }
        });

        const from = document.getElementById('reportsDateFrom')?.value || 'inicio';
        const to = document.getElementById('reportsDateTo')?.value || 'fin';
        doc.save(`Brecha_Auditoria_${from}_a_${to}.pdf`);
    }

    async drawPdfHeader(doc, title) {
        const pageWidth = doc.internal.pageSize.width;
        
        // Fondo sutil para el encabezado
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 0, pageWidth, 35, 'F');
        
        // Marca / Logo (Izquierda)
        doc.setTextColor(15, 23, 42); // Slate 900
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('ALPHA COLOR MATCH', 14, 18);
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139); // Slate 500
        doc.text('EXECUTIVE QUALITY SYSTEM', 14, 25);
        
        // Título del Reporte (Derecha)
        doc.setTextColor(30, 41, 59); // Slate 800
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(title.toUpperCase(), pageWidth - 14, 18, { align: 'right' });
        
        // Fecha y Hora (Derecha)
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(`Fecha: ${new Date().toLocaleString()}`, pageWidth - 14, 25, { align: 'right' });
        
        // Línea divisoria elegante
        doc.setDrawColor(226, 232, 240); // Slate 200
        doc.setLineWidth(0.5);
        doc.line(14, 30, pageWidth - 14, 30);
    }

    escapeHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
    }
}