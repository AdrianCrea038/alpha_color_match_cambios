/**
 * VISTA: Auditoría Directa de Archivo Único
 * Misión: Validar un solo archivo TXT contra los catálogos maestros de Supabase.
 * Independencia Total: No comparte lógica con la vista de cíclicos.
 */
export class DirectAuditView {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = null;
        this.records = [];
        this.activeFilter = null;
        window.directView = this;
    }

    init() {
        this.container = document.getElementById(this.containerId);
        if (!this.container) return;
        this.renderLayout();
        this.setupEvents();
    }

    renderLayout() {
        this.container.innerHTML = `
            <div class="premium-view-container">
                <div class="view-header">
                    <div class="header-main">
                        <h2 class="premium-title"><i class="fas fa-shield-check"></i> Auditoría Directa</h2>
                        <p class="subtitle">Validación de integridad de archivo único contra Supabase Master</p>
                    </div>
                </div>

                <div class="audit-upload-zone">
                    <div class="upload-card-simple">
                        <div class="upload-icon"><i class="fas fa-file-upload"></i></div>
                        <h3>Cargar Archivo para Auditoría</h3>
                        <p>Seleccione el archivo TXT para validar Nombres y NKs</p>
                        <input type="file" id="directAuditInput" accept=".txt" hidden>
                        <button class="premium-btn primary" onclick="document.getElementById('directAuditInput').click()">
                            <i class="fas fa-folder-open"></i> SELECCIONAR ARCHIVO
                        </button>
                    </div>
                </div>

                <div id="directResultsPanel" style="display: none; margin-top: 1rem;">
                    <div class="results-toolbar" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; background: rgba(30, 30, 45, 0.4); padding: 1rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                        <div id="directStatsBadges" class="stats-badges" style="display: flex; gap: 0.8rem; flex-wrap: wrap;"></div>
                        <button id="btnExportDirect" class="premium-btn success" disabled>
                            <i class="fas fa-file-export"></i> EXPORTAR VALIDADO
                        </button>
                    </div>
                    
                    <div class="premium-table-wrapper">
                        <table class="premium-data-table">
                            <thead>
                                <tr>
                                    <th style="width:50px">#</th>
                                    <th>Nombre del Color</th>
                                    <th class="text-center">NK</th>
                                    <th class="text-center">Valores CMYK</th>
                                    <th class="text-center">Estado</th>
                                    <th class="text-center" style="width:100px">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="directTableBody"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    setupEvents() {
        const fileInput = this.container.querySelector('#directAuditInput');
        if (fileInput) {
            fileInput.onchange = (e) => this.handleFileUpload(e);
        }

        const exportBtn = this.container.querySelector('#btnExportDirect');
        if (exportBtn) {
            exportBtn.onclick = () => this.handleExport();
        }
    }

    async handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        this.originalFileName = file.name;
        window.showLoading?.('Procesando Auditoría Directa...', 'Validando contra Base de Datos Maestra');
        try {
            const content = await file.text();
            // Usar el cargador global para parsear los datos
            const records = window.FileLoader.parseTxt(content);
            this.records = records;
            
            // FORZAR RECARGA SIEMPRE desde Supabase (garantiza colores recién agregados)
            const { ensureValidColorCatalogLoaded } = await import('../modules/nameValidator.js');
            await ensureValidColorCatalogLoaded(true);
            
            await this.performValidation();
            // El loading se quita al final del renderizado de resultados
        } catch (err) {
            console.error("Error cargando archivo:", err);
            window.showNotification?.('Error', 'No se pudo procesar el archivo.', 'error');
            window.hideLoading?.();
        }
    }

    _getModaCmyk(group) {
        if (!group || group.length === 0) return null;
        const counts = {};
        group.forEach(x => {
            const key = (x.cmyk || [0,0,0,0]).map(v => Number(v).toFixed(4)).join('|');
            counts[key] = (counts[key] || 0) + 1;
        });
        const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
        const maxFreq = sorted[0][1];
        // En caso de empate absoluto, devolvemos null para marcar a todos como dudosos
        if (sorted.length > 1 && sorted[1][1] === maxFreq) return null;
        return sorted[0][0];
    }

    async performValidation() {
        console.log(`🔍 Iniciando validación total sobre ${this.records.length} registros...`);
        // Normalización agresiva de NK
        const normalizeNK = (v) => String(v || '').replace(/^NK/i, '').replace(/[^A-Z0-9]/gi, '').toUpperCase();

        // 1. PRIMERA PASADA: Identificar propiedades básicas de cada registro
        for (const r of this.records) {
            const cleanNk = (r.nk || '').trim().toUpperCase();
            const baseName = (r.baseName || '').trim().toUpperCase();
            const fullName = (r.name || '').trim().toUpperCase();

            // REGLA: Ignorar todo lo que contenga "WHITE"
            if (fullName.includes('WHITE') || baseName.includes('WHITE')) {
                r.isValidName = true;
                r.isMissingInCatalog = false;
                r.isValidNk = true;
                r.hasNumberedParentheses = false;
                r.isDuplicate = false;
                r.hasError = false;
                continue;
            }

            // EXCEPCIÓN TONAL: Los colores TN, TNL o Tonal no requieren NK
            const isTonal = baseName.startsWith('TONAL') || baseName.startsWith('TNL') || baseName.startsWith('TN');
            r.isTonal = isTonal;
            
            // VALIDACIÓN UNIFICADA: 
            const existsInCatalog = (window.isValidColorName?.(fullName) || window.isValidColorName?.(baseName));
            
            // Un nombre está "Mal Escrito" si tiene ruido técnico excesivo 
            // Permitimos letras, números, espacios, puntos, guiones y slashes (comunes en colores)
            const hasNoise = /[^A-Z0-9\s\.\-\/]/.test(baseName); 
            
            r.isValidName = existsInCatalog || isTonal;
            r.isMissingInCatalog = !r.isValidName && !hasNoise;
            r.isMisspelled = !r.isValidName && hasNoise;

            r.hasParentheses = /\(|\)/.test(r.name);
            r.hasNumberedParentheses = /\(\d+\)/.test(r.name);
            r.isValidNk = isTonal ? true : (cleanNk ? (window.isValidNK?.(cleanNk) === true) : false);
            r.isMissingNk = isTonal ? false : !cleanNk;
            r.isCorrupted = (r.cmyk || []).some(v => v > 100.000001 || v < -0.000001 || isNaN(v));
        }

        // 2. SEGUNDA PASADA: Validación cruzada de duplicados e inconsistencias de CMYK
        const colorGroups = new Map();
        this.records.forEach(r => {
            const cleanNk = (r.nk || '').trim().toUpperCase();
            const fullName = (r.baseName || r.name).trim().toUpperCase();
            const colorNameOnly = fullName.replace(/^[0-9][0-9][A-Z]\s+/, '').replace(/^TM\s+/, '').trim();
            
            const groupKey = `${colorNameOnly}|${cleanNk}`;
            if (!colorGroups.has(groupKey)) colorGroups.set(groupKey, []);
            colorGroups.get(groupKey).push(r);
        });

        for (const r of this.records) {
            const cleanNk = (r.nk || '').trim().toUpperCase();
            const baseNameForDup = (r.baseName || '').trim().toUpperCase();
            
            r.isDuplicate = this.records.filter(x =>
                (x.baseName || '').trim().toUpperCase() === baseNameForDup &&
                (x.nk || '').trim().toUpperCase() === cleanNk &&
                baseNameForDup !== '' 
            ).length > 1;

            r.isCmykInconsistent = false;
            const fullName = (r.baseName || r.name).trim().toUpperCase();
            const colorNameOnly = fullName.replace(/^[0-9][0-9][A-Z]\s+/, '').replace(/^TM\s+/, '').trim();
            const groupKey = `${colorNameOnly}|${cleanNk}`;
            const group = colorGroups.get(groupKey);
            if (group && group.length > 1) {
                const modaKey = this._getModaCmyk(group);
                const currentKey = (r.cmyk || [0,0,0,0]).map(v => Number(v).toFixed(4)).join('|');
                r.isCmykInconsistent = (modaKey === null) ? true : (currentKey !== modaKey);
            }

            const parenMatch = (r.name || '').match(/\([^)]*\)/);
            r.hasNumberedParentheses = !!parenMatch;
            r.parenthesisEvidence = parenMatch ? parenMatch[0] : '';
            r.cleanNameForDisplay = (r.name || '').replace(/\([^)]*\)/g, '').trim();

            // 3. ESTADO GLOBAL DE ERROR (Solo errores ROJOS bloquean la exportación)
            // Falta en Catálogo (Blue) NO bloquea si el usuario decide exportar, o tal vez sí según la regla
            const baseError = r.isMisspelled || !r.isValidNk || r.isMissingNk || r.isDuplicate || r.isCorrupted || r.hasNumberedParentheses || r.isCmykInconsistent;
            
            r.hasError = (baseError || r.isMissingInCatalog) && !r.isManuallyApproved;
        }

        this.renderResults();
    }

    renderResults() {
        const panel = this.container.querySelector('#directResultsPanel');
        const body = this.container.querySelector('#directTableBody');
        const badges = this.container.querySelector('#directStatsBadges');
        const exportBtn = this.container.querySelector('#btnExportDirect');
        
        panel.style.display = 'block';
        body.innerHTML = '';

        // Filtrado
        // Ordenar: Agrupar por NK para que los equivalentes queden juntos
        this.records.sort((a, b) => {
            const nkA = (a.nk || 'ZZZ').toUpperCase();
            const nkB = (b.nk || 'ZZZ').toUpperCase();
            if (nkA !== nkB) return nkA.localeCompare(nkB);
            return (a.cleanNameForDisplay || '').localeCompare(b.cleanNameForDisplay || '');
        });

        let displayRecords = this.activeFilter ? this.records.filter(r => {
            if (this.activeFilter === 'err_name') return r.isMisspelled; 
            if (this.activeFilter === 'missing_cat') return r.isMissingInCatalog;
            if (this.activeFilter === 'err_nk') return !r.isValidNk && !r.isMissingNk;
            if (this.activeFilter === 'err_cmyk') return r.isCorrupted;
            if (this.activeFilter === 'missing_nk') return r.isMissingNk;
            if (this.activeFilter === 'dup') return r.isDuplicate;
            if (this.activeFilter === 'inc') return r.isCmykInconsistent;
            if (this.activeFilter === 'parentheses') return r.hasNumberedParentheses;
            return true;
        }) : this.records;

        // AGRUPAR DUPLICADOS: Si el filtro de duplicados está activo, ordenar por nombre para que salgan juntos
        if (this.activeFilter === 'dup') {
            displayRecords = [...displayRecords].sort((a, b) => {
                const nameA = (a.baseName || a.name).toUpperCase();
                const nameB = (b.baseName || b.name).toUpperCase();
                return nameA.localeCompare(nameB);
            });
        }

        // AGRUPAR INCONSISTENTES: Si el filtro de inconsistencias está activo, ordenar por NK
        if (this.activeFilter === 'inc') {
            displayRecords = [...displayRecords].sort((a, b) => {
                const nkA = (a.nk || '').toUpperCase();
                const nkB = (b.nk || '').toUpperCase();
                return nkA.localeCompare(nkB);
            });
        }

        // Estadísticas
        const counts = {
            nk: this.records.filter(r => !r.isValidNk && !r.isMissingNk).length,
            misspelled: this.records.filter(r => r.isMisspelled).length, 
            missing: this.records.filter(r => r.isMissingInCatalog).length,
            missingNk: this.records.filter(r => r.isMissingNk).length,
            dup: this.records.filter(r => r.isDuplicate).length,
            cmyk: this.records.filter(r => r.isCorrupted).length,
            inc: this.records.filter(r => r.isCmykInconsistent).length,
            parentheses: this.records.filter(r => r.hasNumberedParentheses).length
        };

        badges.innerHTML = `
            <div class="stat-badge-mini ${!this.activeFilter ? 'active' : ''}" onclick="window.directView.setFilter(null)">
                <i class="fas fa-eye"></i> Todos (${this.records.length})
            </div>
            ${counts.misspelled > 0 ? `<div class="stat-badge-mini red has-count ${this.activeFilter === 'err_name' ? 'active' : ''}" onclick="window.directView.setFilter('err_name')"><i class="fas fa-exclamation-circle"></i> Mal Escrito (${counts.misspelled})</div>` : ''}
            ${counts.missing > 0 ? `<div class="stat-badge-mini blue has-count ${this.activeFilter === 'missing_cat' ? 'active' : ''}" onclick="window.directView.setFilter('missing_cat')"><i class="fas fa-search"></i> Falta en Catálogo (${counts.missing})</div>` : ''}
            ${counts.nk > 0 ? `<div class="stat-badge-mini red has-count ${this.activeFilter === 'err_nk' ? 'active' : ''}" onclick="window.directView.setFilter('err_nk')"><i class="fas fa-times-circle"></i> NK No Disponible (${counts.nk})</div>` : ''}
            ${counts.inc > 0 ? `<div class="stat-badge-mini orange has-count ${this.activeFilter === 'inc' ? 'active' : ''}" onclick="window.directView.setFilter('inc')"><i class="fas fa-layer-group"></i> CMYK Diferente (${counts.inc})</div>` : ''}
            ${counts.cmyk > 0 ? `<div class="stat-badge-mini red has-count ${this.activeFilter === 'err_cmyk' ? 'active' : ''}" onclick="window.directView.setFilter('err_cmyk')"><i class="fas fa-flask"></i> CMYK > 100 (${counts.cmyk})</div>` : ''}
            ${counts.missingNk > 0 ? `<div class="stat-badge-mini blue has-count ${this.activeFilter === 'missing_nk' ? 'active' : ''}" onclick="window.directView.setFilter('missing_nk')"><i class="fas fa-info-circle"></i> Sin NK (${counts.missingNk})</div>` : ''}
            ${counts.dup > 0 ? `<div class="stat-badge-mini red has-count ${this.activeFilter === 'dup' ? 'active' : ''}" onclick="window.directView.setFilter('dup')"><i class="fas fa-copy"></i> Duplicados (${counts.dup})</div>` : ''}
            ${counts.parentheses > 0 ? `<div class="stat-badge-mini red has-count ${this.activeFilter === 'parentheses' ? 'active' : ''}" onclick="window.directView.setFilter('parentheses')"><i class="fas fa-exclamation-circle"></i> CORREGIR PARÉNTESIS (${counts.parentheses})</div>` : ''}
            ${Object.values(counts).every(c => c === 0) && this.records.length > 0 ? '<div class="stat-badge-mini" style="background: rgba(16, 185, 129, 0.2); border: 2px solid #10b981; color: #10b981; box-shadow: 0 0 15px rgba(16, 185, 129, 0.4);"><i class="fas fa-check-circle"></i> TODO CORRECTO</div>' : ''}
        `;

        displayRecords.forEach((r, idx) => {
            const tr = document.createElement('tr');
            let statusHtml = '<div class="status-badge valid">Válido</div>';
            let rowClass = 'row-success';

            if (r.isManuallyApproved) {
                statusHtml = '<div class="status-badge valid" style="background: #059669; color: white;"><i class="fas fa-check-double"></i> Aprobado</div>';
                rowClass = 'row-success';
            } else if (r.isCorrupted) {
                statusHtml = '<div class="status-badge red">CMYK > 100</div>';
                rowClass = 'row-error-red';
            } else if (r.isMisspelled) {
                statusHtml = '<div class="status-badge red">Mal Escrito</div>';
                rowClass = 'row-error-red';
            } else if (r.isMissingInCatalog) {
                statusHtml = '<div class="status-badge blue">Falta en Catálogo</div>';
                rowClass = 'row-error-blue';
            } else if (!r.isValidNk && !r.isMissingNk) {
                statusHtml = '<div class="status-badge red">NK No Disponible</div>';
                rowClass = 'row-error-red';
            } else if (r.isDuplicate) {
                statusHtml = '<div class="status-badge red">Duplicado</div>';
                rowClass = 'row-error-red';
            } else if (r.hasNumberedParentheses) {
                statusHtml = '<div class="status-badge red"><i class="fas fa-ban"></i> Error: Paréntesis</div>';
                rowClass = 'row-error-red';
            } else if (r.isCmykInconsistent) {
                statusHtml = '<div class="status-badge orange">CMYK Dif.</div>';
                rowClass = 'row-error-orange';
            } else if (!r.isValidName) {
                statusHtml = '<div class="status-badge red"><i class="fas fa-exclamation-circle"></i> Mal Escrito</div>';
                rowClass = 'row-error-red';
            } else if (r.isMissingNk) {
                statusHtml = '<div class="status-badge blue">Sin NK</div>';
                rowClass = 'row-error-blue';
            }

            tr.className = rowClass;
            
            // Siempre mostramos solo el nombre base (limpio de NK y de paréntesis si ya se procesó)
            const displayName = r.cleanNameForDisplay || r.baseName || r.name;
            const displayNk = r.nk + (r.parenthesisEvidence ? ` <span style="color: #ef4444; font-weight: bold;">${r.parenthesisEvidence}</span>` : '');

            tr.innerHTML = `
                <td>${idx + 1}</td>
                <td style="font-weight: 700; color: ${!r.isValidName ? '#ef4444' : 'inherit'};">${displayName}</td>
                <td class="text-center" style="font-family: monospace;">${displayNk || '---'}</td>
                <td class="text-center" style="font-family: monospace; font-size: 0.8rem;">
                    ${(() => {
                        const cmyk = r.cmyk || [0,0,0,0];
                        // Si hay inconsistencia, intentar resaltar contra la moda del grupo
                        const groupKey = `${(r.baseName || r.name).trim().toUpperCase().replace(/^[0-9][0-9][A-Z]\s+/, '').replace(/^TM\s+/, '').trim()}|${(r.nk || '').trim().toUpperCase()}`;
                        const group = this.records.filter(x => `${(x.baseName || x.name).trim().toUpperCase().replace(/^[0-9][0-9][A-Z]\s+/, '').replace(/^TM\s+/, '').trim()}|${(x.nk || '').trim().toUpperCase()}` === groupKey);
                        
                        let moda = null;
                        if (group.length > 1) {
                            const counts = {};
                            group.forEach(g => {
                                const k = g.cmyk.map(v => Number(v).toFixed(4)).join('|');
                                counts[k] = (counts[k] || 0) + 1;
                            });
                            const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
                            if (sorted.length > 1 || sorted[0][1] < group.length) {
                                moda = sorted[0][0].split('|').map(v => parseFloat(v));
                            }
                        }

                        return cmyk.map((v, i) => {
                            const val = Number(v);
                            const isDiff = moda && Math.abs(val - moda[i]) > 0.0001;
                            const isBad = val > 100.000001 || val < -0.000001;
                            
                            if (isDiff || isBad) {
                                return `<span style="background: #ef4444; color: white; padding: 1px 4px; border-radius: 4px; font-weight: 900; box-shadow: 0 0 5px rgba(239, 68, 68, 0.5);">${val.toFixed(6)}</span>`;
                            }
                            return val.toFixed(6);
                        }).join(' <span style="opacity: 0.3;">/</span> ');
                    })()}
                </td>
                <td class="text-center">${statusHtml}</td>
                <td class="actions">
                    ${r.hasNumberedParentheses ? `<button class="btn-icon" onclick="window.directView.moveParenthesisToNk('${r._uid}')" title="Limpiar Nombre y Mover Paréntesis a NK" style="background: rgba(239, 68, 68, 0.1); border-radius: 4px; padding: 2px 6px;"><i class="fas fa-exchange-alt" style="color: #ef4444;"></i></button>` : ''}
                    ${(r.hasError && !r.hasNumberedParentheses) ? `<button class="btn-icon approve-btn" onclick="window.directView.approveRecord('${r._uid}')" title="Aprobar Manualmente"><i class="fas fa-check-circle" style="color: #10b981;"></i></button>` : ''}
                    <button class="btn-icon" onclick="window.directView.editRecord('${r._uid}')" title="Editar"><i class="fas fa-pencil-alt" style="color: #3b82f6;"></i></button>
                    <button class="btn-icon" onclick="window.directView.deleteRecord('${r._uid}')" title="Eliminar"><i class="fas fa-trash" style="color: #ef4444;"></i></button>
                </td>
            `;
            body.appendChild(tr);
        });

        const errorCount = this.records.filter(r => r.hasError).length;
        if (exportBtn) {
            exportBtn.disabled = errorCount > 0;
            exportBtn.innerHTML = errorCount > 0 
                ? `<i class="fas fa-lock"></i> BLOQUEADO (${errorCount} ERR)` 
                : `<i class="fas fa-file-export"></i> EXPORTAR VALIDADO`;
        }

        // Finalizar procesamiento y ocultar loading
        setTimeout(() => window.hideLoading?.(), 500);
    }

    setFilter(filter) {
        this.activeFilter = filter;
        this.renderResults();
    }

    applyCmykSuggestion(modaKey) {
        if (!modaKey) return;
        const vals = modaKey.split('|');
        const c = vals[0], m = vals[1], y = vals[2], k = vals[3];
        document.getElementById('editC').value = c;
        document.getElementById('editM').value = m;
        document.getElementById('editY').value = y;
        document.getElementById('editK').value = k;
        
        // Actualizar preview sugerido
        const suggBox = document.getElementById('colorPreviewSugg');
        if (suggBox) {
            suggBox.style.background = `cmyk(${c}%, ${m}%, ${y}%, ${k}%)`;
            suggBox.style.borderColor = 'white';
        }

        // Trigger preview update
        const event = new Event('input', { bubbles: true });
        document.getElementById('editC').dispatchEvent(event);
    }

    moveParenthesisToNk(uid) {
        const record = this.records.find(r => r._uid === uid);
        if (record && record.parenthesisEvidence) {
            // 1. Mover evidencia al campo NK de forma permanente
            record.nk = record.nk + ' ' + record.parenthesisEvidence;
            // 2. Limpiar el nombre original (quitar paréntesis)
            record.name = record.name.replace(/\([^)]*\)/g, '').trim();
            // 3. Limpiar banderas
            record.parenthesisEvidence = '';
            record.hasNumberedParentheses = false;
            // 4. Marcar como aprobado para que ya no cuente como error
            record.isManuallyApproved = true;
            
            this.performValidation();
            window.showNotification('Parentésis Movido', 'Se ha limpiado el nombre y movido la marca al NK.', 'success');
        }
    }

    async approveRecord(uid) {
        const record = this.records.find(r => r._uid === uid);
        if (record) {
            record.isManuallyApproved = true;
            // Re-validamos globalmente para actualizar el botón de exportación
            this.performValidation();
            window.showNotification('Registro Aprobado', 'El color se ha marcado como válido para exportar.', 'success');
        }
    }

    editRecord(uid) {
        const record = this.records.find(r => r._uid === uid);
        if (!record) return;

        let fullName = (record.baseName || record.name).trim();
        let match = fullName.match(/^(.*?)\s*(NK\d+|T\d+)$/i);
        let baseNameOnly = match ? match[1].trim() : fullName;
        let currentNK = match ? match[2].trim() : (record.nk || '');
        const cleanNk = currentNK.toUpperCase();
        const colorNameOnly = baseNameOnly.replace(/^[0-9][0-9][A-Z]\s+/, '').replace(/^TM\s+/, '').trim().toUpperCase();

        // 1. Detección de Errores para pintar inputs de rojo
        let errName = !record.isValidName || record.hasParentheses;
        let errNK = !record.isValidNk || record.isMissingNk;
        let errC = false, errM = false, errY = false, errK = false;

        const groupKey = `${colorNameOnly}|${cleanNk}`;
        const group = this.records.filter(x => {
            const xName = (x.baseName || x.name).trim().toUpperCase().replace(/^[0-9][0-9][A-Z]\s+/, '').replace(/^TM\s+/, '').trim();
            const xNk = (x.nk || '').trim().toUpperCase();
            return xName === colorNameOnly && xNk === cleanNk;
        });

        const modaKey = this._getModaCmyk(group);
        if (modaKey) {
            const modaValues = modaKey.split('|');
            const currentKey = (record.cmyk || [0,0,0,0]).map(v => Number(v).toFixed(4)).join('|');
            if (currentKey !== modaKey) {
                errC = Number(modaValues[0]).toFixed(4) !== Number(record.cmyk[0]).toFixed(4);
                errM = Number(modaValues[1]).toFixed(4) !== Number(record.cmyk[1]).toFixed(4);
                errY = Number(modaValues[2]).toFixed(4) !== Number(record.cmyk[2]).toFixed(4);
                errK = Number(modaValues[3]).toFixed(4) !== Number(record.cmyk[3]).toFixed(4);
            }
        }

        if (record.isCorrupted) {
            if (record.cmyk[0] > 100 || record.cmyk[0] < 0 || isNaN(record.cmyk[0])) errC = true;
            if (record.cmyk[1] > 100 || record.cmyk[1] < 0 || isNaN(record.cmyk[1])) errM = true;
            if (record.cmyk[2] > 100 || record.cmyk[2] < 0 || isNaN(record.cmyk[2])) errY = true;
            if (record.cmyk[3] > 100 || record.cmyk[3] < 0 || isNaN(record.cmyk[3])) errK = true;
        }

        // 2. Sugerencias de NK
        let suggestedNK = null;
        if (window.EQUIVALENCE_MAP) {
            const searchKey = baseNameOnly.toUpperCase().replace(/[^A-Z0-9]/gi, '');
            const equiv = window.EQUIVALENCE_MAP.get(searchKey);
            if (equiv && equiv.groupId) {
                suggestedNK = equiv.groupId;
            }
        }

        let nkSuggestionHtml = '';
        if (suggestedNK && cleanNk !== suggestedNK.toUpperCase()) {
            nkSuggestionHtml = `
            <div style="margin-top:8px; padding-top:8px; border-top:1px dashed #334155; display:flex; justify-content:space-between; align-items:center;">
                <span style="color:#fbbf24; font-size:0.75rem; font-weight:bold;"><i class="fas fa-lightbulb"></i> Base de Datos sugiere NK:</span>
                <span style="background:#fbbf24; color:#000; padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:bold; cursor:pointer;" onclick="document.getElementById('editNK').value='${suggestedNK}'; document.getElementById('editNK').style.color='white'; document.getElementById('editNK').style.borderColor='#475569';">${suggestedNK} (Click para usar)</span>
            </div>`;
        }

        // 3. Colores Equivalentes
        let suggestionsHtml = `
            <div style="margin-top: 15px; padding: 12px; background: rgba(59, 130, 246, 0.05); border-left: 3px solid #3b82f6; border-radius: 4px;">
                <span style="display:block; color: #60a5fa; font-size: 0.75rem; font-weight: bold; margin-bottom: 8px;"><i class="fas fa-link"></i> COLORES EQUIVALENTES EN MASTER:</span>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span style="color:#94a3b8; font-size:0.75rem; font-style:italic;">La Base de Datos Maestra no tiene otros nombres registrados para esta familia.</span>
                </div>
            </div>`;
        
        if (window.EQUIVALENCE_MAP) {
            const searchKey = baseNameOnly.toUpperCase().replace(/[^A-Z0-9]/gi, '');
            const equiv = window.EQUIVALENCE_MAP.get(searchKey);
            
            if (equiv && equiv.names && equiv.names.length > 1) {
                const others = equiv.names.filter(n => n.toUpperCase().replace(/[^A-Z0-9]/gi, '') !== searchKey);
                if (others.length > 0) {
                    const tagsHtml = others.map(o => {
                        return `<div style="background: #1e293b; color: #cbd5e1; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; border: 1px solid #334155; margin-bottom:4px; display:inline-block;">
                                    <strong>${o}</strong>
                                </div>`;
                    }).join(' ');

                    suggestionsHtml = `
                        <div style="margin-top: 15px; padding: 12px; background: rgba(59, 130, 246, 0.05); border-left: 3px solid #3b82f6; border-radius: 4px;">
                            <span style="display:block; color: #60a5fa; font-size: 0.75rem; font-weight: bold; margin-bottom: 8px;"><i class="fas fa-link"></i> COLORES EQUIVALENTES EN MASTER:</span>
                            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                                ${tagsHtml}
                            </div>
                        </div>
                    `;
                }
            }
        }

        // Botón de usar CMYK por moda
        let cmykSuggestionHtml = '';
        if (modaKey && modaKey !== (record.cmyk || []).map(v => Number(v).toFixed(4)).join('|')) {
            const modaValues = modaKey.split('|');
            cmykSuggestionHtml = `
                <div style="margin-top: 10px; display:flex; justify-content:space-between; align-items:center; background: rgba(249, 115, 22, 0.1); padding:8px; border-radius:6px; border:1px solid #f97316;">
                    <span style="color:#f97316; font-size:0.75rem; font-weight:bold;"><i class="fas fa-magic"></i> El resto del grupo usa: ${modaValues.join(' / ')}</span>
                    <button type="button" onclick="document.getElementById('editC').value='${modaValues[0]}'; document.getElementById('editM').value='${modaValues[1]}'; document.getElementById('editY').value='${modaValues[2]}'; document.getElementById('editK').value='${modaValues[3]}';" style="cursor:pointer; background:#f97316; color:white; border:none; padding:4px 8px; border-radius:4px; font-size:0.7rem; font-weight:bold;">Aplicar Moda</button>
                </div>
            `;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.zIndex = '9999';

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px; background: #0f172a; border: 2px solid #3b82f6; border-radius:12px; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
                <div class="modal-header" style="border-bottom: 1px solid #334155; padding: 1.2rem; background: rgba(30, 41, 59, 0.5);">
                    <h3 style="color: white; margin: 0; font-size:1.2rem;"><i class="fas fa-edit" style="color: #3b82f6; margin-right:10px;"></i> Edición de Color: ${baseNameOnly}</h3>
                </div>
                <div class="modal-body" style="padding: 1.5rem;">
                    
                    <div style="display:grid; grid-template-columns: 2fr 1fr; gap:20px; margin-bottom:20px;">
                        <div>
                            <label style="color:#94a3b8; font-size:0.85rem; font-weight:bold; display:block; margin-bottom:8px;">Nombre del Color</label>
                            <input type="text" id="editName" list="colorNameSuggestions" value="${baseNameOnly}" style="width:100%; padding:12px; background:#1e293b; border:1px solid ${errName ? '#ef4444' : '#475569'}; color:${errName ? '#ef4444' : 'white'}; border-radius:8px; outline:none; font-size:1rem;">
                            <datalist id="colorNameSuggestions">
                                ${(window.ALL_VALID_COLOR_NAMES || []).map(name => `<option value="${name}">`).join('')}
                            </datalist>
                        </div>
                        <div>
                            <label style="color:#94a3b8; font-size:0.85rem; font-weight:bold; display:block; margin-bottom:8px;">Código NK</label>
                            <input type="text" id="editNK" value="${currentNK}" placeholder="NK000000" style="width:100%; padding:12px; background:#1e293b; border:1px solid ${errNK ? '#ef4444' : '#475569'}; color:${errNK ? '#ef4444' : 'white'}; border-radius:8px; outline:none; font-family:monospace; text-transform:uppercase; font-size:1rem;">
                            <div id="nk_db_val" style="font-size:0.7rem; color:#ef4444; margin-top:5px; ${errNK && suggestedNK ? '' : 'display:none;'}">Original: ${suggestedNK || ''}</div>
                        </div>
                    </div>

                    <div id="nkSuggestionContainer"></div>
                    
                    <div style="height: 1px; background: #334155; margin: 20px 0;"></div>

                    <label style="color:#94a3b8; font-size:0.85rem; font-weight:bold; display:block; margin-bottom:12px;">Valores CMYK</label>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom:20px;">
                        <div style="position:relative;">
                            <span style="position:absolute; left:10px; top:12px; color:#64748b; font-size:0.7rem; font-weight:bold;">C</span>
                            <input type="number" id="editC" value="${Number(record.cmyk[0]).toFixed(6)}" step="0.000001" style="width:100%; padding:12px 10px 12px 25px; background:#1e293b; border:1px solid ${errC ? '#ef4444' : '#475569'}; color:${errC ? '#ef4444' : 'white'}; border-radius:8px; font-family:monospace; font-size:0.85rem;">
                        </div>
                        <div style="position:relative;">
                            <span style="position:absolute; left:10px; top:12px; color:#64748b; font-size:0.7rem; font-weight:bold;">M</span>
                            <input type="number" id="editM" value="${Number(record.cmyk[1]).toFixed(6)}" step="0.000001" style="width:100%; padding:12px 10px 12px 25px; background:#1e293b; border:1px solid ${errM ? '#ef4444' : '#475569'}; color:${errM ? '#ef4444' : 'white'}; border-radius:8px; font-family:monospace; font-size:0.85rem;">
                        </div>
                        <div style="position:relative;">
                            <span style="position:absolute; left:10px; top:12px; color:#64748b; font-size:0.7rem; font-weight:bold;">Y</span>
                            <input type="number" id="editY" value="${Number(record.cmyk[2]).toFixed(6)}" step="0.000001" style="width:100%; padding:12px 10px 12px 25px; background:#1e293b; border:1px solid ${errY ? '#ef4444' : '#475569'}; color:${errY ? '#ef4444' : 'white'}; border-radius:8px; font-family:monospace; font-size:0.85rem;">
                        </div>
                        <div style="position:relative;">
                            <span style="position:absolute; left:10px; top:12px; color:#64748b; font-size:0.7rem; font-weight:bold;">K</span>
                            <input type="number" id="editK" value="${Number(record.cmyk[3]).toFixed(6)}" step="0.000001" style="width:100%; padding:12px 10px 12px 25px; background:#1e293b; border:1px solid ${errK ? '#ef4444' : '#475569'}; color:${errK ? '#ef4444' : 'white'}; border-radius:8px; font-family:monospace; font-size:0.85rem;">
                        </div>
                    </div>
                    
                    <div id="equivalentColorsContainer"></div>
                </div>
                <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:15px; padding:1.5rem; border-top:1px solid #334155; background: rgba(15, 23, 42, 0.8); border-radius: 0 0 12px 12px;">
                    <button class="premium-btn secondary" id="btnCancelEdit" style="background: transparent; border: 1px solid #475569; color: #94a3b8; padding: 12px 25px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: all 0.3s;">CANCELAR</button>
                    <button class="premium-btn primary" id="btnSaveEdit" style="background: #3b82f6; color: white; border: none; padding: 12px 35px; border-radius: 8px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3); transition: all 0.3s;">GUARDAR CAMBIOS</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const nameInput = modal.querySelector('#editName');
        const nkInput = modal.querySelector('#editNK');
        const nkContainer = modal.querySelector('#nkSuggestionContainer');
        const eqContainer = modal.querySelector('#equivalentColorsContainer');

        const updateLiveSuggestions = () => {
            const currentName = nameInput.value.trim().toUpperCase();
            const currentNK = nkInput.value.trim().toUpperCase();
            const baseNameOnly = currentName.replace(/\s*(NK\d+|T\d+)$/i, '').trim();
            let searchKey = baseNameOnly.toUpperCase().replace(/[^A-Z0-9]/gi, '');

            // 1. Recalcular NK Sugerido e Equivalentes
            let suggestedNK = null;
            let equiv = null;
            if (window.EQUIVALENCE_MAP) {
                equiv = window.EQUIVALENCE_MAP.get(searchKey);
                
                // Si no hay match directo, intentar quitar prefijos comunes (ej: "4EY ", "79Q ")
                if (!equiv) {
                    const cleanName = baseNameOnly.replace(/^[A-Z0-9]+\s+/i, '').trim();
                    const cleanKey = cleanName.toUpperCase().replace(/[^A-Z0-9]/gi, '');
                    if (cleanKey !== searchKey) {
                        equiv = window.EQUIVALENCE_MAP.get(cleanKey);
                        if (equiv) searchKey = cleanKey;
                    }
                }

                // BUSCAR EL NK REAL EN EL MAPA DE GRUPOS (No el GroupId)
                if (equiv && equiv.groupId) {
                    const groupId = equiv.groupId;
                    // Intentar encontrar el NK oficial para este grupo en NK_TO_GROUP_MAP
                    if (window.NK_TO_GROUP_MAP) {
                        for (let [nk, group] of window.NK_TO_GROUP_MAP.entries()) {
                            if (group === groupId) {
                                suggestedNK = nk.startsWith('NK') ? nk : `NK${nk}`;
                                break;
                            }
                        }
                    }
                }
            }

            const dbValDiv = modal.querySelector('#nk_db_val');
            if (suggestedNK && currentNK !== suggestedNK.toUpperCase()) {
                dbValDiv.style.display = 'block';
                dbValDiv.innerText = `Original en DB: ${suggestedNK}`;
                
                nkContainer.innerHTML = `
                    <div style="margin-top:10px; padding:12px; background:rgba(251, 191, 36, 0.1); border-radius:8px; border:1px solid rgba(251, 191, 36, 0.3); display:flex; justify-content:space-between; align-items:center;">
                        <span style="color:#fbbf24; font-size:0.8rem; font-weight:bold;"><i class="fas fa-lightbulb"></i> Base de Datos sugiere NK:</span>
                        <span class="apply-nk-btn" style="background:#fbbf24; color:#000; padding:4px 10px; border-radius:6px; font-size:0.8rem; font-weight:bold; cursor:pointer; transition: transform 0.2s;">${suggestedNK} (Click para usar)</span>
                    </div>`;
                nkContainer.querySelector('.apply-nk-btn').onclick = () => {
                    nkInput.value = suggestedNK;
                    nkInput.style.color = 'white';
                    nkInput.style.borderColor = '#475569';
                    updateLiveSuggestions();
                };
            } else {
                nkContainer.innerHTML = '';
            }

            // 2. Recalcular Equivalentes (Regla 143/144: Usar normalización agresiva)
            let eqHtml = '';
            if (window.EQUIVALENCE_MAP) {
                const equiv = window.EQUIVALENCE_MAP.get(searchKey);
                    if (equiv && equiv.names && equiv.names.length > 1) {
                        const others = equiv.names.filter(n => n.toUpperCase().replace(/[^A-Z0-9]/gi, '') !== searchKey);
                        const masterData = this.records || []; // RESTAURADO: Fuente de datos local

                        const tagsHtml = others.map(o => {
                            let cmykStr = '';
                            const aggNorm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/gi, '');
                            const targetKey = aggNorm(o);

                            // Buscar el CMYK de este equivalente en el archivo abierto
                            const ref = masterData.find(r => {
                                const n = aggNorm(r.name || '');
                                const bn = aggNorm(r.baseName || '');
                                return n === targetKey || bn === targetKey || n.includes(targetKey);
                            });
                        
                        if (ref && ref.cmyk) {
                            const [c, m, y, k] = ref.cmyk;
                            cmykStr = `
                                <div style="display:flex; gap:8px; margin-left:15px; font-family:monospace; font-size:0.75rem;">
                                    <span style="color:#00e5ff;"><b style="color:#fff;opacity:0.5;">C:</b>${c.toFixed(2)}</span>
                                    <span style="color:#00e5ff;"><b style="color:#fff;opacity:0.5;">M:</b>${m.toFixed(2)}</span>
                                    <span style="color:#00e5ff;"><b style="color:#fff;opacity:0.5;">Y:</b>${y.toFixed(2)}</span>
                                    <span style="color:#00e5ff;"><b style="color:#fff;opacity:0.5;">K:</b>${k.toFixed(2)}</span>
                                </div>`;
                        }

                        return `
                            <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid #3b82f6; padding: 10px 15px; border-radius: 8px; margin-bottom: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); display:flex; justify-content:space-between; align-items:center;">
                                <div style="display:flex; align-items:center; flex-wrap:wrap; overflow:hidden;">
                                    <span style="color:#fff; font-size:0.85rem; font-weight:bold; white-space:nowrap;">${o}</span>
                                    ${cmykStr}
                                </div>
                                <span style="font-size:0.6rem; color:#3b82f6; background:rgba(59, 130, 246, 0.1); padding:2px 8px; border-radius:4px; font-weight:bold; text-transform:uppercase; flex-shrink:0; margin-left:10px;">EQUIVALENTE</span>
                            </div>`;
                    }).join('');
                    
                    eqHtml = `
                        <div style="margin-top:20px; padding:15px; background:rgba(59, 130, 246, 0.05); border:1px solid rgba(59, 130, 246, 0.2); border-radius:12px;">
                            <label style="color:#60a5fa; font-size:0.75rem; font-weight:bold; display:block; margin-bottom:10px;"><i class="fas fa-layer-group"></i> OTROS NOMBRES EN ESTA FAMILIA (BUSCANDO EN TXT MAESTRO)</label>
                            <div style="display: flex; flex-direction: column; gap: 5px;">
                                ${tagsHtml}
                            </div>
                        </div>`;
                }
            }
            eqContainer.innerHTML = eqHtml;
        };

        // EJECUTAR INMEDIATAMENTE PARA MOSTRAR ERRORES AL ABRIR
        updateLiveSuggestions();

        nameInput.oninput = updateLiveSuggestions;
        nkInput.oninput = updateLiveSuggestions;

        modal.querySelector('#btnCancelEdit').onclick = () => modal.remove();
        modal.querySelector('#btnSaveEdit').onclick = async () => {
            const newName = modal.querySelector('#editName').value.trim().toUpperCase();
            const newNK = modal.querySelector('#editNK').value.trim().toUpperCase();
            
            const c = parseFloat(modal.querySelector('#editC').value);
            const m = parseFloat(modal.querySelector('#editM').value);
            const y = parseFloat(modal.querySelector('#editY').value);
            const k = parseFloat(modal.querySelector('#editK').value);
            
            if (!newName) {
                alert('El nombre del color no puede estar vacío.');
                return;
            }
            if (isNaN(c) || isNaN(m) || isNaN(y) || isNaN(k)) {
                alert('Por favor, ingresa valores CMYK numéricos válidos.');
                return;
            }
            
            record.baseName = newName;
            record.nk = newNK;
            // Reconstruir nombre
            record.name = newNK ? `${newName} ${newNK}` : newName;
            record.cmyk = [c, m, y, k];
            
            modal.remove();
            await this.performValidation();
            window.showNotification?.('Actualizado', 'Registro corregido.', 'success');
        };
    }

    deleteRecord(uid) {
        if (!confirm('¿Estás seguro de que deseas eliminar este registro?')) return;
        this.records = this.records.filter(r => r._uid !== uid);
        this.performValidation();
        window.showNotification?.('Eliminado', 'Registro eliminado correctamente.', 'info');
    }

    handleExport() {
        if (this.records.length === 0) return;
        
        const lines = [];
        // 1. CABECERAS CGATS.17 (Sin tabulaciones, solo espacios)
        lines.push("CGATS.17");
        lines.push("ORIGINATOR \"ErgoSoft AG\"");
        lines.push("FILE_DESCRIPTOR \"\"");
        lines.push(`CREATED "${new Date().toLocaleDateString('en-GB')}"`);
        lines.push("NUMBER_OF_FIELDS 9");
        lines.push("BEGIN_DATA_FORMAT");
        lines.push("SAMPLE_ID SAMPLE_NAME CMYK_C CMYK_M CMYK_Y CMYK_K LAB_L LAB_A LAB_B");
        lines.push("END_DATA_FORMAT");
        lines.push(`NUMBER_OF_SETS ${this.records.length}`);
        lines.push("BEGIN_DATA");

        // 2. DATOS CON COMILLAS Y ESPACIOS SIMPLES
        this.records.forEach((r, idx) => {
            const id = idx + 1;
            const name = `"${r.name}"`;
            const cmyk = (r.cmyk || [0,0,0,0]).map(v => Number(v).toFixed(6)).join(' ');
            const lab = (r.lab || [100,0,0]).map(v => Number(v).toFixed(6)).join(' ');
            lines.push(`${id} ${name} ${cmyk} ${lab}`);
        });

        // 3. CIERRE
        lines.push("END_DATA");

        const blob = new Blob([lines.join('\r\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Mantener nombre original
        const baseName = this.originalFileName ? this.originalFileName.replace(/\.[^/.]+$/, "") : "auditado";
        const fileName = `auditado_${baseName}.txt`;
        
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        window.showNotification?.('Exportado', `Archivo ${fileName} generado con éxito (CGATS).`, 'success');
    }
}
