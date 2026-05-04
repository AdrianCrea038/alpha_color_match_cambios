/**
 * VISTA: Auditoría de Cíclicos (Comparativa)
 * Misión: Comparar DOS archivos TXT (Maestro vs Nuevo) y encontrar discrepancias.
 * Independencia Total: No comparte lógica con la vista de auditoría directa.
 */
export class CyclicAuditView {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = null;
        this.masterRecords = [];
        this.targetRecords = [];
        this.comparisonResults = [];
        this.activeFilter = null;
        window.cyclicView = this;
    }

    init() {
        this.container = document.getElementById(this.containerId);
        if (!this.container) return;
        this.renderLayout();
        this.setupEvents();
    }

    setFilter(filter) {
        this.activeFilter = filter;
        this.renderResults();
    }

    renderLayout() {
        this.container.innerHTML = `
            <div class="premium-view-container">
                <div class="view-header">
                    <div class="header-main">
                        <h2 class="premium-title"><i class="fas fa-sync-alt"></i> Cíclico 2</h2>
                        <p class="subtitle">Auditoría enfocada: Comparación de integridad entre Maestro y Target</p>
                    </div>
                </div>

                <div class="cyclic-upload-grid">
                    <div class="upload-card-cyclic">
                        <h3>📁 Archivo Maestro (Base)</h3>
                        <input type="file" id="masterFileInput" accept=".txt" hidden>
                        <button class="premium-btn secondary" onclick="document.getElementById('masterFileInput').click()">
                            <i class="fas fa-file-import"></i> CARGAR MAESTRO
                        </button>
                        <div id="masterFileInfo" class="file-info-mini">Esperando archivo...</div>
                    </div>

                    <div class="upload-card-cyclic">
                        <h3>🔄 Archivo Nuevo (Target)</h3>
                        <input type="file" id="targetFileInput" accept=".txt" hidden>
                        <button class="premium-btn secondary" onclick="document.getElementById('targetFileInput').click()">
                            <i class="fas fa-file-upload"></i> CARGAR NUEVO
                        </button>
                        <div id="targetFileInfo" class="file-info-mini">Esperando archivo...</div>
                    </div>
                </div>

                <div id="cyclicResultsPanel" style="display: none; margin-top: 2rem;">
                    <div class="results-toolbar" style="background: rgba(30, 41, 59, 0.5); padding: 1.5rem; border-radius: 15px; border: 1px solid rgba(255,255,255,0.05); flex-direction: column; align-items: stretch; gap: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div id="cyclicStatsBadges" class="stats-badges"></div>
                            <div style="display:flex; gap:10px;">
                                <button id="btnResetCyclic" class="premium-btn secondary" style="background: transparent; border: 1px solid #ef4444; color: #ef4444;">
                                    <i class="fas fa-trash-alt"></i> NUEVA CARGA
                                </button>
                                <button id="btnExportCyclic" class="premium-btn success" disabled>
                                    <i class="fas fa-file-export"></i> EXPORTAR
                                </button>
                            </div>
                        </div>
                        
                        <div class="search-audit-box" style="position: relative;">
                            <i class="fas fa-search" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #64748b;"></i>
                            <input type="text" id="cyclicSearchInput" placeholder="Escriba el nombre del color para auditar solo uno..." 
                                style="width: 100%; padding: 12px 12px 12px 45px; background: #0f172a; border: 2px solid #334155; border-radius: 10px; color: white; font-weight: bold; outline: none; transition: border-color 0.3s;">
                        </div>
                    </div>
                    
                    <div class="premium-table-wrapper" style="margin-top: 1rem;">
                        <table class="premium-data-table">
                            <thead>
                                <tr>
                                    <th>Archivo Maestro (Base)</th>
                                    <th>Archivo Nuevo (Target)</th>
                                    <th>Diferencias Detectadas</th>
                                    <th class="text-center">Estado</th>
                                    <th class="text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="cyclicTableBody"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    setupEvents() {
        this.container.querySelector('#masterFileInput').onchange = (e) => this.handleFileUpload(e, 'master');
        this.container.querySelector('#targetFileInput').onchange = (e) => this.handleFileUpload(e, 'target');
        
        const btnReset = this.container.querySelector('#btnResetCyclic');
        if (btnReset) {
            btnReset.onclick = () => {
                this.masterRecords = [];
                this.targetRecords = [];
                this.comparisonResults = [];
                this.masterFileName = '';
                this.targetFileName = '';
                this.container.querySelector('#masterFileInput').value = '';
                this.container.querySelector('#targetFileInput').value = '';
                this.container.querySelector('#masterFileInfo').innerHTML = 'Esperando archivo...';
                this.container.querySelector('#targetFileInfo').innerHTML = 'Esperando archivo...';
                this.container.querySelector('#cyclicResultsPanel').style.display = 'none';
            };
        }
        
        const searchInput = this.container.querySelector('#cyclicSearchInput');
        if (searchInput) {
            searchInput.oninput = () => {
                this.searchTerm = searchInput.value.trim().toUpperCase();
                this.renderResults();
            };
        }

        const exportBtn = this.container.querySelector('#btnExportCyclic');
        if (exportBtn) {
            exportBtn.onclick = () => this.exportCyclicTarget();
        }
    }

    async handleFileUpload(e, type) {
        const file = e.target.files[0];
        if (!file) return;

        const content = await file.text();
        const rawLines = content.split(/\r?\n/);
        const records = window.FileLoader.parseTxt(content);
        
        records.forEach(r => {
            const lineIdx = rawLines.findIndex(l => l.includes(r.name) && l.includes(r.nk));
            r.lineNumber = lineIdx !== -1 ? lineIdx + 1 : '?';
            r.sourceFile = file.name;
        });

        if (type === 'master') {
            this.masterFileName = file.name;
            this.masterRecords = records;
            this.container.querySelector('#masterFileInfo').innerHTML = `✅ ${file.name} <br><small>${records.length} colores</small>`;
        } else {
            this.targetFileName = file.name;
            this.targetRecords = records;
            this.container.querySelector('#targetFileInfo').innerHTML = `✅ ${file.name} <br><small>${records.length} colores</small>`;
        }

        if (this.masterRecords.length && this.targetRecords.length) {
            if (window.app && typeof window.app.loadMasterData === 'function') {
                const { ensureValidColorCatalogLoaded } = await import('../modules/nameValidator.js');
                await ensureValidColorCatalogLoaded(true);
            }
            this.performComparison();
        }
    }

    performComparison() {
        this.comparisonResults = [];
        const masterMap = new Map(this.masterRecords.map(r => [r.name.toUpperCase(), r]));
        const targetMap = new Map(this.targetRecords.map(r => [r.name.toUpperCase(), r]));
        const allNames = new Set([...masterMap.keys(), ...targetMap.keys()]);

        allNames.forEach(name => {
            const master = masterMap.get(name);
            const target = targetMap.get(name);
            let type = 'match';
            let diffCmyk = false;
            let isCorrupted = false;

            if (target && target.cmyk) {
                isCorrupted = target.cmyk.some(v => v > 100.000001 || v < -0.000001 || isNaN(v));
            }
            if (!isCorrupted && master && master.cmyk) {
                isCorrupted = master.cmyk.some(v => v > 100.000001 || v < -0.000001 || isNaN(v));
            }

            if (!master) type = 'new';
            else if (!target) type = 'missing';
            else {
                diffCmyk = master.cmyk.some((v, i) => Number(v).toFixed(6) !== Number(target.cmyk[i]).toFixed(6));
            }

            this.comparisonResults.push({
                nk: (master || target).nk, 
                name, master, target, type, diffCmyk, isCorrupted,
                isComparison: true,
                _uid: Math.random().toString(36).substr(2, 9)
            });
        });
        this.renderResults();
    }

    renderResults() {
        const body = this.container.querySelector('#cyclicTableBody');
        const badges = this.container.querySelector('#cyclicStatsBadges');
        const exportBtn = this.container.querySelector('#btnExportCyclic');
        
        this.container.querySelector('#cyclicResultsPanel').style.display = 'block';
        body.innerHTML = '';

        let displayResults = this.comparisonResults;
        if (this.searchTerm) {
            displayResults = displayResults.filter(res => {
                const nameM = (res.master?.name || '').toUpperCase();
                const nameT = (res.target?.name || '').toUpperCase();
                const nk = (res.nk || '').toUpperCase();
                return nameM.includes(this.searchTerm) || nameT.includes(this.searchTerm) || nk.includes(this.searchTerm);
            });
        }

        if (this.activeFilter) {
            displayResults = displayResults.filter(res => {
                if (this.activeFilter === 'diff') return res.diffCmyk;
                if (this.activeFilter === 'missing') return res.type === 'missing';
                if (this.activeFilter === 'new') return res.type === 'new';
                if (this.activeFilter === 'corrupted') return res.isCorrupted;
                return true;
            });
        }

        const counts = {
            total: this.comparisonResults.length,
            diff: this.comparisonResults.filter(r => r.diffCmyk).length,
            missing: this.comparisonResults.filter(r => r.type === 'missing').length,
            new: this.comparisonResults.filter(r => r.type === 'new').length,
            corrupted: this.comparisonResults.filter(r => r.isCorrupted).length
        };

        badges.innerHTML = `
            <div class="stat-badge-mini ${!this.activeFilter ? 'active' : ''}" data-filter=""><i class="fas fa-eye"></i> Todos (${counts.total})</div>
            ${counts.diff > 0 ? `<div class="stat-badge-mini orange has-count ${this.activeFilter === 'diff' ? 'active' : ''}" onclick="window.cyclicView.setFilter('diff')"><i class="fas fa-exclamation-triangle"></i> Diferentes (${counts.diff})</div>` : ''}
            ${counts.corrupted > 0 ? `<div class="stat-badge-mini red has-count ${this.activeFilter === 'corrupted' ? 'active' : ''}" onclick="window.cyclicView.setFilter('corrupted')"><i class="fas fa-flask"></i> CMYK > 100 (${counts.corrupted})</div>` : ''}
            ${counts.missing > 0 ? `<div class="stat-badge-mini red has-count ${this.activeFilter === 'missing' ? 'active' : ''}" onclick="window.cyclicView.setFilter('missing')"><i class="fas fa-minus-circle"></i> Faltantes (${counts.missing})</div>` : ''}
            ${counts.new > 0 ? `<div class="stat-badge-mini blue has-count ${this.activeFilter === 'new' ? 'active' : ''}" onclick="window.cyclicView.setFilter('new')"><i class="fas fa-plus-circle"></i> Nuevos (${counts.new})</div>` : ''}
        `;
        badges.querySelectorAll('.badge').forEach(b => b.onclick = () => this.setFilter(b.getAttribute('data-filter') || null));

        if (exportBtn) {
            const hasErrors = counts.diff > 0 || counts.missing > 0 || counts.corrupted > 0;
            exportBtn.disabled = hasErrors;
            exportBtn.innerHTML = hasErrors ? `<i class="fas fa-lock"></i> BLOQUEADO` : `<i class="fas fa-file-export"></i> EXPORTAR VALIDADO`;
        }

        displayResults.forEach(res => {
            const tr = document.createElement('tr');
            const diffs = [];
            if (res.diffCmyk) diffs.push('<span class="diff-tag cmyk">CMYK</span>');
            if (res.isCorrupted) diffs.push('<span class="diff-tag corrupted" style="background:#ef4444;">CORRUPTO</span>');

            let statusHtml = '<div class="status-badge valid">Iguales</div>';
            let rowClass = 'row-success';
            if (res.isCorrupted) { statusHtml = '<div class="status-badge red">CMYK > 100</div>'; rowClass = 'row-error-red'; }
            else if (res.type === 'missing') { statusHtml = '<div class="status-badge red">Falta en Target</div>'; rowClass = 'row-error-red'; }
            else if (res.type === 'new') { statusHtml = '<div class="status-badge blue">Solo en Target</div>'; rowClass = 'row-error-blue'; }
            else if (res.diffCmyk) { statusHtml = '<div class="status-badge orange">CMYK Dif.</div>'; rowClass = 'row-error-orange'; }

            const formatRecord = (r) => {
                if (!r) return '<div class="empty-cell">---</div>';
                const cmykHtml = (r.cmyk || []).map(v => {
                    const val = Number(v);
                    const isBad = val > 100.000001 || val < -0.000001;
                    return isBad ? `<span style="color:#ff4444; font-weight:900; background:rgba(255,68,68,0.1); padding:0 4px; border-radius:2px; border:1px solid #ff4444;">${val.toFixed(6)}</span>` : val.toFixed(6);
                }).join(' / ');
                return `<div class="comp-cell">
                    <div class="line-marker" style="font-size:0.65rem; color:#64748b; margin-bottom:2px;">Línea: ${r.lineNumber}</div>
                    <div class="name" style="font-weight:700;">${r.name}</div>
                    <div class="cmyk" style="font-family:monospace; font-size:0.75rem; color:#94a3b8;">${cmykHtml}</div>
                </div>`;
            };

            tr.className = rowClass;
            tr.innerHTML = `
                <td>${formatRecord(res.master)}</td>
                <td>${formatRecord(res.target)}</td>
                <td>${diffs.join(' ')}</td>
                <td class="text-center">${statusHtml}</td>
                <td class="text-center" style="white-space:nowrap;">
                    <button class="btn-icon-action edit" data-action="edit" data-uid="${res._uid}" title="Editar"><i class="fas fa-pencil-alt"></i></button>
                    ${res.type === 'missing' ? `<button class="btn-icon-action add" data-action="sync-target" data-uid="${res._uid}" title="Agregar a Target" style="color:#10b981;"><i class="fas fa-plus-circle"></i></button>` : ''}
                    ${res.type === 'new' ? `<button class="btn-icon-action add" data-action="sync-master" data-uid="${res._uid}" title="Agregar a Master" style="color:#3b82f6;"><i class="fas fa-plus-circle"></i></button>` : ''}
                    <button class="btn-icon-action delete" data-action="delete" data-uid="${res._uid}" title="Eliminar" style="color:#ef4444;"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
            body.appendChild(tr);
        });

        body.onclick = (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            const uid = btn.getAttribute('data-uid');
            if (action === 'edit') this.editRecord(uid);
            else if (action === 'delete') this.deleteRecord(uid);
            else if (action === 'sync-target') this.syncRecord(uid, 'to_target');
            else if (action === 'sync-master') this.syncRecord(uid, 'to_master');
        };
    }

    editRecord(uid) {
        const res = this.comparisonResults.find(r => r._uid === uid);
        if (!res) return;
        const m = res.master; const t = res.target;
        const isBad = (val) => val > 100.000001 || val < -0.000001;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.zIndex = '9999';

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 950px; background: #0f172a; border: 2px solid #3b82f6; border-radius:12px;">
                <div class="modal-header" style="border-bottom: 1px solid #334155; padding: 1.2rem; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="color: white; margin: 0;"><i class="fas fa-edit" style="color: #3b82f6;"></i> Corregir: ${res.name}</h3>
                    <button class="premium-btn primary small" id="btnSyncAll"><i class="fas fa-sync"></i> IGUALAR TARGET A MAESTRO</button>
                </div>
                <div class="modal-body" style="padding: 1.5rem; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <!-- MAESTRO -->
                    <div style="padding: 15px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px solid #334155;">
                        <h4 style="color:#60a5fa; margin-top:0;">ARCHIVO MAESTRO</h4>
                        ${!m ? '<p style="color:#ef4444;">No existe en Maestro</p>' : `
                            <label style="color:#94a3b8; font-size:0.75rem;">Nombre</label>
                            <input type="text" id="editNameM" list="colorNames" value="${m.name.replace(/\s*(NK\d+|T\d+)$/i, '').trim()}" style="width:100%; padding:8px; background:#1e293b; color:white; border:1px solid #475569; border-radius:6px; margin-bottom:10px;">
                            <label style="color:#94a3b8; font-size:0.75rem;">NK</label>
                            <input type="text" id="editNKM" value="${m.nk || ''}" style="width:100%; padding:8px; background:#1e293b; color:white; border:1px solid #475569; border-radius:6px; margin-bottom:10px;">
                            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px;">
                                <input type="number" id="editMC" step="0.000001" value="${m.cmyk[0]}" style="width:100%; padding:8px; background:#1e293b; color:white; border:1px solid ${isBad(m.cmyk[0])?'#ef4444':'#475569'}; border-radius:6px;">
                                <input type="number" id="editMM" step="0.000001" value="${m.cmyk[1]}" style="width:100%; padding:8px; background:#1e293b; color:white; border:1px solid ${isBad(m.cmyk[1])?'#ef4444':'#475569'}; border-radius:6px;">
                                <input type="number" id="editMY" step="0.000001" value="${m.cmyk[2]}" style="width:100%; padding:8px; background:#1e293b; color:white; border:1px solid ${isBad(m.cmyk[2])?'#ef4444':'#475569'}; border-radius:6px;">
                                <input type="number" id="editMK" step="0.000001" value="${m.cmyk[3]}" style="width:100%; padding:8px; background:#1e293b; color:white; border:1px solid ${isBad(m.cmyk[3])?'#ef4444':'#475569'}; border-radius:6px;">
                            </div>
                        `}
                    </div>
                    <!-- TARGET -->
                    <div style="padding: 15px; background: rgba(59, 130, 246, 0.05); border-radius: 8px; border: 1px solid #3b82f6;">
                        <h4 style="color:#3b82f6; margin-top:0;">ARCHIVO NUEVO (TARGET)</h4>
                        ${!t ? '<p style="color:#ef4444;">No existe en Target</p>' : `
                            <label style="color:#94a3b8; font-size:0.75rem;">Nombre</label>
                            <input type="text" id="editNameT" list="colorNames" value="${t.name.replace(/\s*(NK\d+|T\d+)$/i, '').trim()}" style="width:100%; padding:8px; background:#1e293b; color:white; border:1px solid #475569; border-radius:6px; margin-bottom:10px;">
                            <label style="color:#94a3b8; font-size:0.75rem;">NK</label>
                            <input type="text" id="editNKT" value="${t.nk || ''}" style="width:100%; padding:8px; background:#1e293b; color:white; border:1px solid #475569; border-radius:6px; margin-bottom:10px;">
                            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px;">
                                <input type="number" id="editTC" step="0.000001" value="${t.cmyk[0]}" style="width:100%; padding:8px; background:#1e293b; color:white; border:1px solid ${isBad(t.cmyk[0])?'#ef4444':'#475569'}; border-radius:6px;">
                                <input type="number" id="editTM" step="0.000001" value="${t.cmyk[1]}" style="width:100%; padding:8px; background:#1e293b; color:white; border:1px solid ${isBad(t.cmyk[1])?'#ef4444':'#475569'}; border-radius:6px;">
                                <input type="number" id="editTY" step="0.000001" value="${t.cmyk[2]}" style="width:100%; padding:8px; background:#1e293b; color:white; border:1px solid ${isBad(t.cmyk[2])?'#ef4444':'#475569'}; border-radius:6px;">
                                <input type="number" id="editTK" step="0.000001" value="${t.cmyk[3]}" style="width:100%; padding:8px; background:#1e293b; color:white; border:1px solid ${isBad(t.cmyk[3])?'#ef4444':'#475569'}; border-radius:6px;">
                            </div>
                        `}
                    </div>
                    <datalist id="colorNames">${(window.ALL_VALID_COLOR_NAMES || []).map(n => `<option value="${n}">`).join('')}</datalist>
                    <div id="familySuggestions" style="grid-column: span 2;"></div>
                </div>
                <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:10px; padding:1.2rem; border-top:1px solid #334155;">
                    <button class="premium-btn secondary" onclick="this.closest('.modal-overlay').remove()">CANCELAR</button>
                    <button class="premium-btn primary" id="btnSaveEdit">GUARDAR CAMBIOS</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const syncBtn = modal.querySelector('#btnSyncAll');
        if (syncBtn && m && t) {
            syncBtn.onclick = () => {
                modal.querySelector('#editNameT').value = modal.querySelector('#editNameM').value;
                modal.querySelector('#editNKT').value = modal.querySelector('#editNKM').value;
                modal.querySelector('#editTC').value = modal.querySelector('#editMC').value;
                modal.querySelector('#editTM').value = modal.querySelector('#editMM').value;
                modal.querySelector('#editTY').value = modal.querySelector('#editMY').value;
                modal.querySelector('#editTK').value = modal.querySelector('#editMK').value;
                updateFamily();
            };
        }

        const updateFamily = () => {
            const name = modal.querySelector('#editNameT')?.value || modal.querySelector('#editNameM')?.value || '';
            const key = name.trim().toUpperCase().replace(/[^A-Z0-9]/gi, '');
            const family = window.EQUIVALENCE_MAP?.get(key);
            const container = modal.querySelector('#familySuggestions');
            if (family && family.names.length > 1) {
                const others = family.names.filter(n => n.toUpperCase().replace(/[^A-Z0-9]/gi, '') !== key);
                container.innerHTML = `
                    <div style="margin-top:10px; padding:10px; background:rgba(59,130,246,0.1); border-radius:8px; border-left:4px solid #3b82f6;">
                        <small style="color:#60a5fa; font-weight:bold; display:block; margin-bottom:5px;">EQUIVALENTES EN MASTER:</small>
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            ${others.map(o => {
                                const ref = this.masterRecords.find(r => r.name.toUpperCase().replace(/[^A-Z0-9]/gi, '') === o.toUpperCase().replace(/[^A-Z0-9]/gi, ''));
                                const cmyk = ref ? `(C:${ref.cmyk[0].toFixed(2)} M:${ref.cmyk[1].toFixed(2)} Y:${ref.cmyk[2].toFixed(2)} K:${ref.cmyk[3].toFixed(2)})` : '';
                                return `<div style="font-size:0.75rem; color:#cbd5e1;"><b>${o}</b> <span style="color:#fbbf24; font-family:monospace;">${cmyk}</span></div>`;
                            }).join('')}
                        </div>
                    </div>`;
            } else { container.innerHTML = ''; }
        };

        modal.querySelector('#editNameT')?.addEventListener('input', updateFamily);
        modal.querySelector('#editNameM')?.addEventListener('input', updateFamily);
        updateFamily();

        modal.querySelector('#btnSaveEdit').onclick = () => {
            if (m) {
                m.name = (modal.querySelector('#editNameM').value.trim() + ' ' + modal.querySelector('#editNKM').value.trim()).trim();
                m.nk = modal.querySelector('#editNKM').value.trim();
                m.cmyk = [parseFloat(modal.querySelector('#editMC').value), parseFloat(modal.querySelector('#editMM').value), parseFloat(modal.querySelector('#editMY').value), parseFloat(modal.querySelector('#editMK').value)];
            }
            if (t) {
                t.name = (modal.querySelector('#editNameT').value.trim() + ' ' + modal.querySelector('#editNKT').value.trim()).trim();
                t.nk = modal.querySelector('#editNKT').value.trim();
                t.cmyk = [parseFloat(modal.querySelector('#editTC').value), parseFloat(modal.querySelector('#editTM').value), parseFloat(modal.querySelector('#editTY').value), parseFloat(modal.querySelector('#editTK').value)];
            } else if (res.type === 'missing') {
                // Si faltaba en target, al guardar lo creamos
                const newRec = { 
                    name: (modal.querySelector('#editNameT').value.trim() + ' ' + modal.querySelector('#editNKT').value.trim()).trim(),
                    nk: modal.querySelector('#editNKT').value.trim(),
                    cmyk: [parseFloat(modal.querySelector('#editTC').value), parseFloat(modal.querySelector('#editTM').value), parseFloat(modal.querySelector('#editTY').value), parseFloat(modal.querySelector('#editTK').value)],
                    lineNumber: 'Edit'
                };
                res.target = newRec;
                this.targetRecords.push(newRec);
            }
            modal.remove(); this.performComparison();
        };
    }

    deleteRecord(uid) {
        if (confirm('¿Eliminar registro?')) { this.comparisonResults = this.comparisonResults.filter(r => r._uid !== uid); this.renderResults(); }
    }

    syncRecord(uid, direction) {
        const res = this.comparisonResults.find(r => r._uid === uid);
        if (!res) return;

        if (direction === 'to_target') {
            const newRecord = JSON.parse(JSON.stringify(res.master));
            res.target = newRecord;
            // IMPORTANTE: Agregar a la lista física de registros del Target
            if (!this.targetRecords.some(r => r.name === newRecord.name)) {
                this.targetRecords.push(newRecord);
            }
        } else {
            const newRecord = JSON.parse(JSON.stringify(res.target));
            res.master = newRecord;
            // IMPORTANTE: Agregar a la lista física de registros del Master
            if (!this.masterRecords.some(r => r.name === newRecord.name)) {
                this.masterRecords.push(newRecord);
            }
        }

        this.performComparison();
        window.showNotification?.('Sincronizado', 'Registro copiado al archivo.', 'success');
    }

    exportCyclicTarget() {
        const records = this.comparisonResults.filter(r => r.target).map(r => r.target);
        if (!records.length) return alert('No hay registros.');
        let content = 'CGATS.17\nORIGINATOR\t"ALPHA"\nNUMBER_OF_FIELDS\t9\nBEGIN_DATA_FORMAT\nSAMPLE_ID SAMPLE_NAME CMYK_C CMYK_M CMYK_Y CMYK_K LAB_L LAB_A LAB_B\nEND_DATA_FORMAT\nNUMBER_OF_SETS\t' + records.length + '\nBEGIN_DATA\n';
        records.forEach((r, i) => { content += `${i+1} "${r.name}" ${r.cmyk[0].toFixed(6)} ${r.cmyk[1].toFixed(6)} ${r.cmyk[2].toFixed(6)} ${r.cmyk[3].toFixed(6)} 0 0 0\n`; });
        content += 'END_DATA\n';
        const blob = new Blob([content], { type: 'text/plain' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Target_Auditado.txt'; a.click();
    }
}
