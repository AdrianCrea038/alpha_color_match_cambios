import { escapeHtml, showNotification } from '../core/utils.js';
import { loadFile } from '../modules/fileLoader.js';
import { validateAndCorrectRecords } from '../modules/nameValidator.js';

export class LinearizationValidatorView {
    constructor(app) {
        this.app = app;
        this.records = [];
        this.results = [];
        this.container = null;
        this.fileName = '';
        
        this.init();
    }

    init() {
        this.container = document.getElementById('linearizationValidatorView');
        if (!this.container) return;
        this.render();
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="palette-validator-container">
                <div class="palette-validator-header">
                    <h3><i class="fas fa-microscope"></i> Comprobación</h3>
                    <p style="font-size: 0.85rem; color: #9ca3af;">Auditoría de nombres duplicados, nomenclatura con paréntesis y consistencia de complementarios.</p>
                </div>

                <div class="upload-section" style="margin-bottom: 2rem;">
                    <div class="upload-card" style="max-width: 100%; width: 100%;">
                        <h3>📁 Cargar Archivo de Linearización (.txt)</h3>
                        <div class="upload-area">
                            <input type="file" id="linValidatorFileInput" accept=".txt" class="file-input">
                            <label for="linValidatorFileInput" class="file-label">Seleccionar archivo</label>
                            <div class="file-info" id="linValidatorFileInfo">
                                <span class="filename">Ningún archivo cargado</span>
                                <span class="record-count"></span>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="linResultsPanel" style="display: none;">
                    <div class="results-header" style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                        <h4 style="color: #00e5ff; margin: 0;"><i class="fas fa-clipboard-check"></i> Resultados del Análisis</h4>
                        <div style="display: flex; gap: 1rem; align-items: center;">
                            <div id="linStatsBadges" style="display: flex; gap: 0.5rem;"></div>
                            <button id="linResetBtn" class="btn-secondary" style="font-size: 0.75rem; padding: 0.4rem 0.8rem;"><i class="fas fa-sync-alt"></i> Nueva Validación</button>
                        </div>
                    </div>

                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th style="width: 50px;">#</th>
                                    <th>Nombre del Color</th>
                                    <th>NK</th>
                                    <th>CMYK (C/M/Y/K)</th>
                                    <th>Lab (L/a/b)</th>
                                    <th>Estado de Validación</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="linResultsTableBody">
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- SECCIÓN DE COMPARACIÓN ESTRICTA -->
                <div class="strict-comparison-section" style="margin-top: 3rem; border-top: 2px dashed rgba(0, 229, 255, 0.2); padding-top: 2rem;">
                    <div class="palette-validator-header" style="margin-bottom: 1.5rem;">
                        <h3 style="color: #ff007f;"><i class="fas fa-equals"></i> Comparación Estricta (Archivo vs Archivo)</h3>
                        <p style="font-size: 0.85rem; color: #9ca3af;">Verificación binaria: Ambos archivos deben ser EXACTAMENTE iguales en nombres, NK y valores.</p>
                    </div>

                    <div class="upload-section" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div class="upload-card">
                            <h3><i class="fas fa-file-invoice"></i> 1. Archivo Original (Base)</h3>
                            <div class="upload-area">
                                <input type="file" id="strictFileA" accept=".txt" class="file-input">
                                <label for="strictFileA" class="file-label">Archivo Base</label>
                                <div id="strictFileAInfo" class="file-info"><span class="filename">No cargado</span></div>
                            </div>
                        </div>
                        <div class="upload-card">
                            <h3><i class="fas fa-file-signature"></i> 2. Archivo a Validar</h3>
                            <div class="upload-area">
                                <input type="file" id="strictFileB" accept=".txt" class="file-input">
                                <label for="strictFileB" class="file-label">Archivo Nuevo</label>
                                <div id="strictFileBInfo" class="file-info"><span class="filename">No cargado</span></div>
                            </div>
                        </div>
                    </div>

                    <div style="text-align: center; margin-top: 1.5rem;">
                        <button id="btnRunStrictCompare" class="btn-primary" style="background: #ff007f; padding: 0.8rem 2rem; font-weight: bold; display: none;">
                            <i class="fas fa-bolt"></i> INICIAR COMPARACIÓN ESTRICTA
                        </button>
                    </div>

                    <div id="strictResultsPanel" style="display: none; margin-top: 2rem;">
                        <div class="results-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                            <h4 style="color: #ff007f; margin: 0;"><i class="fas fa-list-check"></i> Informe de Diferencias Estrictas</h4>
                            <button id="btnResetStrict" class="btn-secondary" style="font-size: 0.75rem; padding: 0.4rem 0.8rem; background: rgba(255, 0, 127, 0.1); border-color: #ff007f; color: #ff007f;">
                                <i class="fas fa-sync-alt"></i> Nueva Comparación
                            </button>
                        </div>
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead style="background: rgba(255, 0, 127, 0.1);">
                                    <tr>
                                        <th style="width: 25%;">Archivo Base (Original)</th>
                                        <th style="width: 25%;">Archivo Nuevo (A Validar)</th>
                                        <th style="width: 35%;">Diferencias Encontradas</th>
                                        <th style="width: 15%; text-align: center;">Estado</th>
                                    </tr>
                                </thead>
                                <tbody id="strictResultsTableBody"></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div id="linEmptyState" class="empty-state" style="padding: 4rem 2rem;">
                    <div class="empty-icon" style="font-size: 3rem; margin-bottom: 1rem;">🔬</div>
                    <p>Cargue un archivo para iniciar la auditoría o use la sección de abajo para comparación estricta.</p>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        // Auditoría normal
        const fileInput = this.container.querySelector('#linValidatorFileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileLoad(e));
        }

        const resetBtn = this.container.querySelector('#linResetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.reset());
        }

        // Comparación Estricta
        const inputA = this.container.querySelector('#strictFileA');
        const inputB = this.container.querySelector('#strictFileB');
        const btnStrict = this.container.querySelector('#btnRunStrictCompare');

        inputA?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                const { records } = await loadFile(file, true);
                this.strictRecordsA = records;
                const infoA = this.container.querySelector('#strictFileAInfo .filename');
                if (infoA) infoA.textContent = file.name;
                this.checkStrictReady();
            }
        });

        inputB?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                const { records } = await loadFile(file, true);
                this.strictRecordsB = records;
                const infoB = this.container.querySelector('#strictFileBInfo .filename');
                if (infoB) infoB.textContent = file.name;
                this.checkStrictReady();
            }
        });

        btnStrict?.addEventListener('click', () => this.performStrictComparison());

        const btnResetStrict = this.container.querySelector('#btnResetStrict');
        if (btnResetStrict) {
            btnResetStrict.addEventListener('click', () => this.resetStrict());
        }
    }

    checkStrictReady() {
        const btn = this.container.querySelector('#btnRunStrictCompare');
        if (this.strictRecordsA && this.strictRecordsB) {
            btn.style.display = 'inline-block';
        }
    }

    performStrictComparison() {
        const tbody = this.container.querySelector('#strictResultsTableBody');
        const panel = this.container.querySelector('#strictResultsPanel');
        if (!tbody || !panel) return;

        tbody.innerHTML = '';
        panel.style.display = 'block';

        // Indexar por nombre completo (el nombre normalizado ya incluye el NK si venía en el texto)
        const mapA = new Map();
        this.strictRecordsA.forEach(r => {
            const key = r.name.toUpperCase().trim();
            // Si hay duplicados del mismo nombre en el mismo archivo, tomamos el primero
            if (!mapA.has(key)) mapA.set(key, r);
        });

        const mapB = new Map();
        this.strictRecordsB.forEach(r => {
            const key = r.name.toUpperCase().trim();
            if (!mapB.has(key)) mapB.set(key, r);
        });

        const allKeys = Array.from(new Set([...mapA.keys(), ...mapB.keys()])).sort();
        let diffCount = 0;

        allKeys.forEach(key => {
            const recA = mapA.get(key);
            const recB = mapB.get(key);
            
            let diffs = [];
            let status = 'valid';
            let valA = recA ? `${recA.name} [NK: ${recA.nk || '-'}]` : '---';
            let valB = recB ? `${recB.name} [NK: ${recB.nk || '-'}]` : '---';

            if (recA && recB) {
                // 1. Comparar NK explícitamente
                const nkA = (recA.nk || '').trim().toUpperCase();
                const nkB = (recB.nk || '').trim().toUpperCase();
                if (nkA !== nkB) {
                    diffs.push(`NK Diferente: "${nkA || '-'}" vs "${nkB || '-'}"`);
                }

                // 2. Comparar CMYK (con precisión de 6 decimales para máxima rigurosidad)
                const cmykA = (recA.cmyk || []).map(v => Number(v).toFixed(6));
                const cmykB = (recB.cmyk || []).map(v => Number(v).toFixed(6));
                
                if (cmykA.join('/') !== cmykB.join('/')) {
                    diffs.push(`CMYK Diferente: [${cmykA.join(' / ')}] vs [${cmykB.join(' / ')}]`);
                }

                // 3. Comparar LAB (con precisión de 4 decimales)
                const labA = (recA.lab || []).map(v => Number(v).toFixed(4));
                const labB = (recB.lab || []).map(v => Number(v).toFixed(4));
                
                if (labA.join('/') !== labB.join('/')) {
                    diffs.push(`LAB Diferente: [${labA.join(' / ')}] vs [${labB.join(' / ')}]`);
                }

                if (diffs.length > 0) {
                    status = 'invalid';
                    diffCount++;
                }
            } else if (recA) {
                diffs.push('El color NO existe en el nuevo archivo');
                status = 'missing';
                diffCount++;
            } else {
                diffs.push('El color es NUEVO (no existe en la base)');
                status = 'additional';
                diffCount++;
            }

            this.addStrictRow(tbody, valA, valB, diffs, status);
        });

        if (diffCount === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #4ade80; padding: 3rem; font-size: 1.1rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">✅</div>
                <strong>¡ARCHIVOS IDÉNTICOS!</strong><br>
                <span style="font-weight: normal; opacity: 0.8;">No se encontró ninguna diferencia en nombres, NK, CMYK ni LAB.</span>
            </td></tr>`;
        }
    }

    addStrictRow(tbody, valA, valB, diffs, status) {
        const row = document.createElement('tr');
        
        let statusLabel = 'IDÉNTICO';
        let statusClass = 'valid';
        let rowStyle = '';

        if (status === 'invalid') {
            statusLabel = 'DIFERENTE';
            statusClass = 'invalid';
            rowStyle = 'background: rgba(244, 63, 94, 0.05);';
        } else if (status === 'missing') {
            statusLabel = 'FALTANTE';
            statusClass = 'invalid';
            rowStyle = 'background: rgba(251, 191, 36, 0.05);';
        } else if (status === 'additional') {
            statusLabel = 'ADICIONAL';
            statusClass = 'warning';
            rowStyle = 'background: rgba(0, 229, 255, 0.05);';
        }

        const diffHtml = diffs.length > 0 
            ? diffs.map(d => `<div style="margin-bottom: 4px; padding-left: 10px; border-left: 2px solid #f43f5e;"><i class="fas fa-exclamation-circle" style="font-size: 0.7rem;"></i> ${escapeHtml(d)}</div>`).join('')
            : '<div style="color: #4ade80;"><i class="fas fa-check"></i> Sin diferencias</div>';

        row.innerHTML = `
            <td style="${rowStyle} font-size: 0.8rem; font-weight: 500; vertical-align: top;">${escapeHtml(valA)}</td>
            <td style="${rowStyle} font-size: 0.8rem; font-weight: 500; vertical-align: top;">${escapeHtml(valB)}</td>
            <td style="${rowStyle} font-size: 0.75rem; color: ${status === 'valid' ? '#4ade80' : '#f43f5e'}; vertical-align: top;">${diffHtml}</td>
            <td style="${rowStyle} text-align: center; vertical-align: top;"><span class="status-badge ${statusClass}">${statusLabel}</span></td>
        `;
        tbody.appendChild(row);
    }

    resetStrict() {
        this.strictRecordsA = null;
        this.strictRecordsB = null;
        
        const inputA = this.container.querySelector('#strictFileA');
        const inputB = this.container.querySelector('#strictFileB');
        if (inputA) inputA.value = '';
        if (inputB) inputB.value = '';

        const infoA = this.container.querySelector('#strictFileAInfo .filename');
        const infoB = this.container.querySelector('#strictFileBInfo .filename');
        if (infoA) infoA.textContent = 'No cargado';
        if (infoB) infoB.textContent = 'No cargado';
        
        const btnRun = this.container.querySelector('#btnRunStrictCompare');
        if (btnRun) btnRun.style.display = 'none';

        const panel = this.container.querySelector('#strictResultsPanel');
        if (panel) panel.style.display = 'none';

        const tbody = this.container.querySelector('#strictResultsTableBody');
        if (tbody) tbody.innerHTML = '';
        
        console.log('🧹 Comparación estricta reiniciada.');
    }

    reset() {
        this.records = [];
        this.results = [];
        this.fileName = '';
        
        const fileInput = this.container.querySelector('#linValidatorFileInput');
        if (fileInput) fileInput.value = '';

        const resultsPanel = this.container.querySelector('#linResultsPanel');
        const emptyState = this.container.querySelector('#linEmptyState');
        const info = this.container.querySelector('#linValidatorFileInfo');

        if (resultsPanel) resultsPanel.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        if (info) {
            info.querySelector('.filename').textContent = 'Ningún archivo cargado';
            info.querySelector('.record-count').textContent = '';
        }
    }

    async handleFileLoad(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            // Refrescar datos de la base de datos antes de validar
            if (this.app.developmentView && this.app.developmentView.loadEquivalencyGroups) {
                console.log('📡 Refrescando tabla de equivalencias desde Supabase...');
                await this.app.developmentView.loadEquivalencyGroups();
            }

            const { records, fileName } = await loadFile(file, true); // Pasar true para mantener duplicados
            this.records = records;
            this.fileName = fileName;
            this.updateFileInfo(fileName, records.length);
            this.performValidation();
        } catch (error) {
            console.error('Error cargando archivo:', error);
            alert('Error al cargar el archivo: ' + error);
        }
    }

    updateFileInfo(name, count) {
        const info = this.container.querySelector('#linValidatorFileInfo');
        if (info) {
            info.querySelector('.filename').textContent = name;
            info.querySelector('.record-count').textContent = `${count} registros`;
        }
    }

    performValidation() {
        const results = this.records.map(record => ({
            ...record,
            errors: []
        }));

        // 0. Calcular NK predominante (sugerencia para corrección)
        const nkCounts = {};
        this.records.forEach(r => {
            if (r.nk) {
                const cleanNk = (r.nk || '').trim().toUpperCase();
                nkCounts[cleanNk] = (nkCounts[cleanNk] || 0) + 1;
            }
        });
        this.suggestedNk = Object.entries(nkCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

        // 1. Conteos para validación en dos pasos
        const nameCounts = {};       // Para detectar color repetido en distintas máquinas
        const compositeCounts = {};  // Para detectar duplicados exactos (Error real)
        
        this.records.forEach(r => {
            const bName = (r.baseName || '').toUpperCase().trim();
            const nk = (r.nk || '').toUpperCase().trim();
            const fullKey = `${bName}|${nk}`;
            
            nameCounts[bName] = (nameCounts[bName] || 0) + 1;
            compositeCounts[fullKey] = (compositeCounts[fullKey] || 0) + 1;
        });

        // 2. Paréntesis (ej: "(2)", "(VERSIÓN)", "(COPIA)")
        const parenRegex = /\([^)]*\)/;

        // 3. Consistencia de Complementarios
        const groupsInFile = {};
        const equivalenceMap = window.EQUIVALENCE_MAP || new Map();

        results.forEach(record => {
            const bName = (record.baseName || '').trim();
            const bNameUpper = bName.toUpperCase();
            const nkUpper = (record.nk || '').toUpperCase().trim();
            const fullName = (record.name || '').trim();

            // FLUJO DE DUPLICIDAD EN DOS PASOS:
            const compositeKey = `${bNameUpper}|${nkUpper}`;
            
            if (compositeCounts[compositeKey] > 1) {
                // NIVEL 1: Error Crítico (Rojo) - El mismo registro está dos veces
                record.errors.push({ type: 'duplicate', message: 'Registro duplicado (Nombre y NK idénticos)' });
            }

            // Error de paréntesis (Buscamos en el nombre completo por si se extrajo como NK)
            if (parenRegex.test(fullName)) {
                record.errors.push({ type: 'naming', message: 'Nomenclatura con paréntesis (...)' });
            }

            // Error de NK faltante
            if (!record.nk) {
                record.errors.push({ type: 'naming', message: 'Código NK faltante' });
            }

            // 3. Validación contra Base de Datos (Existencia y Cápsula usando baseName)
            const equivalencyRows = window.EQUIVALENCY_ROWS || [];
            let foundInDb = false;
            let exactCasingMatch = false;
            let officialName = '';

            for (const row of equivalencyRows) {
                for (let i = 1; i < row.length; i++) {
                    const dbName = row[i];
                    if (dbName.toUpperCase() === bNameUpper) {
                        foundInDb = true;
                        officialName = dbName;
                        if (dbName === bName) {
                            exactCasingMatch = true;
                        }
                        break;
                    }
                }
                if (foundInDb) break;
            }

            if (!foundInDb) {
                record.errors.push({ type: 'naming', message: 'Nombre NO registrado en base de datos' });
            }

            // Agrupar para consistencia (Agrupamos por Grupo + NK para permitir diferencias entre máquinas)
            const eqData = equivalenceMap.get(bNameUpper);
            if (eqData) {
                const groupKey = `${eqData.groupId}|${nkUpper}`;
                if (!groupsInFile[groupKey]) groupsInFile[groupKey] = [];
                groupsInFile[groupKey].push(record);
            }
        });

        // Validar consistencia dentro de cada grupo (Filtrado por mismo NK)
        for (const groupKey in groupsInFile) {
            const groupRecords = groupsInFile[groupKey];
            if (groupRecords.length > 1) {
                const first = groupRecords[0];
                const firstCmyk = (first.cmyk || []).map(v => Number(v).toFixed(2)).join('|');
                const firstLab = (first.lab || []).map(v => Number(v).toFixed(2)).join('|');

                for (let i = 1; i < groupRecords.length; i++) {
                    const current = groupRecords[i];
                    const currentCmyk = (current.cmyk || []).map(v => Number(v).toFixed(2)).join('|');
                    const currentLab = (current.lab || []).map(v => Number(v).toFixed(2)).join('|');

                    if (firstCmyk !== currentCmyk || firstLab !== currentLab) {
                        // Marcar todos los del grupo con error de consistencia (solo dentro de este NK)
                        groupRecords.forEach(r => {
                            if (!r.errors.some(e => e.type === 'consistency')) {
                                r.errors.push({ type: 'consistency', message: 'Inconsistencia de valores en el mismo NK' });
                            }
                        });
                        break;
                    }
                }
            }
        }

        this.results = results;
        window.linValidatorView = this;
        this.renderResults();
    }

    async correctRecord(index) {
        const record = this.results[index];
        const { validateAndCorrectRecords } = await import('../modules/nameValidator.js');
        
        // Abrir el modal de corrección interactiva (el mismo que en el comparador)
        const result = await validateAndCorrectRecords([record], 'linearization', (oldN, newN, reason) => {
            console.log(`Corregido en Linearización: ${oldN} -> ${newN}`);
        }, this.suggestedNk);

        if (result.corrected && result.records.length > 0) {
            // Actualizar el registro original y re-validar todo el archivo
            this.records[index] = result.records[0];
            this.performValidation();
        }
    }

    renderResults() {
        const resultsPanel = this.container.querySelector('#linResultsPanel');
        const emptyState = this.container.querySelector('#linEmptyState');
        const tableBody = this.container.querySelector('#linResultsTableBody');
        const statsBadges = this.container.querySelector('#linStatsBadges');

        if (!tableBody || !resultsPanel || !emptyState) return;

        emptyState.style.display = 'none';
        resultsPanel.style.display = 'block';

        let duplicateCount = 0;
        let namingCount = 0;
        let consistencyCount = 0;

        tableBody.innerHTML = this.results.map((record, index) => {
            let statusHtml = '<span style="color: #4ade80;"><i class="fas fa-check-circle"></i> Válido</span>';
            let rowClass = '';

            if (record.errors.length > 0) {
                rowClass = 'error-row';
                const errorMessages = record.errors.map(e => {
                    let icon = 'fa-exclamation-triangle';
                    let color = '#fbbf24';
                    
                    if (e.type === 'duplicate') { 
                        duplicateCount++;
                        color = '#f87171'; icon = 'fa-copy'; 
                    } else if (e.type === 'naming') {
                        namingCount++;
                        color = '#fbbf24'; icon = 'fa-font';
                    } else if (e.type === 'consistency') {
                        consistencyCount++;
                        color = '#a78bfa'; icon = 'fa-layer-group';
                    }
                    
                    return `<div style="color: ${color}; font-size: 0.75rem; margin-bottom: 2px;"><i class="fas ${icon}"></i> ${e.message}</div>`;
                }).join('');
                statusHtml = `<div class="error-container">${errorMessages}</div>`;
            }

            const cmykStr = (record.cmyk || []).map(v => Number(v).toFixed(1)).join(' / ');
            const labStr = (record.lab || []).map(v => Number(v).toFixed(1)).join(' / ');

            return `
                <tr class="${rowClass}">
                    <td>${index + 1}</td>
                    <td style="font-weight: 500;">${escapeHtml(record.baseName)}</td>
                    <td><span class="nk-badge">${escapeHtml(record.nk || '-')}</span></td>
                    <td style="font-family: monospace;">${cmykStr}</td>
                    <td style="font-family: monospace;">${labStr}</td>
                    <td>${statusHtml}</td>
                    <td>
                        ${record.errors.length > 0 ? `
                            <button onclick="window.linValidatorView.correctRecord(${index})" style="padding: 4px 8px; background: #ff007f; color: white; border: none; border-radius: 4px; cursor: pointer; transition: all 0.2s;" title="Corregir">
                                <i class="fas fa-magic"></i>
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');

        // Stats Badges
        statsBadges.innerHTML = `
            ${duplicateCount > 0 ? `<span class="badge" style="background: rgba(248, 113, 113, 0.2); color: #f87171; border: 1px solid #f87171; padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.7rem;">${duplicateCount} Duplicados</span>` : ''}
            ${namingCount > 0 ? `<span class="badge" style="background: rgba(251, 191, 36, 0.2); color: #fbbf24; border: 1px solid #fbbf24; padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.7rem;">${namingCount} Nomenclatura</span>` : ''}
            ${consistencyCount > 0 ? `<span class="badge" style="background: rgba(167, 139, 250, 0.2); color: #a78bfa; border: 1px solid #a78bfa; padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.7rem;">Inconsistencias</span>` : ''}
            ${(duplicateCount === 0 && namingCount === 0 && consistencyCount === 0) ? '<span class="badge" style="background: rgba(74, 222, 128, 0.2); color: #4ade80; border: 1px solid #4ade80; padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.7rem;">Archivo Limpio</span>' : ''}
        `;
    }
}
