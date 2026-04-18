import { ReportsView } from './reportsView.js';

export class DashboardView {
    constructor(app) {
        this.app = app;
        this.reportEngine = new ReportsView(app);
        this.mainChart = null;
        this.secondaryChart = null;
    }

    async ensureChartJs() {
        if (window.Chart) return;
        await new Promise((resolve, reject) => {
            const src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js';
            const existing = [...document.querySelectorAll('script')].find(s => s.src === src);
            if (existing) {
                existing.addEventListener('load', () => resolve());
                if (existing.dataset.loaded === '1') resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                script.dataset.loaded = '1';
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    attachEvents() {
        ['dashboardPeriod', 'dashboardDateFrom', 'dashboardDateTo'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.onchange = () => this.renderCharts();
        });
        const toggles = document.getElementById('dashboardMetricToggles');
        if (toggles) {
            toggles.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.onchange = () => this.renderCharts();
            });
        }
        
        ['toggleTxtProgress', 'togglePeriodSummary', 'toggleCharts'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.onchange = () => this.toggleSections();
        });
    }

    toggleSections() {
        const toggleTxt = document.getElementById('toggleTxtProgress');
        const togglePeriod = document.getElementById('togglePeriodSummary');
        const toggleCharts = document.getElementById('toggleCharts');
        
        const secTxt = document.getElementById('sectionTxtProgress');
        const secPeriod = document.getElementById('sectionPeriodSummary');
        const secCharts = document.getElementById('sectionCharts');
        
        if (secTxt) secTxt.style.display = toggleTxt?.checked ? 'block' : 'none';
        if (secPeriod) secPeriod.style.display = togglePeriod?.checked ? 'block' : 'none';
        if (secCharts) secCharts.style.display = toggleCharts?.checked ? 'block' : 'none';
    }

    getSelectedMetrics() {
        const toggles = document.querySelectorAll('#dashboardMetricToggles input[type="checkbox"]');
        const selected = new Set();
        toggles.forEach(cb => {
            if (cb.checked) selected.add(cb.value);
        });
        return selected;
    }

    renderMetricToggles() {
        const container = document.getElementById('dashboardMetricToggles');
        if (!container || container.childElementCount > 0) return;
        const metrics = [
            ['Sin coincidencia', true],
            ['CMYK fuera regla', true],
            ['Tiempo aprobación (h)', true],
            ['Colores nuevos desarrollo', true],
            ['TXT/Grupo nuevos desarrollo', true]
        ];
        container.innerHTML = metrics.map(([name, checked]) => `
            <label class="dashboard-toggle-item" style="color:#e2e8f0; display:flex; gap:0.5rem; align-items:center;">
                <input type="checkbox" value="${name}" ${checked ? 'checked' : ''} style="accent-color:#ff007f;"> ${name}
            </label>
        `).join('');
    }

    renderKpis(summary) {
        const container = document.getElementById('dashboardKpis');
        if (!container) return;
        const cards = [
            ['Sin coincidencia', summary.mismatches, '📌', '#ff007f'],
            ['CMYK fuera regla', summary.invalidCmyk, '🎯', '#00e5ff'],
            ['Promedio aprobación (h)', summary.avgApprovalHours, '⏱️', '#ff8c00'],
            ['Colores nuevos', summary.newColors, '🎨', '#7f00ff'],
            ['TXT/Grupos nuevos', summary.newTxt, '📄', '#4ade80']
        ];
        container.innerHTML = `<div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 2rem;">` + 
            cards.map(([title, value, icon, color]) => `
            <div class="neon-card" style="flex: 1; min-width: 150px; padding: 1rem;">
                <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">${icon}</div>
                <div style="font-size: 1.5rem; font-weight: bold; color: ${color};">${value}</div>
                <div style="font-size: 0.8rem; color: #9ca3af;">${title}</div>
            </div>
        `).join('') + `</div>`;
    }

    buildSeries(rows, selectedMetrics) {
        const grouped = new Map();
        for (const row of rows) {
            if (!selectedMetrics.has(row.metric)) continue;
            if (!grouped.has(row.periodo)) grouped.set(row.periodo, {});
            const bucket = grouped.get(row.periodo);
            bucket[row.metric] = (bucket[row.metric] || 0) + Number(row.value || 0);
        }
        const labels = [...grouped.keys()].sort();
        const metricList = [...selectedMetrics];
        const datasets = metricList.map((metric, idx) => {
            const colors = ['#00e5ff', '#ff007f', '#4ade80', '#ff8c00', '#a78bfa'];
            return {
                label: metric,
                data: labels.map(label => grouped.get(label)?.[metric] || 0),
                borderColor: colors[idx % colors.length],
                backgroundColor: `${colors[idx % colors.length]}55`,
                tension: 0.4,
                fill: true
            };
        });
        return { labels, datasets };
    }

    async renderTxtProgress() {
        const grid = document.getElementById('txtProgressGrid');
        if (!grid) return;
        
        try {
            const assignments = await this.reportEngine.fetchAssignments();
            
            if (!assignments || assignments.length === 0) {
                grid.innerHTML = '<div style="color:#9ca3af; padding: 1rem;">No hay TXTs asignados.</div>';
                return;
            }
            
            grid.innerHTML = assignments.map((a, i) => {
                const prog = a.progreso || 0;
                const colors = ['#ff007f', '#00e5ff', '#ff8c00', '#7f00ff', '#4ade80'];
                const color = colors[i % colors.length];
                
                return `
                    <div class="neon-card">
                        <div class="circular-progress" style="--progress: ${prog}; --progress-color: ${color};">
                            <span class="circular-progress-value">${prog}%</span>
                            <span class="circular-progress-text">AVANCE</span>
                        </div>
                        <div class="neon-card-info">
                            <h5 class="neon-card-title" title="${a.txt_nombre || a.txt_id}">${a.txt_nombre || a.txt_id}</h5>
                            <p class="neon-card-subtitle"><i class="fas fa-user"></i> ${a.usuario_asignado}</p>
                            <p class="neon-card-subtitle" style="margin-top: 5px; font-size: 0.75rem;"><i class="fas fa-print"></i> Plotter ${a.plotter}</p>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (e) {
            console.error('Error rendering TXT progress:', e);
        }
    }

    async renderPeriodSummary() {
        const grid = document.getElementById('periodSummaryGrid');
        if (!grid) return;
        
        try {
            const assignments = await this.reportEngine.fetchAssignments();
            
            let totalProg = 0;
            const now = new Date();
            
            let countDay = 0, progDay = 0;
            let countWeek = 0, progWeek = 0;
            let countMonth = 0, progMonth = 0;
            
            assignments.forEach(a => {
                totalProg += (a.progreso || 0);
                const dt = new Date(a.fecha_asignacion);
                const diffTime = Math.abs(now - dt);
                const diffDays = diffTime / (1000 * 60 * 60 * 24);
                
                if (diffDays <= 1) { countDay++; progDay += (a.progreso || 0); }
                if (diffDays <= 7) { countWeek++; progWeek += (a.progreso || 0); }
                if (diffDays <= 30) { countMonth++; progMonth += (a.progreso || 0); }
            });
            
            const totalCount = assignments.length;
            const avgTotal = totalCount ? Math.round(totalProg / totalCount) : 0;
            const avgDay = countDay ? Math.round(progDay / countDay) : 0;
            const avgWeek = countWeek ? Math.round(progWeek / countWeek) : 0;
            const avgMonth = countMonth ? Math.round(progMonth / countMonth) : 0;
            
            grid.innerHTML = `
                <div class="neon-card" style="align-items: flex-start;">
                    <div class="neon-stat-card" style="width: 100%; --stat-color: #00e5ff; --stat-color-glow: rgba(0,229,255,0.5);">
                        <div class="neon-stat-info">
                            <span class="neon-stat-label">Total TXT Asignados</span>
                            <span class="neon-stat-value">${totalCount}</span>
                            <span class="neon-stat-subvalue">Avance Global: ${avgTotal}%</span>
                        </div>
                        <div class="neon-stat-icon"><i class="fas fa-file-alt"></i></div>
                    </div>
                </div>
                
                <div class="neon-card" style="align-items: flex-start;">
                    <div class="neon-stat-card" style="width: 100%; --stat-color: #ff007f; --stat-color-glow: rgba(255,0,127,0.5);">
                        <div class="neon-stat-info">
                            <span class="neon-stat-label">Hoy (24h)</span>
                            <span class="neon-stat-value">${countDay}</span>
                            <span class="neon-stat-subvalue">Avance: ${avgDay}%</span>
                        </div>
                        <div class="neon-stat-icon"><i class="fas fa-calendar-day"></i></div>
                    </div>
                </div>
                
                <div class="neon-card" style="align-items: flex-start;">
                    <div class="neon-stat-card" style="width: 100%; --stat-color: #ff8c00; --stat-color-glow: rgba(255,140,0,0.5);">
                        <div class="neon-stat-info">
                            <span class="neon-stat-label">Esta Semana</span>
                            <span class="neon-stat-value">${countWeek}</span>
                            <span class="neon-stat-subvalue">Avance: ${avgWeek}%</span>
                        </div>
                        <div class="neon-stat-icon"><i class="fas fa-calendar-week"></i></div>
                    </div>
                </div>
                
                <div class="neon-card" style="align-items: flex-start;">
                    <div class="neon-stat-card" style="width: 100%; --stat-color: #7f00ff; --stat-color-glow: rgba(127,0,255,0.5);">
                        <div class="neon-stat-info">
                            <span class="neon-stat-label">Este Mes</span>
                            <span class="neon-stat-value">${countMonth}</span>
                            <span class="neon-stat-subvalue">Avance: ${avgMonth}%</span>
                        </div>
                        <div class="neon-stat-icon"><i class="fas fa-calendar-alt"></i></div>
                    </div>
                </div>
            `;
            
        } catch (e) {
            console.error('Error rendering period summary:', e);
        }
    }

    async renderCharts() {
        const period = document.getElementById('dashboardPeriod')?.value || 'month';
        this.reportEngine.period = period;
        const rawRows = await this.reportEngine.buildReportRows();

        const from = document.getElementById('dashboardDateFrom')?.value;
        const to = document.getElementById('dashboardDateTo')?.value;
        const rows = rawRows.filter(r => {
            if (from && new Date(r.date) < new Date(from)) return false;
            if (to) {
                const td = new Date(to);
                td.setHours(23, 59, 59, 999);
                if (new Date(r.date) > td) return false;
            }
            return true;
        });

        const selectedMetrics = this.getSelectedMetrics();
        const filteredRows = rows.filter(r => selectedMetrics.has(r.metric));
        const summary = this.reportEngine.summarize(filteredRows);
        this.renderKpis(summary);

        const mainCtx = document.getElementById('dashboardMainChart');
        const secCtx = document.getElementById('dashboardSecondaryChart');
        if (!mainCtx || !secCtx) return;

        const series = this.buildSeries(filteredRows, selectedMetrics);
        if (this.mainChart) this.mainChart.destroy();
        if (this.secondaryChart) this.secondaryChart.destroy();

        window.Chart.defaults.color = '#9ca3af';
        window.Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';

        this.mainChart = new window.Chart(mainCtx, {
            type: 'line',
            data: series,
            options: {
                plugins: { legend: { labels: { color: '#e2e8f0' } } },
                scales: {
                    x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        });

        const byUser = new Map();
        filteredRows.forEach(r => {
            byUser.set(r.usuario, (byUser.get(r.usuario) || 0) + Number(r.value || 0));
        });
        
        const barColors = ['#ff007f', '#00e5ff', '#ff8c00', '#7f00ff', '#4ade80'];
        this.secondaryChart = new window.Chart(secCtx, {
            type: 'bar',
            data: {
                labels: [...byUser.keys()],
                datasets: [{
                    label: 'Total por usuario',
                    data: [...byUser.values()],
                    backgroundColor: barColors.map(c => c + 'aa'),
                    borderColor: barColors,
                    borderWidth: 1,
                    borderRadius: 5
                }]
            },
            options: {
                plugins: { legend: { labels: { color: '#e2e8f0' } } },
                scales: {
                    x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        });
    }

    async render() {
        this.renderMetricToggles();
        this.attachEvents();
        this.toggleSections();
        await this.ensureChartJs();
        
        await this.renderTxtProgress();
        await this.renderPeriodSummary();
        await this.renderCharts();
    }
}
