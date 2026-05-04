// js/views/linearizationValidatorView.js
import { escapeHtml, showNotification, extractBaseName, extractNK } from '../core/utils.js';
import { loadFile, parseTxtContent } from '../modules/fileLoader.js';
import { validateAndCorrectRecords, isValidColorName } from '../modules/nameValidator.js';

export class LinearizationValidatorView {
    constructor(app) {
        this.app = app;
        this.records = [];
        this.masterRecords = [];
        this.comparisonResults = [];
        this.conflictGroups = [];
        this.container = null;
        this.fileName = '';
        this.activeFilter = null; // Filtro de error activo
        
        this.init();
        window.linValidatorView = this;
    }

    saveToCache() {
        try {
            const data = {
                records: this.records,
                masterRecords: this.masterRecords,
                comparisonResults: this.comparisonResults,
                fileName: this.fileName,
                activeFilter: this.activeFilter,
                mode: this.mode || 'direct'
            };
            const serialized = JSON.stringify(data);
            localStorage.setItem('lin_auditor_cache', serialized);
            console.log(`💾 Auditoría guardada (${(serialized.length / 1024).toFixed(1)} KB) - Modo: ${data.mode}`);
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                window.showNotification('Memoria llena', 'El archivo es demasiado grande para guardarse en caché.', 'warning');
            }
            console.error('Error al guardar en cache:', e);
        }
    }

    loadFromCache() {
        const cached = localStorage.getItem('lin_auditor_cache');
        if (!cached) return;

        try {
            const data = JSON.parse(cached);
            this.records = data.records || [];
            this.masterRecords = data.masterRecords || [];
            this.comparisonResults = data.comparisonResults || [];
            this.fileName = data.fileName || '';
            this.activeFilter = data.activeFilter || null;
            this.mode = data.mode || 'direct';

            if (this.records.length > 0 || this.comparisonResults.length > 0) {
                // Esperar a que el DOM esté listo
                const checkInterval = setInterval(() => {
                    const tableBody = this.container?.querySelector('#linResultsTableBody');
                    if (tableBody) {
                        clearInterval(checkInterval);
                        if (this.comparisonResults.length > 0) {
                            this.renderComparisonResults();
                        } else {
                            this.renderResults();
                        }
                        if (this.fileName) {
                            const badge = this.container.querySelector('#linFileName1');
                            if (badge) badge.innerHTML = `<i class="fas fa-file-alt"></i> ${this.fileName} <span style="font-size: 0.6rem; opacity: 0.7;">(Recuperado)</span>`;
                        }
                    }
                }, 50);
                // Limpiar después de 2 segundos si algo falla
                setTimeout(() => clearInterval(checkInterval), 2000);
            }
        } catch (e) {
            console.error('Error cargando cache de auditoría:', e);
        }
    }

    init() {
        this.container = document.getElementById('linearizationValidatorView');
        if (!this.container) return;
        this.render();
        this.loadFromCache();
    }

    render() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <style>
                /* Estilos mínimos necesarios que no están en el CSS global */
                .mismatch-val {
                    color: #f43f5e;
                    font-weight: 900;
                    text-decoration: underline;
                    text-shadow: 0 0 5px rgba(244, 63, 94, 0.5);
                    background: rgba(244, 63, 94, 0.1);
                    padding: 0 2px;
                    border-radius: 2px;
                }
            </style>
            <!-- SECCIÓN 1: AUDITORÍA CÍCLICA (COMPARACIÓN) -->
            <div id="cyclicalAuditSection" class="lin-card audit-card" style="border: 1px solid rgba(59, 130, 246, 0.2); background: rgba(15, 23, 42, 0.3);">
                <div class="lin-card-header" style="border-bottom: 1px solid rgba(59, 130, 246, 0.1); padding: 1rem;">
                    <div class="header-icon" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6;"><i class="fas fa-sync-alt"></i></div>
                    <div class="header-text">
                        <h3 style="margin:0; font-size: 1rem; color: #f1f5f9;">Auditoría de Cíclicos</h3>
                        <p style="margin:0; font-size: 0.75rem; color: #9ca3af;">Compara dos archivos buscando discrepancias mínimas</p>
                    </div>
                </div>
                <div class="lin-card-body" style="padding: 1.2rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <!-- Master File -->
                    <div class="mini-upload-zone" id="masterZone" style="border: 1px dashed rgba(59, 130, 246, 0.3); padding: 1rem; border-radius: 8px; text-align: center;">
                        <input type="file" id="linMasterInput" accept=".txt" style="display: none;">
                        <label for="linMasterInput" style="cursor: pointer;">
                            <i class="fas fa-file-import" style="color: #3b82f6; font-size: 1.2rem;"></i>
                            <div id="linMasterFileName" style="font-size: 0.75rem; margin-top: 5px; color: #94a3b8;">Cargar Maestro (Base)</div>
                        </label>
                    </div>
                    <!-- Secondary File -->
                    <div class="mini-upload-zone" id="secondaryZone" style="border: 1px dashed rgba(139, 92, 246, 0.3); padding: 1rem; border-radius: 8px; text-align: center;">
                        <input type="file" id="linSecondaryInput" accept=".txt" style="display: none;">
                        <label for="linSecondaryInput" style="cursor: pointer;">
                            <i class="fas fa-file-upload" style="color: #8b5cf6; font-size: 1.2rem;"></i>
                            <div id="linSecondaryFileName" style="font-size: 0.75rem; margin-top: 5px; color: #94a3b8;">Cargar Secundario (Cambios)</div>
                        </label>
                    </div>
                </div>
                <div class="lin-card-footer" style="padding: 0.8rem; background: rgba(0,0,0,0.1); display: flex; justify-content: center;">
                    <button id="btnRunCyclic" class="btn-premium" style="padding: 8px 25px; font-size: 0.8rem; background: linear-gradient(135deg, #3b82f6, #8b5cf6);"><i class="fas fa-bolt"></i> COMPARAR ARCHIVOS</button>
                </div>
            </div>

            <!-- SECCIÓN 2: VALIDADOR RÁPIDO -->
            <div id="singleAuditSection" class="lin-card audit-card" style="margin-top: 1.5rem; border: 1px solid rgba(255,255,255,0.05); background: rgba(30, 41, 59, 0.5);">
                <div class="lin-card-header" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding: 1rem;">
                    <div class="header-icon" style="background: rgba(16, 185, 129, 0.1); color: #10b981;"><i class="fas fa-file-shield"></i></div>
                    <div class="header-text">
                        <h3 style="margin:0; font-size: 1rem; color: #f1f5f9;">Auditoría Directa de Archivo Único</h3>
                        <p style="margin:0; font-size: 0.75rem; color: #9ca3af;">Revisión de NKs y corrección de nombres sin comparar</p>
                    </div>
                    <div class="header-actions" style="margin-left: auto; display: flex; gap: 10px;">
                         <button id="linResetBtn" class="small-btn" style="background: transparent; border: 1px solid #4b5563; color: #9ca3af;"><i class="fas fa-undo"></i></button>
                         <button id="btnExportLin" class="small-btn btn-success" disabled><i class="fas fa-file-export"></i></button>
                    </div>
                </div>
                <div class="lin-card-body" style="padding: 1.5rem;">
                    <div class="premium-upload-zone" id="linUploadZone" style="padding: 1.5rem; border: 2px dashed rgba(16, 185, 129, 0.2);">
                        <input type="file" id="linValidatorFileInput" accept=".txt" class="hidden-input">
                        <label for="linValidatorFileInput" class="upload-label" style="cursor: pointer;">
                            <div class="upload-icon-wrapper" style="width: 40px; height: 40px; font-size: 1.2rem;">
                                <i class="fas fa-cloud-upload-alt"></i>
                            </div>
                            <div class="upload-text">
                                <span class="main-text" style="font-size: 0.9rem;">Cargar TXT para Auditar</span>
                                <span class="sub-text" style="font-size: 0.7rem;">Validación automática de nombres y NKs</span>
                            </div>
                        </label>
                    </div>
                    <div id="linFileName1" class="file-status-badge" style="margin-top: 1rem; background: rgba(15, 23, 42, 0.5);">
                        <i class="fas fa-info-circle"></i> Ningún archivo seleccionado
                    </div>
                </div>
            </div>

            <!-- RESULTADOS -->
            <div id="linResultsPanel" class="results-fade-panel" style="display: none;">
                <div class="results-header-bar">
                    <div class="results-title">
                        <i class="fas fa-list-check"></i> Hallazgos de la Auditoría
                    </div>
                    <div id="linStatsBadges" class="stats-badges"></div>
                </div>
                <div class="premium-table-wrapper">
                    <table class="premium-data-table">
                        <thead>
                            <tr>
                                <th>Archivo Base</th>
                                <th>Archivo Nuevo</th>
                                <th>Análisis de Diferencias</th>
                                <th class="text-center">Estado</th>
                                <th class="text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="linResultsTableBody"></tbody>
                    </table>
                </div>
            </div>

            <div id="linEmptyState" class="lin-empty-state">
                <div class="empty-animation">
                    <i class="fas fa-clipboard-check"></i>
                </div>
                <h3>Listo para Auditar</h3>
                <p>Carga los archivos necesarios para iniciar el proceso de validación cíclica o individual.</p>
            </div>
        `;
        
        this.bindEvents();

        // RE-RENDERIZAR SI HAY DATOS EN CACHÉ
        if (this.records.length > 0 || this.comparisonResults.length > 0) {
            setTimeout(() => {
                if (this.comparisonResults.length > 0) {
                    this.renderComparisonResults();
                    // Restaurar nombres en modo cíclico
                    const mName = this.container.querySelector('#linMasterFileName');
                    const sName = this.container.querySelector('#linSecondaryFileName');
                    if (mName && this.masterRecords.length > 0) mName.textContent = "Cargado (Caché)";
                    if (sName && this.records.length > 0) sName.textContent = "Cargado (Caché)";
                } else {
                    this.renderResults();
                }
                if (this.fileName) {
                    const badge = this.container.querySelector('#linFileName1');
                    if (badge) badge.innerHTML = `<i class="fas fa-file-alt"></i> ${this.fileName} <span style="font-size: 0.6rem; opacity: 0.7;">(Recuperado)</span>`;
                }
            }, 50);
        }
    }

    bindEvents() {
        // CARGA CÍCLICA
        const masterInput = this.container.querySelector('#linMasterInput');
        if (masterInput) {
            masterInput.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const res = await loadFile(file, true);
                    this.masterRecords = res.records.map((r, i) => ({ 
                        ...r, 
                        _uid: r._uid || `lin_master_${Date.now()}_${i}` 
                    }));
                    this.mode = 'cyclic';
                    this.comparisonResults = []; // Nueva carga, reset comparador
                    this.container.querySelector('#linMasterFileName').textContent = file.name;
                    this.container.querySelector('#linMasterFileName').style.color = '#3b82f6';
                    await this.performValidation();
                }
            };
        }

        const secondaryInput = this.container.querySelector('#linSecondaryInput');
        if (secondaryInput) {
            secondaryInput.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const res = await loadFile(file, true);
                    this.records = res.records.map((r, i) => ({ 
                        ...r, 
                        _uid: r._uid || `lin_secundario_${Date.now()}_${i}` 
                    }));
                    this.mode = 'cyclic';
                    this.comparisonResults = []; // Nueva carga, reset comparador
                    this.container.querySelector('#linSecondaryFileName').textContent = file.name;
                    this.container.querySelector('#linSecondaryFileName').style.color = '#8b5cf6';
                    await this.performValidation();
                }
            };
        }

        const runBtn = this.container.querySelector('#btnRunCyclic');
        if (runBtn) {
            runBtn.onclick = () => this.runStrictComparison();
        }

        // CARGA INDIVIDUAL
        const fileInput = this.container.querySelector('#linValidatorFileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileLoad(e));
        }

        const resetBtn = this.container.querySelector('#linResetBtn');
        if (resetBtn) {
            resetBtn.onclick = () => this.reset();
        }

        const exportBtn = this.container.querySelector('#btnExportLin');
        if (exportBtn) {
            exportBtn.onclick = () => this.exportCorrectedFile();
        }
    }

    async runStrictComparison() {
        if (!this.records.length || !this.masterRecords.length) {
            window.showNotification('Faltan archivos', 'Debe cargar ambos archivos para comparar.', 'warning');
            return;
        }

        // Asegurar que todos tengan UIDs permanentes antes de comparar
        this.masterRecords = this.masterRecords.map((r, i) => {
            if (!r._uid) r._uid = `master_${Date.now()}_${i}`;
            return r;
        });
        this.records = this.records.map((r, i) => {
            if (!r._uid) r._uid = `secondary_${Date.now()}_${i}`;
            return r;
        });
        
        // 🛡️ VALIDACIÓN OBLIGATORIA CONTRA EL CATÁLOGO/EQUIVALENCIAS
        const { validateAndCorrectRecords } = await import('../modules/nameValidator.js');
        const validation = await validateAndCorrectRecords(this.records, 'ciclico');
        
        if (validation.cancelled) {
            window.showNotification('Cancelado', 'La comparación requiere que los nombres sean válidos.', 'info');
            return;
        }
        
        this.records = validation.records; // Usar los registros ya corregidos según el catálogo

        const { compareFiles } = await import('../modules/comparator.js');
        this.comparisonResults = compareFiles(this.masterRecords, this.records, 'ciclico');
        this.renderComparisonResults();
        this.saveToCache();
    }

    renderComparisonResults() {
        const resultsPanel = this.container.querySelector('#linResultsPanel');
        const tableBody = this.container.querySelector('#linResultsTableBody');
        const statsBadges = this.container.querySelector('#linStatsBadges');

        if (this.container.querySelector('#linEmptyState')) {
            this.container.querySelector('#linEmptyState').style.display = 'none';
        }
        resultsPanel.style.display = 'block';

        // Ordenar resultados por NK para agrupar errores del mismo NK
        this.comparisonResults.sort((a, b) => {
            const nkA = (a.primaryData?.nk || a.secondaryData?.nk || '').toUpperCase();
            const nkB = (b.primaryData?.nk || b.secondaryData?.nk || '').toUpperCase();
            if (nkA !== nkB) return nkA.localeCompare(nkB);
            return (a.matchType === 'exact' ? 1 : -1) - (b.matchType === 'exact' ? 1 : -1);
        });

        const discrepancies = this.comparisonResults.filter(r => r.matchType !== 'exact');
        
        statsBadges.innerHTML = `
            <div style="display: flex; gap: 10px; align-items: center;">
                <div class="stat-badge danger" style="background: rgba(244, 63, 94, 0.1); color: #f43f5e; border: 1px solid #f43f5e; padding: 5px 15px; border-radius: 20px; font-size: 0.8rem; font-weight: bold;">
                    <i class="fas fa-exclamation-triangle"></i> ${discrepancies.length} Diferencias encontradas
                </div>
                <button id="btnExportCyclic" class="btn-premium" style="padding: 5px 20px; font-size: 0.75rem; background: #10b981; border: none;">
                    <i class="fas fa-file-export"></i> EXPORTAR ARCHIVO AUDITADO
                </button>
            </div>
        `;

        const exportCyclicBtn = statsBadges.querySelector('#btnExportCyclic');
        if (exportCyclicBtn) {
            exportCyclicBtn.onclick = () => this.exportCorrectedFile();
        }

        tableBody.innerHTML = '';
        this.comparisonResults.forEach(res => {
            const tr = document.createElement('tr');
            const type = res.matchType;
            
            // SOLO MARCAR ROJO SI HAY DIFERENCIA REAL ENTRE ARCHIVOS
            let rowClass = 'row-success';
            if (type !== 'exact') {
                rowClass = 'row-error-red';
            }
            
            tr.className = rowClass;
            
            const p = res.primaryData;
            const s = res.secondaryData;
            
            const formatCmykWithDiff = (pData, sData, isPrimary) => {
                if (!pData || !sData) {
                    const data = pData || sData;
                    return (data.cmyk || []).map(v => Number(v).toFixed(6)).join(' / ');
                }
                
                return pData.cmyk.map((v, i) => {
                    const diff = Math.abs(v - sData.cmyk[i]) > 0.000001;
                    const val = Number(isPrimary ? pData.cmyk[i] : sData.cmyk[i]).toFixed(6);
                    return diff ? `<span style="color: #f43f5e; font-weight: 900; background: rgba(244,63,94,0.1); padding: 0 2px; border-radius: 2px;">${val}</span>` : val;
                }).join(' / ');
            };

            const formatInfo = (data, otherData, isPrimary) => {
                if (!data) return '<div class="empty-data" style="opacity: 0.3; font-style: italic;">--- Vacío ---</div>';
                const nk = data.nk || '---';
                const cmykHtml = formatCmykWithDiff(isPrimary ? data : otherData, isPrimary ? otherData : data, isPrimary);
                
                // Resaltar nombre si es diferente al otro archivo
                const isNameDiff = otherData && data.name.trim().toUpperCase() !== otherData.name.trim().toUpperCase();
                const nameStyle = isNameDiff ? 'color: #f43f5e; font-weight: 900; text-decoration: underline;' : 'font-weight: 500;';

                return `
                    <div class="color-info-cell" style="font-size: 0.75rem;">
                        <div class="color-name" style="${nameStyle}">${escapeHtml(data.name)}</div>
                        <div class="color-meta" style="margin-top: 4px; display: flex; align-items: center; gap: 8px;">
                            <span class="nk-badge-mini" style="background: rgba(255,255,255,0.05); padding: 1px 4px; border-radius: 3px; font-size: 0.65rem;">${nk}</span>
                            <span class="cmyk-text" style="font-family: monospace; opacity: 0.8;">[${cmykHtml}]</span>
                        </div>
                    </div>
                `;
            };

            let col3 = '';
            let status = 'IDÉNTICO';
            let statusClass = 'valid';

            if (type === 'exact') {
                col3 = `<div class="diff-msg success" style="color: #10b981; font-size: 0.75rem;"><i class="fas fa-check"></i> Sin cambios</div>`;
            } else if (type === 'name_mismatch') {
                col3 = `<div class="diff-msg warning" style="color: #f59e0b; font-size: 0.75rem;"><i class="fas fa-font"></i> Nombre cambió</div>`;
                status = 'CAMBIO NOMBRE';
                statusClass = 'orange';
                tr.className = 'row-error-orange';
            } else if (type === 'different') {
                let diffs = [];
                if (p.name.trim().toUpperCase() !== s.name.trim().toUpperCase()) diffs.push(`<div style="color: #f43f5e;"><i class="fas fa-font"></i> Nombre cambió</div>`);
                if (p.nk !== s.nk) diffs.push(`<div style="color: #f43f5e;"><i class="fas fa-fingerprint"></i> NK cambió</div>`);
                
                const pCMYK = (p.cmyk || []).map(v => Number(v).toFixed(6)).join('/');
                const sCMYK = (s.cmyk || []).map(v => Number(v).toFixed(6)).join('/');
                if (pCMYK !== sCMYK) diffs.push(`<div style="color: #f43f5e;"><i class="fas fa-palette"></i> CMYK varió</div>`);
                
                col3 = `<div class="diff-list" style="font-size: 0.7rem;">${diffs.join('')}</div>`;
                status = 'DIFERENTE';
                statusClass = 'red';
            } else if (type === 'missing_in_secondary') {
                col3 = `<div style="color: #f43f5e; font-size: 0.7rem;"><i class="fas fa-minus-circle"></i> No está en el archivo nuevo</div>`;
                status = 'FALTA';
                statusClass = 'red';
            } else if (type === 'additional_in_secondary') {
                col3 = `<div style="color: #3b82f6; font-size: 0.7rem;"><i class="fas fa-plus-circle"></i> Solo en el archivo nuevo</div>`;
                status = 'ADICIONAL';
                statusClass = 'blue';
            }

            tr.innerHTML = `
                <td style="padding: 10px;">${formatInfo(p, s, true)}</td>
                <td style="padding: 10px;">${formatInfo(s, p, false)}</td>
                <td style="padding: 10px;">${col3}</td>
                <td class="text-center" style="padding: 10px;"><span class="status-badge-solid ${statusClass}">${status}</span></td>
                <td class="text-center" style="padding: 10px;">
                    ${s ? `
                        <div style="display: flex; gap: 5px; justify-content: center;">
                            <button class="btn-icon-action edit-cyclic" data-uid="${s._uid}" title="Editar" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;"><i class="fas fa-pencil-alt"></i></button>
                            <button class="btn-icon-action delete-cyclic" data-uid="${s._uid}" title="Eliminar" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    ` : ''}
                </td>
            `;
            tableBody.appendChild(tr);
        });

        // Vincular eventos de edición
        tableBody.querySelectorAll('.edit-cyclic').forEach(btn => {
            btn.onclick = () => this.showManualEditModal(btn.dataset.uid);
        });

        // Vincular eventos de eliminación
        tableBody.querySelectorAll('.delete-cyclic').forEach(btn => {
            btn.onclick = () => {
                const uid = btn.dataset.uid;
                const idx = this.records.findIndex(r => r._uid === uid);
                if (idx !== -1) {
                    if (confirm(`¿Eliminar "${this.records[idx].name}" del archivo nuevo?`)) {
                        this.records.splice(idx, 1);
                        this.runStrictComparison();
                        window.showNotification('Eliminado', 'Color removido del archivo de cambios.', 'info');
                    }
                }
            };
        });

        const exportBtn = this.container.querySelector('#btnExportLin');
        if (exportBtn) exportBtn.disabled = false;
    }


    async handleFileLoad(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const result = await loadFile(file, true);
            if (!result) return;

            this.fileName = result.fileName;
            this.records = result.records.map((r, i) => ({ 
                ...r, 
                _uid: r._uid || `lin_${Date.now()}_${i}` 
            }));
            
            // RESET TOTAL PARA MODO DIRECTO (Eliminar rastro de cíclicos)
            this.mode = 'direct';
            this.masterRecords = []; 
            this.comparisonResults = []; 
            
            this.container.querySelector('#linFileName1').textContent = this.fileName;
            
            // Limpiar nombres en la zona de cíclicos para evitar confusión
            const mName = this.container.querySelector('#linMasterFileName');
            const sName = this.container.querySelector('#linSecondaryFileName');
            if (mName) mName.textContent = "Cargar Maestro (Base)";
            if (sName) sName.textContent = "Cargar Secundario (Cambios)";

            await this.performValidation();
            this.saveToCache();
            
            window.showNotification('Archivo Cargado', 'Registros analizados para auditoría.', 'success');
        } catch (error) {
            console.error('Error:', error);
            window.showNotification('Error', 'No se pudo cargar el archivo.', 'error');
        }
    }

    async performValidation() {
        const { ensureValidColorCatalogLoaded, isValidColorName } = await import('../modules/nameValidator.js');
        const { EQUIVALENCE_MAP, updateConstantsFromDB } = await import('../core/constants.js');
        const { getEquivalencyGroupsFromDB } = await import('../core/supabaseClient.js');
        
        // FORZAR RECARGA DESDE SUPABASE (Para evitar errores por datos obsoletos en la DB)
        const dbGroups = await getEquivalencyGroupsFromDB();
        if (dbGroups && dbGroups.length > 0) {
            updateConstantsFromDB(dbGroups);
        }
        await ensureValidColorCatalogLoaded();
        
        // Hacer disponible globalmente para las funciones de renderizado
        window.EQUIVALENCY_ROWS = dbGroups;
        
        const groups = {}; 
        
        // 1. Obtener NK dominante para buscar en base de datos
        const nkCounts = {};
        this.records.forEach(r => { if (r.nk) nkCounts[r.nk] = (nkCounts[r.nk] || 0) + 1; });
        let dominantNk = Object.entries(nkCounts).sort((a,b) => b[1] - a[1])[0]?.[0];

        if (!dominantNk && this.fileName) {
            const { extractNK } = await import('../core/utils.js');
            dominantNk = extractNK(this.fileName);
        }

        // 2. Intentar cargar el Maestro desde Supabase para comparar CMYK
        let masterRecordsMap = new Map(); // Mapa por Nombre
        let masterRecordsByNk = new Map(); // Mapa por NK (Más confiable)
        
        if (dominantNk) {
            try {
                const { getActiveTxt } = await import('../core/supabaseClient.js');
                const masterData = await getActiveTxt(dominantNk, 1) || await getActiveTxt(dominantNk, 2) || await getActiveTxt(dominantNk, 3);
                if (masterData && masterData.contenido) {
                    const parsedMaster = parseTxtContent(masterData.contenido);
                    if (parsedMaster && parsedMaster.records) {
                        parsedMaster.records.forEach(mr => {
                            const cleanMName = mr.name.trim().toUpperCase();
                            const cleanMNk = (mr.nk || '').trim().toUpperCase();
                            masterRecordsMap.set(cleanMName, mr);
                            if (cleanMNk) masterRecordsByNk.set(cleanMNk, mr);
                        });
                    }
                }
            } catch (dbError) {
                console.error('Error DB:', dbError);
            }
        }

        // 3. Agrupamiento para validación de consistencia y equivalencias
        const eqGroupsInFile = {}; 
        const eqMap = window.EQUIVALENCE_MAP || new Map();
        const nkGroupNames = {}; // "NK" -> Set(groupIds) para validar inconsistencia real
        const nkGroupMasterNames = {}; // "NK" -> Set(masterNames)

        this.records.forEach(record => {
            const nk = (record.nk || '').trim().toUpperCase();
            if (!groups[nk]) groups[nk] = { nk, records: [] };
            groups[nk].records.push(record);

            if (nk) {
                if (!nkGroupNames[nk]) nkGroupNames[nk] = new Set();
                const info = eqMap.get(record.baseName.toUpperCase());
                const gid = info ? info.groupId : 'UNKNOWN_' + record.baseName.toUpperCase();
                nkGroupNames[nk].add(gid);
            }

            const pureBaseName = extractBaseName(record.name).toUpperCase();
            record.pureBaseName = pureBaseName;

            const eqData = eqMap.get(pureBaseName);
            if (eqData) {
                record.groupId = eqData.groupId;
                const eqKey = `${nk}|${record.groupId}`;
                if (!eqGroupsInFile[eqKey]) eqGroupsInFile[eqKey] = [];
                eqGroupsInFile[eqKey].push(record);
            }
        });

        // 4. Identificar errores detallados según MANUAL DE FUNCIONAMIENTO V3.1
        // Determinar qué listas validar según el modo
        const allLists = (this.mode === 'direct') ? [this.records] : [this.records, this.masterRecords].filter(l => l.length > 0);
        
        allLists.forEach(list => {
            list.forEach(r => {
                // NORMALIZACIÓN AGRESIVA (Manual V3.1 + Tolerancia de espacios)
                const normalizeName = (n) => String(n || '').toUpperCase().replace(/[^A-Z0-9]/gi, ''); // Elimina TODO excepto letras y números
                const baseName = r.baseName || r.name || '';
                const cleanBase = normalizeName(baseName);
                const nk = (r.nk || '').trim().toUpperCase();

                // 1. REGLA 35/69: Validación Global de Catálogo
                // Usamos la normalización agresiva para buscar en el mapa
                const infoByName = window.EQUIVALENCE_MAP ? window.EQUIVALENCE_MAP.get(cleanBase) : null;
                // VALIDACIÓN TOLERANTE DE NK (Solo números y letras, sin prefijos)
                const normalizeNK = (v) => String(v || '').replace(/^NK/i, '').replace(/[^A-Z0-9]/gi, '').toUpperCase();

                // 1. VALIDACIÓN DE NOMBRE (Cruce vs Catálogo de Equivalencias)
                r.isInvalidName = !window.isValidColorName(baseName);
                
                // 2. VALIDACIÓN DE NK (Cruce vs Maestro de Supabase nk_code)
                r.isValidNkInSystem = window.isValidNK ? window.isValidNK(nk) : true;
                r.isInvalidNkCode = nk && !r.isValidNkInSystem;
                r.isMissingNk = !nk;

                // Eliminamos cualquier rastro de Mismatch o IDs de Grupo en la validación individual
                r.isNkMismatch = false;
                r.expectedNk = '';

                // 3. REGLA 45 (DIAGNÓSTICO)
                // EXCEPCIÓN TONAL: No validar NK si el color empieza con TN, TNL o Tonal
                const isTonal = baseName.toUpperCase().startsWith('TONAL') ||
                                baseName.toUpperCase().startsWith('TNL') ||
                                baseName.toUpperCase().startsWith('TN');
                r.isMissingNk = !nk && !isTonal;        // 🔵 Azul (Exento si es Tonal)
                r.isInvalidNkCode = !isTonal && nk && !r.isValidNkInSystem; // 🔴 Rojo (Exento si es Tonal)
                r.hasCmykRangeError = r.cmyk.some(v => isNaN(v) || v > 100); // 🔴 Rojo (Regla 45.1)
                
                // DUPLICADOS (Regla 45.1): Requiere mismo baseName + mismo NK
                const cleanBaseName = (r.baseName || '').trim().toUpperCase();
                r.isDuplicate = list.filter(other =>
                    other !== r &&
                    normalizeNK(other.nk) === normalizeNK(nk) &&
                    (other.baseName || '').trim().toUpperCase() === cleanBaseName
                ).length > 0;

                // 4. REGLA 45.5 (AMARILLO): Error de Nomenclatura
                const fullName = r.fullName || r.name || '';
                r.hasNumberedParentheses = /\(\d+\)/.test(fullName);

                // 5. REGLA 48 (PÚRPURA): Inconsistencia (Solo para Cíclicos)
                // Se mantiene la lógica de grupos para detectar cruces de colores bajo mismo NK
                r.isNameInconsistent = false; // Se calculará si es necesario en modo cíclico

                // ============================================================
                // CÁLCULO FINAL DE ESTADO (Válido / Error)
                // ============================================================
                const isCritical = r.isCorrupted || r.isDuplicate || r.isInvalidName || 
                                   r.isNkMismatch || r.isMissingNk || r.hasCmykRangeError || r.isInvalidNkCode ||
                                   r.hasNumberedParentheses;

                if (this.mode === 'direct') {
                    // En Auditoría Directa solo bloquean los errores críticos definidos en el manual
                    r.hasError = isCritical;
                } else {
                    // En modo Cíclico se añade rigor de consistencia
                    r.hasError = isCritical || r.isNameInconsistent;
                }
            });
        });

        // 5. BLOQUEO DE COMPARACIÓN si hay errores
        const hasAnyFileError = this.records.some(r => r.hasError) || (this.masterRecords && this.masterRecords.some(r => r.hasError));
        const runBtn = this.container.querySelector('#btnRunCyclic');
        if (runBtn) {
            runBtn.disabled = hasAnyFileError;
            runBtn.style.opacity = hasAnyFileError ? '0.5' : '1';
            runBtn.style.cursor = hasAnyFileError ? 'not-allowed' : 'pointer';
            runBtn.title = hasAnyFileError ? 'Corrija los errores resaltados antes de comparar' : 'Iniciar comparación';
        }

        // 6. Ordenar: Primero por NK (para agrupar), luego errores arriba de su grupo
        this.records.sort((a, b) => {
            const nkA = (a.nk || 'ZZZ').toUpperCase();
            const nkB = (b.nk || 'ZZZ').toUpperCase();
            if (nkA !== nkB) return nkA.localeCompare(nkB);
            if (a.hasError !== b.hasError) return b.hasError - a.hasError;
            return a.name.localeCompare(b.name);
        });

        this.renderResults();
    }

    renderResults() {
        const resultsPanel = this.container.querySelector('#linResultsPanel');
        const tableBody = this.container.querySelector('#linResultsTableBody');
        const statsBadges = this.container.querySelector('#linStatsBadges');

        if (this.container.querySelector('#linEmptyState')) {
            this.container.querySelector('#linEmptyState').style.display = 'none';
        }
        resultsPanel.style.display = 'block';

        // AJUSTAR ENCABEZADOS SEGÚN EL MODO (Sincronización de Interfaz)
        const tableHeader = this.container.querySelector('.premium-data-table thead tr');
        if (tableHeader && this.mode === 'cyclic' && this.comparisonResults.length) {
            tableHeader.innerHTML = `
                <th>Archivo Base (Master)</th>
                <th>Archivo Nuevo (Target)</th>
                <th>Diferencias Detectadas</th>
                <th class="text-center">Estado</th>
                <th class="text-center">Acciones</th>
            `;
        } else if (tableHeader) {
            tableHeader.innerHTML = `
                <th style="width:50px">#</th>
                <th>Nombre del Color</th>
                <th class="text-center">NK</th>
                <th class="text-center">Valores CMYK</th>
                <th class="text-center">Estado</th>
                <th class="text-center" style="width:100px">Acciones</th>
            `;
        }

        // 1. Preparar conteos agregados (Sincronizado con el modo activo)
        const activeRecords = (this.mode === 'direct') ? this.records : [...this.records, ...this.masterRecords];

        const counts = {
            corrupted: activeRecords.filter(r => r.isCorrupted).length,
            dup: activeRecords.filter(r => r.isDuplicate).length,
            range: activeRecords.filter(r => r.hasCmykRangeError).length,
            nom: activeRecords.filter(r => r.isInvalidName && r.hasError).length,
            nkMismatch: activeRecords.filter(r => r.isNkMismatch && r.hasError).length,
            nameInconsistent: activeRecords.filter(r => r.isNameInconsistent && r.hasError).length,
            nk: activeRecords.filter(r => r.isMissingNk).length,
            invalidNk: activeRecords.filter(r => r.isInvalidNkCode).length,
            parentheses: activeRecords.filter(r => r.hasNumberedParentheses).length
        };
        const errorCount = activeRecords.filter(r => r.hasError).length;

        // 2. Renderizar Badges de Estadísticas / Filtros (CON INTENSIDAD NEÓN SI HAY ERRORES)
        if (statsBadges) {
            statsBadges.innerHTML = `
                <div class="stat-badge-mini ${!this.activeFilter ? 'active' : ''}" data-filter="all" style="background: rgba(255,255,255,0.05); border-color: #64748b; color: #e2e8f0;">
                    <i class="fas fa-eye"></i> Todos (${this.records.length})
                </div>
                ${counts.corrupted > 0 ? `<div class="stat-badge-mini red has-count ${this.activeFilter === 'corrupted' ? 'active' : ''}" data-filter="corrupted"><i class="fas fa-bug"></i> ${counts.corrupted} Corruptos</div>` : ''}
                ${counts.range > 0 ? `<div class="stat-badge-mini red has-count ${this.activeFilter === 'range' ? 'active' : ''}" data-filter="range"><i class="fas fa-exclamation-circle"></i> ${counts.range} CMYK > 100</div>` : ''}
                ${counts.dup > 0 ? `<div class="stat-badge-mini red has-count ${this.activeFilter === 'dup' ? 'active' : ''}" data-filter="dup"><i class="fas fa-copy"></i> ${counts.dup} Duplicados</div>` : ''}
                ${counts.nkMismatch > 0 ? `<div class="stat-badge-mini orange has-count ${this.activeFilter === 'nkMismatch' ? 'active' : ''}" data-filter="nkMismatch"><i class="fas fa-fingerprint"></i> ${counts.nkMismatch} NK Mismatch</div>` : ''}
                ${counts.invalidNk > 0 ? `<div class="stat-badge-mini red has-count ${this.activeFilter === 'invalidNk' ? 'active' : ''}" data-filter="invalidNk"><i class="fas fa-id-card-alt"></i> ${counts.invalidNk} NK Inválido</div>` : ''}
                ${counts.nameInconsistent > 0 ? `<div class="stat-badge-mini orange has-count ${this.activeFilter === 'nameInconsistent' ? 'active' : ''}" data-filter="nameInconsistent"><i class="fas fa-font"></i> ${counts.nameInconsistent} Nom. Diferente</div>` : ''}
                ${counts.nom > 0 ? `<div class="stat-badge-mini orange has-count ${this.activeFilter === 'nom' ? 'active' : ''}" data-filter="nom"><i class="fas fa-book-dead"></i> Catálogo (${counts.nom})</div>` : ''}
                ${counts.nk > 0 ? `<div class="stat-badge-mini blue has-count ${this.activeFilter === 'nk' ? 'active' : ''}" data-filter="nk"><i class="fas fa-fingerprint"></i> Sin NK (${counts.nk})</div>` : ''}
                ${counts.parentheses > 0 ? `<div class="stat-badge-mini orange has-count ${this.activeFilter === 'parentheses' ? 'active' : ''}" data-filter="parentheses"><i class="fas fa-brackets-curly"></i> Paréntesis (${counts.parentheses})</div>` : ''}
                ${errorCount === 0 && this.records.length > 0 ? '<div class="stat-badge-mini" style="background: rgba(16, 185, 129, 0.2); border: 2px solid #10b981; color: #10b981; box-shadow: 0 0 15px rgba(16, 185, 129, 0.4);"><i class="fas fa-check-circle"></i> TODO CORRECTO</div>' : ''}
            `;

            // Vincular eventos de filtrado
            statsBadges.querySelectorAll('.stat-badge-mini').forEach(badge => {
                badge.onclick = () => {
                    const filter = badge.dataset.filter;
                    this.activeFilter = (filter === 'all' || this.activeFilter === filter) ? null : filter;
                    this.renderResults();
                    this.saveToCache();
                };
            });
        }

        // 3. Filtrar registros a mostrar
        let listToRender = (this.mode === 'cyclic' && this.comparisonResults.length) ? this.comparisonResults : this.records;
        
        let recordsToDisplay = listToRender;
        if (this.activeFilter) {
            recordsToDisplay = listToRender.filter(r => {
                if (this.activeFilter === 'corrupted') return r.isCorrupted;
                if (this.activeFilter === 'range') return r.hasCmykRangeError;
                if (this.activeFilter === 'dup') return r.isDuplicate;
                if (this.activeFilter === 'nkMismatch') return r.isNkMismatch;
                if (this.activeFilter === 'nameInconsistent') return r.isNameInconsistent;
                if (this.activeFilter === 'nom') return r.isInvalidName;
                if (this.activeFilter === 'nk') return r.isMissingNk;
                if (this.activeFilter === 'parentheses') return r.hasNumberedParentheses;
                return true;
            });
        }

        tableBody.innerHTML = '';

        // 4. Renderizar Filas
        recordsToDisplay.forEach((record, index) => {
            const tr = document.createElement('tr');
            
            // MODO CÍCLICO: Renderizado Comparativo
            if (this.mode === 'cyclic' && record.isComparison) {
                const diffs = [];
                if (record.diffCmyk) diffs.push('<span class="diff-tag cmyk">CMYK</span>');
                if (record.diffName) diffs.push('<span class="diff-tag name">Nombre</span>');
                
                let comparisonStatus = '<div class="status-badge-solid valid"><i class="fas fa-check-circle"></i> Sin Cambios</div>';
                let rowClass = 'row-success';
                
                if (record.type === 'missing') {
                    comparisonStatus = '<div class="status-badge-solid red"><i class="fas fa-minus-circle"></i> Faltante</div>';
                    rowClass = 'row-error-red';
                } else if (record.type === 'new') {
                    comparisonStatus = '<div class="status-badge-solid blue"><i class="fas fa-plus-circle"></i> Nuevo</div>';
                    rowClass = 'row-error-blue';
                } else if (diffs.length > 0) {
                    comparisonStatus = '<div class="status-badge-solid orange"><i class="fas fa-exchange-alt"></i> Diferente</div>';
                    rowClass = 'row-error-orange';
                }

                tr.className = rowClass;
                tr.innerHTML = `
                    <td>
                        <div class="comp-cell master">
                            ${record.master ? `<div class="name">${record.master.name}</div><div class="cmyk">${record.master.cmyk.join(' / ')}</div>` : '---'}
                        </div>
                    </td>
                    <td>
                        <div class="comp-cell target">
                            ${record.target ? `<div class="name">${record.target.name}</div><div class="cmyk">${record.target.cmyk.join(' / ')}</div>` : '---'}
                        </div>
                    </td>
                    <td><div class="diff-tags-container">${diffs.join(' ')}</div></td>
                    <td class="text-center">${comparisonStatus}</td>
                    <td class="text-center">
                        <button class="btn-icon-action edit" data-uid="${record.target?._uid || record.master?._uid}" title="Ver Detalles"><i class="fas fa-search-plus"></i></button>
                    </td>
                `;
            } else {
                // MODO DIRECTO: Renderizado de Lista Simple
                const formatCmyk = (r) => (r.cmyk || []).map(v => Number(v).toFixed(6)).join(' / ');
                const cmykStr = formatCmyk(record);
                const nk = record.nk || '---';
                
                let statusHtml = '<div class="status-badge-solid valid"><i class="fas fa-check-circle"></i> Válido</div>';
                let rowColorClass = 'row-success';

                if (record.isCorrupted) {
                    statusHtml = '<div class="status-badge-solid red"><i class="fas fa-bug"></i> Corrupto</div>';
                    rowColorClass = 'row-error-red';
                } else if (record.isDuplicate) { 
                    statusHtml = '<div class="status-badge-solid red"><i class="fas fa-copy"></i> Duplicado</div>'; 
                    rowColorClass = 'row-error-red';
                } else if (record.hasCmykRangeError) {
                    statusHtml = '<div class="status-badge-solid red"><i class="fas fa-exclamation-circle"></i> Rango > 100</div>';
                    rowColorClass = 'row-error-red';
                } else if (record.isInvalidNkCode) {
                    statusHtml = '<div class="status-badge-solid red"><i class="fas fa-times-circle"></i> NK No Existe</div>';
                    rowColorClass = 'row-error-red';
                } else if (record.isInvalidName) { 
                    statusHtml = '<div class="status-badge-solid orange"><i class="fas fa-book-dead"></i> Catálogo</div>';
                    rowColorClass = 'row-error-orange';
                } else if (record.isMissingNk) { 
                    statusHtml = '<div class="status-badge-solid blue"><i class="fas fa-fingerprint"></i> Sin NK</div>'; 
                    rowColorClass = 'row-error-blue';
                } else if (record.hasNumberedParentheses) {
                    statusHtml = '<div class="status-badge-solid orange"><i class="fas fa-exclamation"></i> Paréntesis</div>';
                    rowColorClass = 'row-error-orange';
                }

                tr.className = rowColorClass;
                tr.innerHTML = `
                    <td class="text-center" style="font-size: 0.75rem;">${record._originalIndex || index + 1}</td>
                    <td><div class="color-name-main" style="font-size: 0.8rem; font-weight: 500;">${escapeHtml(record.baseName || record.name)}</div></td>
                    <td class="text-center"><span class="nk-badge-mini" style="font-size: 0.7rem; padding: 2px 6px;">${nk}</span></td>
                    <td class="text-center" style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #94a3b8;">${cmykStr}</td>
                    <td class="text-center">${statusHtml}</td>
                    <td class="text-center">
                        <div style="display: flex; gap: 5px; justify-content: center;">
                            <button class="btn-icon-action edit" data-uid="${record._uid}" title="Editar"><i class="fas fa-pencil-alt"></i></button>
                            <button class="btn-icon-action delete" data-uid="${record._uid}" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </td>
                `;
            }
            tableBody.appendChild(tr);
        });

        // 5. Vincular eventos de acciones
        tableBody.querySelectorAll('.btn-icon-action.edit').forEach(btn => {
            btn.onclick = () => this.showManualEditModal(btn.dataset.uid);
        });

        tableBody.querySelectorAll('.btn-icon-action.delete').forEach(btn => {
            btn.onclick = () => {
                const uid = btn.dataset.uid;
                const idx = this.records.findIndex(r => r._uid === uid);
                if (idx === -1) return;
                
                if (confirm(`¿Seguro que desea ELIMINAR el color "${this.records[idx].name}" de este archivo?`)) {
                    this.records.splice(idx, 1);
                    this.performValidation();
                }
            };
        });

        this.saveToCache();

        const exportBtn = this.container.querySelector('#btnExportLin');
        if (exportBtn) exportBtn.disabled = errorCount > 0;
    }

    async showManualEditModal(uid) {
        // Buscar el registro principal a editar
        let idx = this.records.findIndex(r => r._uid === uid);
        let targetArray = this.records;
        if (idx === -1) {
            idx = this.masterRecords.findIndex(r => r._uid === uid);
            targetArray = this.masterRecords;
        }
        
        if (idx === -1) return;
        const rec = targetArray[idx];

        // Calcular el NK más frecuente en el archivo para sugerencias
        const nkCounts = {};
        this.records.forEach(r => { if (r.nk) nkCounts[r.nk] = (nkCounts[r.nk] || 0) + 1; });
        const mostFrequentNk = Object.entries(nkCounts).sort((a,b) => b[1] - a[1])[0]?.[0] || "";

        // Buscar "hermanos" de conflicto (mismo NK y mismo Grupo de Equivalencia)
        let conflictGroup = [];
        const cleanNk = (rec.nk || '').trim().toUpperCase();
        if (rec.groupId) {
            conflictGroup = this.records.filter(r => (r.nk || '').trim().toUpperCase() === cleanNk && r.groupId === rec.groupId);
        } else {
            conflictGroup = [rec];
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.zIndex = '10005';
        
        // Generar HTML para cada registro en el grupo de conflicto
        let recordsHtml = conflictGroup.map((r, i) => {
            const isMain = r._uid === uid;
            const isNameInCatalog = isValidColorName(r.baseName || r.name);
            const lineNum = r.id || r._originalIndex || "?";
            
            return `
                <div class="edit-record-section" data-uid="${r._uid}" style="background: ${isMain ? 'rgba(59, 130, 246, 0.05)' : 'rgba(30, 41, 59, 0.3)'}; border: 1px solid ${isMain ? '#3b82f6' : '#334155'}; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span style="font-size: 0.8rem; font-weight: bold; color: ${isMain ? '#3b82f6' : '#94a3b8'};">
                            <i class="fas fa-paint-brush"></i> ${isMain ? 'COLOR PRINCIPAL' : 'COLOR EQUIVALENTE'} 
                            <span style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; margin-left: 10px; font-size: 0.65rem; color: #3b82f6; border: 1px solid rgba(59,130,246,0.2);">Línea #${lineNum}</span>
                        </span>
                        <div style="display: flex; gap: 10px; align-items: center;">
                             <button class="btn-sync-row" title="Copiar estos valores a los demás" style="background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid #10b981; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 0.65rem;"><i class="fas fa-copy"></i> USAR ESTE CMYK</button>
                             <span style="font-size: 0.7rem; color: ${isNameInCatalog ? '#10b981' : '#f59e0b'}; font-weight: bold;">
                                <i class="fas fa-${isNameInCatalog ? 'check-circle' : 'exclamation-triangle'}"></i> ${isNameInCatalog ? 'CATÁLOGO' : 'NO REG.'}
                            </span>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 10px; margin-bottom: 10px;">
                        <div>
                            <label style="display:block; color:#64748b; font-size:0.6rem; margin-bottom:3px;">NOMBRE</label>
                            <input type="text" class="inp-name" list="colorNameSuggestions" value="${escapeHtml(r.baseName || r.name)}" style="width:100%; background:#0b0f1a; border:1px solid #334155; color:white; padding:8px; border-radius:4px; font-size: 0.8rem;">
                        </div>
                        <div>
                            <label style="display:block; color:#64748b; font-size:0.6rem; margin-bottom:3px;">NK ${!r.nk && mostFrequentNk ? `<span class="btn-suggest-nk" data-nk="${mostFrequentNk}" style="color: #3b82f6; cursor: pointer; margin-left: 5px; text-decoration: underline;">💡 Sugerencia: ${mostFrequentNk}</span>` : ''}</label>
                            <input type="text" class="inp-nk" value="${escapeHtml(r.nk || '')}" placeholder="Ej: NK675426" style="width:100%; background:#0b0f1a; border:1px solid #334155; color:#3b82f6; padding:8px; border-radius:4px; font-family:monospace; font-size: 0.8rem;">
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px;">
                        <div><label style="font-size:0.6rem; color:#64748b;">C</label><input type="number" class="inp-c" value="${r.cmyk[0]}" step="0.000001" style="width:100%; background:#0b0f1a; border:1px solid #334155; color:${r.cmyk[0]>100?'#f43f5e':'white'}; padding:6px; border-radius:4px; font-size: 0.75rem;"></div>
                        <div><label style="font-size:0.6rem; color:#64748b;">M</label><input type="number" class="inp-m" value="${r.cmyk[1]}" step="0.000001" style="width:100%; background:#0b0f1a; border:1px solid #334155; color:${r.cmyk[1]>100?'#f43f5e':'white'}; padding:6px; border-radius:4px; font-size: 0.75rem;"></div>
                        <div><label style="font-size:0.6rem; color:#64748b;">Y</label><input type="number" class="inp-y" value="${r.cmyk[2]}" step="0.000001" style="width:100%; background:#0b0f1a; border:1px solid #334155; color:${r.cmyk[2]>100?'#f43f5e':'white'}; padding:6px; border-radius:4px; font-size: 0.75rem;"></div>
                        <div><label style="font-size:0.6rem; color:#64748b;">K</label><input type="number" class="inp-k" value="${r.cmyk[3]}" step="0.000001" style="width:100%; background:#0b0f1a; border:1px solid #334155; color:${r.cmyk[3]>100?'#f43f5e':'white'}; padding:6px; border-radius:4px; font-size: 0.75rem;"></div>
                    </div>

                    <div style="display: flex; gap: 10px;">
                        <label style="color: #3b82f6; font-size: 0.7rem; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                            <input type="checkbox" class="inp-force" ${r.isManualValidated ? 'checked' : ''}> Omitir catálogo
                        </label>
                        <div style="margin-left: auto; font-family: monospace; font-size: 0.65rem; color: #4b5563;">LAB: ${(r.lab||[]).join('/')}</div>
                    </div>
                </div>
            `;
        }).join('');

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px; background: #0f172a; border: 2px solid #334155; border-radius: 12px; max-height: 90vh; display: flex; flex-direction: column;">
                <div class="modal-header" style="background: #1e293b; border-bottom: 2px solid #3b82f6; padding: 1rem; border-radius: 12px 12px 0 0;">
                    <h3 style="color: white; margin: 0; font-size: 1rem;"><i class="fas fa-layer-group" style="color: #3b82f6; margin-right: 10px;"></i> Resolución de Conflictos</h3>
                    <p style="margin: 5px 0 0 0; font-size: 0.7rem; color: #94a3b8;">Los valores > 100 se corregirán a 100.000000 automáticamente al guardar.</p>
                </div>
                <div class="modal-body" style="padding: 1.5rem; overflow-y: auto; flex: 1;">
                    <div id="error_msg_container"></div>
                    ${recordsHtml}
                    <datalist id="colorNameSuggestions">
                        ${(window.ALL_VALID_COLOR_NAMES || []).map(name => `<option value="${name}">`).join('')}
                    </datalist>
                </div>
                <div class="modal-footer" style="padding: 1rem; background: #1e293b; display: flex; justify-content: flex-end; gap: 10px; border-radius: 0 0 12px 12px;">
                    <button id="cancel_edit" style="background:transparent; border:1px solid #475569; color:#94a3b8; padding:8px 20px; border-radius:6px; cursor:pointer; font-size: 0.8rem;">CANCELAR</button>
                    <button id="save_edit" style="background:#3b82f6; border:none; color:white; padding:8px 25px; border-radius:6px; font-weight:bold; cursor:pointer; font-size: 0.8rem;">GUARDAR Y VALIDAR TODO</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Lógica de sugerencia de NK
        modal.querySelectorAll('.btn-suggest-nk').forEach(btn => {
            btn.onclick = () => {
                const nk = btn.dataset.nk;
                const section = btn.closest('.edit-record-section');
                section.querySelector('.inp-nk').value = nk;
                btn.style.display = 'none';
            };
        });

        // Lógica del botón de sincronización de fila
        modal.querySelectorAll('.btn-sync-row').forEach(btn => {
            btn.onclick = () => {
                const section = btn.closest('.edit-record-section');
                const c = section.querySelector('.inp-c').value;
                const m = section.querySelector('.inp-m').value;
                const y = section.querySelector('.inp-y').value;
                const k = section.querySelector('.inp-k').value;
                
                modal.querySelectorAll('.edit-record-section').forEach(s => {
                    s.querySelector('.inp-c').value = c;
                    s.querySelector('.inp-m').value = m;
                    s.querySelector('.inp-y').value = y;
                    s.querySelector('.inp-k').value = k;
                    // Actualizar colores de input
                    s.querySelectorAll('input[type="number"]').forEach(inp => {
                        inp.style.color = parseFloat(inp.value) > 100 ? '#f43f5e' : 'white';
                    });
                });
                window.showNotification('Sincronizado', 'Valores CMYK igualados en el grupo.', 'info');
            };
        });

        // Advertencia visual en tiempo real para valores > 100
        modal.querySelectorAll('input[type="number"]').forEach(inp => {
            inp.oninput = () => {
                inp.style.color = parseFloat(inp.value) > 100 ? '#f43f5e' : 'white';
            };
        });

        modal.querySelector('#cancel_edit').onclick = () => modal.remove();

        modal.querySelector('#save_edit').onclick = async () => {
            const sections = modal.querySelectorAll('.edit-record-section');
            
            // 1. Recolectar y NORMALIZAR (Clamp a 100)
            sections.forEach(section => {
                const sUid = section.dataset.uid;
                const sIdx = this.records.findIndex(r => r._uid === sUid);
                if (sIdx === -1) return;

                const name = section.querySelector('.inp-name').value.trim();
                const nk = section.querySelector('.inp-nk').value.trim().toUpperCase();
                
                const normalizeVal = (v) => {
                    let val = parseFloat(v) || 0;
                    return val > 100 ? 100.0 : val;
                };

                this.records[sIdx] = {
                    ...this.records[sIdx],
                    name: `${name} ${nk}`.trim(),
                    baseName: name,
                    nk: nk,
                    isManualValidated: section.querySelector('.inp-force').checked,
                    cmyk: [
                        normalizeVal(section.querySelector('.inp-c').value),
                        normalizeVal(section.querySelector('.inp-m').value),
                        normalizeVal(section.querySelector('.inp-y').value),
                        normalizeVal(section.querySelector('.inp-k').value)
                    ]
                };
            });

            // 2. Re-ejecutar validación completa
            if (this.comparisonResults.length > 0) {
                await this.runStrictComparison();
            } else {
                await this.performValidation();
            }

            // 3. Verificar si el conflicto persiste en cualquiera de los registros del grupo
            const firstUidInGroup = conflictGroup[0]._uid;
            const updatedRec = this.records.find(r => r._uid === firstUidInGroup);
            
            if (updatedRec && updatedRec.hasError) {
                let errorMsg = "⚠️ PERSISTEN DIFERENCIAS: Asegúrate de que los CMYK sean EXACTAMENTE iguales.";
                if (updatedRec.hasCmykRangeError) errorMsg = "⚠️ RANGO EXCEDIDO: Hay valores mayores a 100.";
                
                const container = modal.querySelector('#error_msg_container');
                container.innerHTML = `
                    <div style="color: #f43f5e; background: rgba(244, 63, 94, 0.1); padding: 10px; border-radius: 6px; margin-bottom: 15px; font-size: 0.75rem; font-weight: bold; border: 1px solid #f43f5e; animation: shake 0.3s;">
                        <i class="fas fa-exclamation-triangle"></i> ${errorMsg}
                    </div>
                `;
                return; // No cerrar
            }

            modal.remove();
            window.showNotification('Éxito', 'Grupo de colores sincronizado correctamente.', 'success');
        };
    }

    reset() {
        this.records = [];
        this.masterRecords = [];
        this.comparisonResults = [];
        this.fileName = '';
        this.activeFilter = null;
        localStorage.removeItem('lin_auditor_cache');
        this.render();
    }

    /**
     * PROTOCOLO DE SEGURIDAD MÁXIMA: Sincroniza en tiempo real con Supabase
     * para re-validar y sobreescribir nombres con los datos maestros oficiales.
     */
    async applyMasterNamingCorrection() {
        try {
            // 1. Llamada directa a la fuente de verdad (Supabase)
            const { getEquivalencyGroupsFromDB } = await import('../core/supabaseClient.js');
            const freshGroups = await getEquivalencyGroupsFromDB();
            
            if (!freshGroups || freshGroups.length === 0) {
                console.warn('⚠️ No se pudo obtener el catálogo fresco de Supabase para la sanitización final.');
                return;
            }

            console.log('%c🚀 Iniciando Sincronización Maestra con Supabase...', 'color: #10b981; font-weight: bold;');
            
            this.records.forEach(r => {
                const nk = (r.nk || '').trim().toUpperCase();
                if (!nk) return;

                // Buscar el grupo oficial por NK directamente en los datos frescos de la DB
                const officialGroup = freshGroups.find(row => row[0].toUpperCase() === nk);
                
                if (officialGroup && officialGroup.length > 1) {
                    const masterName = officialGroup[1]; // Nombre Master definido en la DB
                    const currentBase = (r.baseName || '').trim().toUpperCase();

                    // SOBRESCRITURA FORZADA: El catálogo de Supabase manda sobre el archivo local
                    if (currentBase !== masterName.toUpperCase()) {
                        console.log(`✨ Sincronización: [${nk}] "${currentBase}" -> "${masterName}"`);
                        r.baseName = masterName;
                        r.officialName = masterName;
                        r.name = `${masterName} ${nk}`.trim();
                    }
                }
            });
        } catch (error) {
            console.error('❌ Error crítico en el protocolo de sanitización:', error);
        }
    }

    async exportCorrectedFile() {
        if (!this.records.length && !this.comparisonResults.length) {
            window.showNotification('Sin datos', 'No hay registros auditados para exportar.', 'warning');
            return;
        }

        // BLOQUEO DE SEGURIDAD: Sincronización obligatoria con Supabase antes de generar el archivo
        window.showNotification('Procesando', 'Sincronizando nombres con el catálogo maestro...', 'info');
        await this.applyMasterNamingCorrection();

        let exportItems = [];

        // Si hay resultados de comparación cíclica, exportar SOLO lo que está en el archivo nuevo (Secundario)
        if (this.comparisonResults.length > 0) {
            exportItems = this.records.map(r => {
                // USAR NOMBRE OFICIAL DEL CATÁLOGO SI EXISTE (Regla de Oro de Auditoría)
                const baseNameToUse = r.officialName || r.baseName || extractBaseName(r.name);
                const nkToUse = r.nk || '';
                const finalName = `${baseNameToUse} ${nkToUse}`.trim();
                
                return {
                    name: finalName.replace(/[\r\n]/g, '').trim(),
                    cmyk: r.cmyk,
                    lab: r.lab
                };
            });
        } else {
            // Si es carga individual, exportar los registros auditados
            exportItems = this.records.map(r => {
                // USAR NOMBRE OFICIAL DEL CATÁLOGO SI EXISTE
                const baseNameToUse = r.officialName || r.baseName || extractBaseName(r.name);
                const nkToUse = r.nk || '';
                const finalName = `${baseNameToUse} ${nkToUse}`.trim();

                return {
                    name: finalName.replace(/[\r\n]/g, '').trim(),
                    cmyk: r.cmyk,
                    lab: r.lab
                };
            });
        }

        if (exportItems.length === 0) return;

        // Generar contenido CGATS profesional (con Tabs)
        const today = new Date();
        const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
        let content = 'CGATS.17\nORIGINATOR\t"ALPHA COLOR MATCH"\nFILE_DESCRIPTOR\t""\n';
        content += `CREATED\t"${dateStr}"\nNUMBER_OF_FIELDS\t9\nBEGIN_DATA_FORMAT\n`;
        content += 'SAMPLE_ID\tSAMPLE_NAME\tCMYK_C\tCMYK_M\tCMYK_Y\tCMYK_K\tLAB_L\tLAB_A\tLAB_B\nEND_DATA_FORMAT\n';
        content += `NUMBER_OF_SETS\t${exportItems.length}\nBEGIN_DATA\n\n`;
        
        exportItems.forEach((item, index) => {
            // Asegurar que el nombre tenga el NK y esté entre comillas para Ergosoft
            const fullName = `"${item.name.replace(/[\r\n]/g, '').trim()}"`;
            const id = (index + 1);
            const c = item.cmyk[0].toFixed(6);
            const m = item.cmyk[1].toFixed(6);
            const y = item.cmyk[2].toFixed(6);
            const k = item.cmyk[3].toFixed(6);
            const l = item.lab[0].toFixed(6);
            const a = item.lab[1].toFixed(6);
            const b = item.lab[2].toFixed(6);
            
            // Exportación compacta con espacios simples para evitar saltos de línea
            content += `${id} ${fullName} ${c} ${m} ${y} ${k} ${l} ${a} ${b}\n`;
        });
        content += '\nEND_DATA\n';

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        a.href = url;
        a.download = `audit_${this.fileName || 'file'}_${timestamp}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        
        window.showNotification('Éxito', `Exportados ${exportItems.length} registros auditados.`, 'success');
    }
}
