import { ReportsView } from './reportsView.js';

export class DashboardView {
    constructor(app) {
        this.app = app;
        this.reportEngine = new ReportsView(app);
        this.mainChart = null;
        this.secondaryChart = null;
        this.userDistChart = null;
        this.lastDataHash = null;
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
        ['dashboardPeriod', 'dashboardDateFrom', 'dashboardDateTo', 'summaryPeriodSelect', 'summaryDateFrom', 'summaryDateTo'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.onchange = () => {
                if (id.startsWith('summary')) this.renderPeriodSummary();
                else this.renderCharts();
            };
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

        const btnProject = document.getElementById('btnProjectMode');
        if (btnProject) btnProject.onclick = () => this.toggleProjectionMode();

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.body.classList.contains('projection-mode')) {
                this.toggleProjectionMode();
            }
        });
    }

    toggleProjectionMode() {
        const isProjecting = document.body.classList.toggle('projection-mode');
        const btn = document.getElementById('btnProjectMode');
        
        if (isProjecting) {
            btn.innerHTML = '<i class="fas fa-times"></i> Salir';
            btn.style.borderColor = '#ff007f';
            btn.style.color = '#ff007f';
            
            // Ocultar TODO el ruido
            document.querySelectorAll('nav, .sidebar-menu, .header, .dashboard-menu, .reports-filters, .dashboard-neon-section:not(#sectionPeriodSummary):not(#sectionTxtProgress), .dashboard-filter-mini > *:not(#btnProjectMode)')
                .forEach(el => el.style.display = 'none');
            
            const dashboardContent = document.querySelector('.dashboard-content');
            if (dashboardContent) {
                dashboardContent.style.padding = '3rem';
                dashboardContent.style.background = '#0f172a';
                dashboardContent.style.position = 'fixed';
                dashboardContent.style.top = '0';
                dashboardContent.style.left = '0';
                dashboardContent.style.width = '100vw';
                dashboardContent.style.height = '100vh';
                dashboardContent.style.zIndex = '99999';
                dashboardContent.style.overflowY = 'auto';
            }
            
            const mainContainer = document.querySelector('.main-container');
            if (mainContainer) mainContainer.style.marginLeft = '0';
            
            // Forzar visualización de las secciones operativas
            const secSummary = document.getElementById('sectionPeriodSummary');
            const secProgress = document.getElementById('sectionTxtProgress');
            if (secSummary) {
                secSummary.style.display = 'block';
                const dateContainer = secSummary.querySelector('#summaryDateContainer');
                const periodSelect = secSummary.querySelector('#summaryPeriodSelect');
                const diagramWrapper = secSummary.querySelector('.summary-diagram-wrapper');
                if (dateContainer) dateContainer.style.display = 'none';
                if (periodSelect) periodSelect.style.display = 'none';
                if (diagramWrapper) {
                    diagramWrapper.style.display = 'grid';
                    diagramWrapper.style.gridTemplateColumns = '1.5fr 1fr 1fr';
                }
            }
            if (secProgress) secProgress.style.display = 'block';
            
        } else {
            btn.innerHTML = '<i class="fas fa-desktop"></i> Proyectar Avance';
            btn.style.borderColor = '#a78bfa';
            btn.style.color = '#a78bfa';
            
            // Restaurar todo
            document.querySelectorAll('.sidebar-menu, .header, nav, .dashboard-menu, .reports-filters, .dashboard-neon-section, .dashboard-filter-mini > *, #summaryDateContainer, #summaryPeriodSelect, .summary-diagram-wrapper')
                .forEach(el => el.style.display = '');
            
            const dashboardContent = document.querySelector('.dashboard-content');
            if (dashboardContent) dashboardContent.style.cssText = '';
            
            const mainContainer = document.querySelector('.main-container');
            if (mainContainer) mainContainer.style.cssText = '';
            
            const diagramWrapper = document.querySelector('.summary-diagram-wrapper');
            if (diagramWrapper) diagramWrapper.style.display = 'grid';

            this.toggleSections(); 
        }
        
        if (this.mainChart) this.mainChart.resize();
        if (this.secondaryChart) this.secondaryChart.resize();
        if (this.userDistChart) this.userDistChart.resize();
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
                <input type="checkbox" value="${name}" ${checked ? 'checked' : ''} style="accent-color:#00ff88;"> ${name}
            </label>
        `).join('');
    }

    renderKpis(summary) {
        const container = document.getElementById('dashboardKpis');
        if (!container) return;
        const cards = [
            ['Sin coincidencia', summary.mismatches, '📌', '#00ff88'],
            ['CMYK fuera regla', summary.invalidCmyk, '🎯', '#00e5ff'],
            ['Promedio aprobación (h)', summary.avgApprovalHours, '⏱️', '#ff8c00'],
            ['Colores nuevos', summary.newColors, '🎨', '#7f00ff'],
            ['TXT/Grupos nuevos', summary.newTxt, '📄', '#00ff88']
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
            const colors = ['#00e5ff', '#00ff88', '#00ff88', '#ff8c00', '#a78bfa'];
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
            
            // Si la cuadrícula está vacía, hacemos el render inicial
            if (grid.children.length === 0 || grid.querySelector('.empty-state')) {
                grid.innerHTML = assignments.map((a, i) => {
                    const prog = a.progreso || 0;
                    const colors = ['#00ff88', '#00e5ff', '#ff8c00', '#7f00ff', '#3b82f6'];
                    const color = colors[i % colors.length];
                    return `
                        <div class="neon-card" data-txt-id="${a.txt_id || a.txt_nombre}">
                            <div class="circular-progress" style="--progress: ${prog}; --progress-color: ${color};">
                                <span class="circular-progress-value">${prog}%</span>
                                <span class="circular-progress-text">AVANCE</span>
                            </div>
                            <div class="neon-card-info">
                                <h5 class="neon-title green" title="${a.txt_nombre || a.txt_id}">${a.txt_nombre || a.txt_id}</h5>
                                <p class="neon-card-subtitle"><i class="fas fa-user"></i> ${a.usuario_asignado}</p>
                                <p class="neon-card-subtitle" style="margin-top: 5px; font-size: 0.75rem;"><i class="fas fa-print"></i> Plotter ${a.plotter}</p>
                            </div>
                        </div>
                    `;
                }).join('');
                return;
            }

            // Si ya hay elementos, actualizamos solo los valores
            assignments.forEach((a, i) => {
                const txtId = a.txt_id || a.txt_nombre;
                const card = grid.querySelector(`[data-txt-id="${txtId}"]`);
                if (card) {
                    const prog = a.progreso || 0;
                    const progressEl = card.querySelector('.circular-progress');
                    const valueEl = card.querySelector('.circular-progress-value');
                    
                    if (progressEl) progressEl.style.setProperty('--progress', prog);
                    if (valueEl) valueEl.textContent = `${prog}%`;
                }
            });
            
        } catch (e) {
            console.error('Error rendering TXT progress:', e);
        }
    }

    async renderPeriodSummary() {
        const grid = document.getElementById('periodSummaryGrid');
        if (!grid) return;
        
        const period = document.getElementById('summaryPeriodSelect')?.value || 'month';
        const dateFrom = document.getElementById('summaryDateFrom')?.value;
        const dateTo = document.getElementById('summaryDateTo')?.value;
        
        try {
            const assignments = await this.reportEngine.fetchAssignments();
            const now = new Date();
            
            let filtered = [];
            let title = "";
            let color = "#00e5ff";
            let icon = "fa-calendar-alt";

            if (period === 'custom' || (dateFrom || dateTo)) {
                filtered = assignments.filter(a => {
                    const dt = new Date(a.fecha_asignacion);
                    if (dateFrom && dt < new Date(dateFrom)) return false;
                    if (dateTo) {
                        const dtTo = new Date(dateTo);
                        dtTo.setHours(23, 59, 59, 999);
                        if (dt > dtTo) return false;
                    }
                    return true;
                });
                title = "Rango Personalizado";
                color = "#00ff88";
                icon = "fa-calendar-check";
                // Sincronizar select si se usaron fechas directamente
                const select = document.getElementById('summaryPeriodSelect');
                if (select && select.value !== 'custom') select.value = 'custom';
            } else if (period === 'all') {
                filtered = assignments;
                title = "Histórico Total";
                color = "#00e5ff";
                icon = "fa-globe";
            } else {
                const limitDays = period === 'day' ? 1 : (period === 'week' ? 7 : 30);
                filtered = assignments.filter(a => {
                    const dt = new Date(a.fecha_asignacion);
                    const diffDays = Math.abs(now - dt) / (1000 * 60 * 60 * 24);
                    return diffDays <= limitDays;
                });
                title = period === 'day' ? "Hoy (24h)" : (period === 'week' ? "Esta Semana" : "Este Mes");
                color = period === 'day' ? "#ff007f" : (period === 'week' ? "#ff8c00" : "#7f00ff");
                icon = period === 'day' ? "fa-calendar-day" : (period === 'week' ? "fa-calendar-week" : "fa-calendar-alt");
            }
            
            const totalCount = filtered.length;
            const totalProg = filtered.reduce((acc, a) => acc + (a.progreso || 0), 0);
            const avgProg = totalCount ? Math.round(totalProg / totalCount) : 0;
            
            // Si ya existe la estructura, solo actualizamos valores para evitar parpadeo
            if (grid.children.length === 4) {
                const values = [
                    [`${totalCount} TXTs`, color],
                    [`${avgProg}%`, '#00e5ff'],
                    [Math.round(totalCount / (period === 'week' ? 7 : (period === 'month' ? 30 : 1))), '#00ff88'],
                    [`${avgProg}%`, '#3b82f6']
                ];
                
                grid.querySelectorAll('.neon-card').forEach((card, i) => {
                    const valEl = card.querySelector('.neon-stat-value') || card.querySelector('[style*="font-size: 1.2rem"]');
                    if (valEl) {
                        valEl.textContent = values[i][0];
                        if (values[i][1]) valEl.style.color = values[i][1];
                    }
                    // Actualizar etiqueta del primer card si cambia el periodo
                    if (i === 0) {
                        const labelEl = card.querySelector('.neon-stat-label');
                        if (labelEl) labelEl.textContent = title;
                    }
                });
                return;
            }

            // Si no existe, creamos la estructura base
            grid.innerHTML = `
                <div class="neon-card" style="padding: 0.8rem;">
                    <div class="neon-stat-card" style="width: 100%; --stat-color: ${color}; --stat-color-glow: ${color}33;">
                        <div class="neon-stat-info">
                            <span class="neon-stat-label" style="font-size: 0.6rem;">${title}</span>
                            <span class="neon-stat-value" style="font-size: 1.1rem; color: ${color};">${totalCount} TXTs</span>
                        </div>
                        <div class="neon-stat-icon" style="font-size: 1rem;"><i class="fas ${icon}"></i></div>
                    </div>
                </div>
                
                <div class="neon-card" style="padding: 0.8rem;">
                    <div class="neon-stat-card" style="width: 100%; --stat-color: #00e5ff; --stat-color-glow: rgba(0,229,255,0.2);">
                        <div class="neon-stat-info">
                            <span class="neon-stat-label" style="font-size: 0.6rem;">AVANCE GLOBAL</span>
                            <span class="neon-stat-value" style="font-size: 1.1rem; color: #00e5ff;">${avgProg}%</span>
                        </div>
                        <div class="neon-stat-icon" style="font-size: 1rem;"><i class="fas fa-chart-line"></i></div>
                    </div>
                </div>

                <div class="neon-card" style="padding: 0.8rem;">
                    <div style="text-align: center; width: 100%;">
                        <div style="font-size: 0.6rem; color: #9ca3af; margin-bottom: 0.2rem;">META DIARIA</div>
                        <div style="font-size: 1.2rem; font-weight: bold; color: #00ff88;">${Math.round(totalCount / (period === 'week' ? 7 : (period === 'month' ? 30 : 1)))}</div>
                        <div style="font-size: 0.5rem; color: #00ff88;">TXTs / día</div>
                    </div>
                </div>

                <div class="neon-card" style="padding: 0.8rem;">
                    <div style="text-align: center; width: 100%;">
                        <div style="font-size: 0.6rem; color: #9ca3af; margin-bottom: 0.2rem;">RENDIMIENTO</div>
                        <div style="font-size: 1.2rem; font-weight: bold; color: #ff8c00;">${avgProg}%</div>
                        <div style="font-size: 0.5rem; color: #ff8c00;">Efectividad</div>
                    </div>
                </div>
            `;
            
        } catch (e) {
            console.error('Error rendering period summary:', e);
            grid.innerHTML = '<div style="color:#f87171;">Error al cargar datos.</div>';
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
        const distCtx = document.getElementById('dashboardUserDistChart');
        if (!mainCtx || !secCtx || !distCtx) return;

        const series = this.buildSeries(filteredRows, selectedMetrics);
        
        // Optimización: Si los gráficos ya existen, actualizamos sus datos en lugar de destruirlos
        if (this.mainChart && this.mainChart.ctx) {
            this.mainChart.data = series;
            this.mainChart.update('none'); // Update sin animación pesada o 'active' para suave
        } else {
            if (this.mainChart) this.mainChart.destroy();
            this.mainChart = new window.Chart(mainCtx, {
                type: 'line',
                data: series,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { labels: { color: '#e2e8f0', font: { size: 10 } } } },
                    scales: {
                        x: { ticks: { color: '#9ca3af', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
                        y: { ticks: { color: '#9ca3af', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
                    }
                }
            });
        }

        const byUser = new Map();
        filteredRows.forEach(r => {
            byUser.set(r.usuario, (byUser.get(r.usuario) || 0) + Number(r.value || 0));
        });
        
        const barColors = ['#00ff88', '#00e5ff', '#ff8c00', '#7f00ff', '#3b82f6', '#facc15', '#10b981'];
        const userData = {
            labels: [...byUser.keys()],
            datasets: [{
                label: 'Acumulado',
                data: [...byUser.values()],
                backgroundColor: barColors.map(c => c + 'aa'),
                borderColor: barColors,
                borderWidth: 1,
                borderRadius: 4
            }]
        };

        if (this.secondaryChart && this.secondaryChart.ctx) {
            this.secondaryChart.data = userData;
            this.secondaryChart.update();
        } else {
            if (this.secondaryChart) this.secondaryChart.destroy();
            this.secondaryChart = new window.Chart(secCtx, {
                type: 'bar',
                data: userData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { 
                        legend: { display: false },
                        title: { display: true, text: 'Acumulado Usuario', color: '#e2e8f0', font: { size: 10 } }
                    },
                    scales: {
                        x: { ticks: { color: '#9ca3af', font: { size: 8 } }, grid: { display: false } },
                        y: { ticks: { color: '#9ca3af', font: { size: 8 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
                    }
                }
            });
        }

        const distData = {
            labels: [...byUser.keys()],
            datasets: [{
                data: [...byUser.values()],
                backgroundColor: barColors.map(c => c + 'cc'),
                borderColor: '#1e1e2c',
                borderWidth: 2
            }]
        };

        if (this.userDistChart && this.userDistChart.ctx) {
            this.userDistChart.data = distData;
            this.userDistChart.update();
        } else {
            if (this.userDistChart) this.userDistChart.destroy();
            this.userDistChart = new window.Chart(distCtx, {
                type: 'doughnut',
                data: distData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#9ca3af', boxWidth: 8, font: { size: 8 } } },
                        title: { display: true, text: '% Participación', color: '#e2e8f0', font: { size: 10 } }
                    },
                    cutout: '65%'
                }
            });
        }
    }

    async render() {
        this.renderMetricToggles();
        this.attachEvents();
        this.toggleSections();
        await this.ensureChartJs();
        
        try {
            // Obtener datos para comparar
            const assignments = await this.reportEngine.fetchAssignments();
            const period = document.getElementById('summaryPeriodSelect')?.value || 'month';
            
            // Creamos una "firma" de los datos actuales (IDs y Progresos)
            const currentHash = JSON.stringify(assignments.map(a => ({ id: a.id, p: a.progreso }))) + period;
            
            // SI LOS DATOS SON IGUALES AL ÚLTIMO RENDER, NO HACEMOS NADA
            if (this.lastDataHash === currentHash) {
                return; 
            }
            
            this.lastDataHash = currentHash;

            // Solo si hay cambios reales, procedemos a actualizar la interfaz
            await this.renderTxtProgress();
            await this.renderPeriodSummary();
            await this.renderCharts();
        } catch (e) {
            console.error('Error en render inteligente:', e);
        }
    }
}
