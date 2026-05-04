import { normalizeSpaces, escapeHtml, extractBaseName } from '../core/utils.js';
import { getAllMasterNks, addMasterNk, getEquivalencyGroupsFromDB, supabase, addColorNameToGroup, createNewEquivalencyGroup } from '../core/supabaseClient.js';
import { updateConstantsFromDB, getAllEquivalentNames, getGroupIdForColor, EQUIVALENCE_MAP } from '../core/constants.js';

// Hacer las funciones disponibles globalmente para otros módulos
window.getAllEquivalentNames = getAllEquivalentNames;
window.getGroupIdForColor = getGroupIdForColor;
window.isValidColorName = isValidColorName;
window.isValidNK = isValidNK;

let appInstance = null;
let validColorNamesLoaded = false;
let masterNksSet = new Set();

export function setAppInstance(app) {
    appInstance = app;
}

export function getValidNamesSet() {
    const names = window.ALL_VALID_COLOR_NAMES || [];
    return new Set(names.map(name => normalizeSpaces(name).toUpperCase()));
}

export function addNameToLocalCatalog(name) {
    const normalized = normalizeSpaces(name || '').toUpperCase();
    if (!window.ALL_VALID_COLOR_NAMES) window.ALL_VALID_COLOR_NAMES = [];
    if (!window.ALL_VALID_COLOR_NAMES.includes(normalized)) {
        window.ALL_VALID_COLOR_NAMES.push(normalized);
        window.ALL_VALID_COLOR_NAMES.sort();
    }
}

export async function ensureValidColorCatalogLoaded(forceReload = false) {
    if (forceReload) {
        validColorNamesLoaded = false;
        console.log('🔄 Forzando recarga del catálogo desde Supabase...');
    }
    
    if (validColorNamesLoaded) return;
    
    /* 
    Se eliminó la carga desde valid_color_names por instrucción de unificación.
    Solo se usará la tabla 'equivalencias'.
    */
    
    const dbGroups = await getEquivalencyGroupsFromDB();
    if (dbGroups && dbGroups.length > 0) {
        window.EQUIVALENCY_ROWS = dbGroups; // Guardar para sugerencias del modal
        updateConstantsFromDB(dbGroups);
        for (const group of dbGroups) {
            for (let i = 1; i < group.length; i++) {
                const colorName = group[i];
                if (colorName) addNameToLocalCatalog(colorName);
            }
        }
    }
    const masterNks = await getAllMasterNks();
    // Normalización estándar: Solo trim y mayúsculas, MANTENER EL "NK"
    const standardNormalizeNK = (v) => String(v || '').trim().toUpperCase();
    masterNksSet = new Set(masterNks.map(nk => standardNormalizeNK(nk)));
    window.MASTER_NKS_SET = masterNksSet; // Exponer globalmente
    validColorNamesLoaded = true;
}

export function isValidColorName(fullName, ignoreCatalog = false) {
    if (!fullName || typeof fullName !== 'string') return false;
    if (ignoreCatalog) return true;
    
    const map = window.EQUIVALENCE_MAP || EQUIVALENCE_MAP;
    if (!map) return false;

    // Normalización AGRESIVA (Remover todo excepto letras y números)
    const aggNorm = (n) => String(n || '').toUpperCase().replace(/[^A-Z0-9]/gi, '');
    
    const cleanFull = aggNorm(fullName);
    const cleanBase = aggNorm(extractBaseName(fullName));
    
    if (!cleanFull && !cleanBase) return false;
    
    // 1. INTENTO DIRECTO
    if (map.has(cleanFull) || map.has(cleanBase)) return true;

    // 2. INTENTO TOLERANTE (Quitar prefijos/sufijos comunes como TM, TEAM, R)
    // Ej: "69W TM CRIMSON R" -> "69WCRIMSON"
    const stripTechnical = (s) => s
        .replace(/^TM|TEAM|TEAMM/g, '') // Quitar prefijos al inicio
        .replace(/R$/g, '')             // Quitar R al final
        .replace(/REFILL$/g, '');       // Quitar REFILL al final

    const strippedFull = stripTechnical(cleanFull);
    const strippedBase = stripTechnical(cleanBase);

    if (strippedFull && map.has(strippedFull)) return true;
    if (strippedBase && map.has(strippedBase)) return true;

    // 3. FALLBACK: Verificar si alguna de las llaves en el mapa contiene nuestro nombre limpio
    // (Útil para casos donde el catálogo tiene el nombre más largo)
    if (cleanBase.length > 3) {
        for (let key of map.keys()) {
            if (key.includes(cleanBase) || cleanBase.includes(key)) return true;
        }
    }
    
    return false;
}

export async function ensureValidNksLoaded() {
    const masterNks = await getAllMasterNks();
    const standardNormalizeNK = (v) => String(v || '').trim().toUpperCase();
    masterNksSet = new Set(masterNks.map(nk => standardNormalizeNK(nk)));
    window.MASTER_NKS_SET = masterNksSet;
    return masterNksSet;
}

export function isValidNK(nk) {
    if (!nk) return false;
    const standardNormalizeNK = (v) => String(v || '').trim().toUpperCase();
    const cleanNk = standardNormalizeNK(nk);
    return masterNksSet.has(cleanNk);
}

export async function addValidColorName(name) {
    console.warn('⚠️ La adición directa a valid_color_names está desactivada. Use el módulo de equivalencias.');
    return { success: false, error: 'Función desactivada. Use equivalencias.' };
}

export async function addMasterNK(nkCode) {
    const user = appInstance?.auth?.getCurrentUser()?.username || 'sistema';
    const result = await addMasterNk(nkCode, user);
    const aggressiveNormalizeNK = (v) => String(v || '').replace(/^NK/i, '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (result.success) masterNksSet.add(aggressiveNormalizeNK(nkCode));
    return result;
}

export async function validateAndCorrectRecords(records, type = 'secondary', options = {}) {
    console.log(`%c🛡️ Auditoría Secuencial Iniciada (${type})...`, 'color: #ef4444; font-weight: bold;');
    
    await ensureValidColorCatalogLoaded();
    const masterNks = await getAllMasterNks();
    // Validamos literalmente contra el nk_code exacto de la base de datos
    const standardNormalizeNK = (v) => String(v || '').trim().toUpperCase();
    masterNksSet = new Set(masterNks.map(nk => standardNormalizeNK(nk)));
    
    const dbRows = await getEquivalencyGroupsFromDB();
    window.ALL_VALID_COLOR_NAMES = [];
    dbRows.forEach(row => {
        if (Array.isArray(row)) {
            for (let i = 1; i < row.length; i++) {
                const name = row[i]?.toString().trim().toUpperCase();
                if (name && !window.ALL_VALID_COLOR_NAMES.includes(name)) {
                    window.ALL_VALID_COLOR_NAMES.push(name);
                }
            }
        }
    });
    validColorNamesLoaded = window.ALL_VALID_COLOR_NAMES.length > 0;

    const allAuditRecords = [];
    const seenRecords = new Map();

    for (const record of records) {
        const cleanBase = record.baseName || '';
        const cleanNk = record.nk || '';
        const originalFullName = record.name || '';
        
        // REGLA: Ignorar todo lo que contenga "WHITE"
        if (originalFullName.toUpperCase().includes('WHITE') || cleanBase.toUpperCase().includes('WHITE')) {
            continue;
        }

        // VALIDACIÓN UNIFICADA: Un nombre es válido si el nombre completo O el baseName están en catálogo
        const isNameValid = isValidColorName(originalFullName) || isValidColorName(cleanBase);
        
        // EXCEPCIÓN TONAL: Los colores TN, TNL o Tonal no requieren NK válido
        const isTonal = cleanBase.toUpperCase().startsWith('TONAL') ||
                        cleanBase.toUpperCase().startsWith('TNL') ||
                        cleanBase.toUpperCase().startsWith('TN');
        const isNkValid = isTonal ? true : isValidNK(cleanNk);
        const hasParentheses = /\(\d+\)/.test(originalFullName); // Solo paréntesis con número
        
        const signature = `${cleanBase}|${cleanNk}`;
        const isDuplicate = seenRecords.has(signature);
        seenRecords.set(signature, true);

        const cmyk = record.cmyk || [];
        const hasCmykError = cmyk.length < 4 || cmyk.some(v => isNaN(Number(v)) || Number(v) < 0 || Number(v) > 100);

        // Si el nombre es válido y no tiene paréntesis, nameError es false
        const nameError = !isNameValid;

        const hasAnyError = nameError || !isNkValid || hasParentheses || isDuplicate || hasCmykError;
        
        if (hasAnyError) {
            allAuditRecords.push({ 
                ...record, 
                nameError,
                nkError: !isNkValid,
                hasParentheses,
                hasCmykError
            });
        }
    }
    
    // Calcular NK dominante del archivo para sugerencias
    const nkCounts = {};
    let dominantNk = '';
    let maxCount = 0;
    
    records.forEach(r => {
        const nk = (r.nk || '').trim().toUpperCase();
        if (nk) { // Acepta cualquier NK, no solo los que empiezan con 'NK'
            nkCounts[nk] = (nkCounts[nk] || 0) + 1;
            if (nkCounts[nk] > maxCount) {
                maxCount = nkCounts[nk];
                dominantNk = nk;
            }
        }
    });

    // Aplicar NK dominante como sugerencia si el registro no tiene uno
    allAuditRecords.forEach(r => {
        if (!r.nk && dominantNk) {
            r.nk = dominantNk;
        }
    });
    
    if (allAuditRecords.length === 0) {
        console.log('✅ Archivo impecable. Cargando...');
        return { records: records, correctionsApplied: 0 };
    }

    // PASO 1: CORREGIR NOMBRES (Solo los que fallan validación o tienen paréntesis)
    const nameAudit = allAuditRecords.filter(r => r.nameError || r.hasParentheses);
    let currentRecords = allAuditRecords;

    if (nameAudit.length > 0) {
        // Doble check para no mostrar los que ya se marcaron como LISTO accidentalmente
        const realNameAudit = nameAudit.filter(r => {
            const isNowValid = isValidColorName(r.name) || isValidColorName(r.baseName);
            return !isNowValid || r.hasParentheses;
        });

        if (realNameAudit.length > 0) {
            const correctedNames = await new Promise(resolve => createCorrectionModal(realNameAudit, 'names', resolve));
            if (!correctedNames) return { records: [], cancelled: true };
            
            // Actualizar records con las correcciones
            currentRecords = allAuditRecords.map(orig => {
                const corr = correctedNames.find(c => c.id === orig.id);
                // Si se corrigió, actualizamos. Si no estaba en el audit, se queda igual.
                // Si estaba en el audit pero NO se devolvió (se eliminó), se marcará para filtrado después.
                return corr ? { ...orig, ...corr, nameError: false, hasParentheses: false } : orig;
            });
        }
    }

    // PASO 2: CORREGIR NKs
    const nkAudit = currentRecords.filter(r => r.nkError);
    if (nkAudit.length > 0) {
        const correctedNks = await new Promise(resolve => createCorrectionModal(nkAudit, 'nks', resolve, dominantNk));
        if (!correctedNks) return { records: [], cancelled: true };
        currentRecords = currentRecords.map(orig => {
            const corr = correctedNks.find(c => c.id === orig.id);
            return corr ? { ...orig, ...corr, nkError: false } : orig;
        });
    }

    // PASO 3: CORREGIR CMYK (valores fuera del rango 0-100)
    // Recalcular sobre TODOS los records para incluir los que solo tienen error CMYK
    const cmykAudit = records.filter(r => {
        const cmyk = r.cmyk || [];
        return cmyk.length < 4 || cmyk.some(v => isNaN(Number(v)) || Number(v) < 0 || Number(v) > 100);
    });
    let cmykCorrectedMap = new Map();
    if (cmykAudit.length > 0) {
        const correctedCmyks = await new Promise(resolve => createCmykCorrectionModal(cmykAudit, resolve));
        if (!correctedCmyks) return { records: [], cancelled: true };
        correctedCmyks.forEach(c => cmykCorrectedMap.set(c.id, c.cmyk));
    }

    // Identificar IDs que fueron eliminados en los modales
    const nameAuditIds = nameAudit.map(r => r.id);
    const nkAuditIds = nkAudit.map(r => r.id);
    const correctedNameIds = new Set(currentRecords.map(r => r.id));
    
    // Un registro se considera eliminado si estaba en el audit pero ya no está en el resultado
    const deletedIds = new Set([
        ...nameAuditIds.filter(id => !correctedNameIds.has(id)),
        ...nkAuditIds.filter(id => !correctedNameIds.has(id))
    ]);

    const finalRecords = records
        .filter(original => !deletedIds.has(original.id)) // <--- FILTRAR ELIMINADOS
        .map(original => {
            const corrected = currentRecords.find(c => c.id === original.id);
            const cmykFixed = cmykCorrectedMap.get(original.id);
            return {
                ...original,
                ...(corrected ? {
                    name: `${corrected.baseName} ${corrected.nk}`.trim(),
                    baseName: corrected.baseName,
                    nk: corrected.nk
                } : {}),
                ...(cmykFixed ? { cmyk: cmykFixed } : {})
            };
        });

    return { records: finalRecords, correctionsApplied: currentRecords.length };
}

function createCorrectionModal(auditRecords, stepType, onComplete, dominantNk = '') {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.style.zIndex = '10001';
    
    const isNameStep = stepType === 'names';
    const title = isNameStep ? 'PASO 1: VALIDAR NOMBRES DE COLOR' : 'PASO 2: VALIDAR CÓDIGOS NK';
    const subtitle = isNameStep ? 'Escribe el nombre o agrega el nuevo color al catálogo.' : 'Escribe y selecciona el código NK oficial.';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 1000px; width: 95%; background: #0f172a; border: 2px solid #334155; border-radius: 12px;">
            <div class="modal-header" style="background: #1e1e2e; border-bottom: 3px solid ${isNameStep ? '#f59e0b' : '#3b82f6'}; padding: 1.5rem 2rem; border-radius: 12px 12px 0 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <div>
                        <h3 style="color: white; margin: 0; font-size: 1.5rem;"><i class="fas fa-${isNameStep ? 'palette' : 'barcode'}" style="color: ${isNameStep ? '#f59e0b' : '#3b82f6'};"></i> ${title}</h3>
                        <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 0.9rem;">${subtitle}</p>
                    </div>
                </div>
            </div>
            <div class="modal-body" style="padding: 2rem; overflow-y: auto; max-height: 60vh; background: #0b0f1a;">
                <table class="results-table" style="width: 100%; border-spacing: 0 10px; border-collapse: separate;">
                    <thead>
                        <tr style="color: #475569; font-size: 0.75rem; text-transform: uppercase; font-weight: 900;">
                            <th style="padding: 0 15px; width: 60px;">ID</th>
                            <th style="padding: 0 15px;">Dato Original</th>
                            <th style="padding: 0 15px;">${isNameStep ? 'Nombre del Color' : 'Código NK'}</th>
                            <th style="padding: 0 15px; text-align: center; width: 180px;">Acciones / Estado</th>
                        </tr>
                    </thead>
                    <tbody id="correctionTableBody">
                        ${auditRecords.map(rec => `
                            <tr data-id="${rec.id}" class="audit-row" style="background: #1e293b; border-radius: 10px;">
                                <td style="text-align: center; font-weight: 900; color: #475569;">${rec.id}</td>
                                <td style="padding: 15px; color: #94a3b8; font-size: 0.8rem; font-family: monospace;">${rec.name}</td>
                                <td style="padding: 15px; position: relative;">
                                    ${isNameStep ? `
                                        <input type="text" class="name-input" placeholder="🔍 Escribe nombre..." value="${rec.name}" 
                                               style="width: 100%; background: #0b0f1a; color: white; border: 2px solid #ef4444; padding: 12px; border-radius: 8px; font-size: 1rem; font-weight: bold;">
                                        <div class="suggestion-box" style="display:none; position:absolute; left:0; right:0; background:#1e293b; border:2px solid #f59e0b; z-index:1000; max-height:200px; overflow-y:auto; border-radius: 0 0 8px 8px;"></div>
                                        
                                        <!-- UI para agregar a BD (inicialmente oculta) -->
                                        <div class="add-to-db-container" style="display:none; margin-top:10px; padding:10px; background:rgba(245, 158, 11, 0.1); border:1px dashed #f59e0b; border-radius:8px;">
                                            <p style="color:#f59e0b; font-size:0.75rem; margin:0 0 5px 0; font-weight:bold;">ESTE COLOR NO EXISTE. ¿AGREGAR A UN GRUPO?</p>
                                            <div style="position:relative;">
                                                <input type="text" class="group-search-input" placeholder="🔍 Buscar grupo por nombre o ID..." 
                                                       style="width:100%; background:#0f172a; border:1px solid #475569; color:white; padding:8px; border-radius:6px; font-size:0.85rem;">
                                                <div class="group-suggestion-box" style="display:none; position:absolute; left:0; right:0; background:#1e293b; border:1px solid #f59e0b; z-index:1001; max-height:150px; overflow-y:auto; border-radius:4px; box-shadow:0 4px 12px rgba(0,0,0,0.5);"></div>
                                            </div>
                                            <div style="display:flex; justify-content:flex-end; margin-top:8px;">
                                                <button class="btn-save-to-db" style="background:#f59e0b; color:white; border:none; padding:5px 12px; border-radius:4px; font-size:0.75rem; font-weight:bold; cursor:pointer;">
                                                    <i class="fas fa-plus"></i> AGREGAR A BD
                                                </button>
                                            </div>
                                        </div>

                                        <input type="hidden" class="selected-family-id" value="">
                                        <input type="hidden" class="nk-row-input" value="${rec.nk}">
                                    ` : `
                                        <input type="text" class="nk-row-input" placeholder="🔍 Sugerido: ${dominantNk || 'Escribe NK...'}" value="${rec.nk || dominantNk}" 
                                               style="width: 100%; background: #0b0f1a; color: #3b82f6; border: 2px solid #3b82f6; padding: 12px; border-radius: 8px; font-family: monospace; font-weight: 900; text-align: center; font-size: 1.2rem;">
                                        <div class="suggestion-box" style="display:none; position:absolute; left:0; right:0; background:#1e293b; border:2px solid #3b82f6; z-index:1000; max-height:200px; overflow-y:auto; border-radius: 0 0 8px 8px;"></div>
                                        <input type="hidden" class="name-input" value="${rec.baseName}">
                                    `}
                                </td>
                                <td style="padding: 15px; text-align: center;">
                                    <div style="display:flex; align-items:center; justify-content:center; gap:15px;">
                                        <div class="status-indicator">
                                            <i class="fas fa-times-circle" style="color: #ef4444; font-size: 1.8rem;"></i>
                                            <span style="display:block; font-size: 0.7rem; font-weight: 900; color: #ef4444;">BLOQUEADO</span>
                                        </div>
                                        <button class="delete-row-btn" title="Eliminar de la carga" 
                                                style="background:rgba(239, 68, 68, 0.1); border:1px solid #ef4444; color:#ef4444; width:35px; height:35px; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s;">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="modal-footer" style="background: #1e1e2e; border-top: 1px solid #334155; padding: 1.5rem 2.5rem; display: flex; justify-content: space-between; align-items: center; border-radius: 0 0 12px 12px;">
                <button class="cancel-modal" style="background: transparent; border: 1px solid #475569; color: #64748b; padding: 12px 25px; border-radius: 10px; cursor: pointer; font-size: 0.9rem;">CANCELAR</button>
                <button id="btnApplyCorrections" style="background: ${isNameStep ? '#f59e0b' : '#10b981'}; color: white; border: none; padding: 15px 40px; border-radius: 10px; cursor: pointer; font-weight: 900; font-size: 1rem;">
                    ${isNameStep ? 'SIGUIENTE: VALIDAR NK <i class="fas fa-chevron-right"></i>' : 'FINALIZAR Y CARGAR <i class="fas fa-check-double"></i>'}
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const rows = Array.from(modal.querySelectorAll('#correctionTableBody tr'));
    const deletedIds = new Set();
    
    const validateRow = (row) => {
        if (deletedIds.has(row.dataset.id)) return;

        const input = isNameStep ? row.querySelector('.name-input') : row.querySelector('.nk-row-input');
        const val = input.value.trim().toUpperCase();
        const isValid = isNameStep ? isValidColorName(val) : isValidNK(val);
        
        const icon = row.querySelector('.status-indicator i');
        const text = row.querySelector('.status-indicator span');
        
        const addContainer = row.querySelector('.add-to-db-container');

        if (isValid) {
            icon.className = 'fas fa-check-circle'; icon.style.color = '#10b981';
            text.textContent = 'LISTO'; text.style.color = '#10b981';
            input.style.borderColor = '#10b981';
            if (addContainer) addContainer.style.display = 'none';
        } else {
            icon.className = 'fas fa-times-circle'; icon.style.color = '#ef4444';
            text.textContent = 'BLOQUEADO'; text.style.color = '#ef4444';
            input.style.borderColor = isNameStep ? '#ef4444' : '#3b82f6';
            if (addContainer && val.length > 2) addContainer.style.display = 'block';
            else if (addContainer) addContainer.style.display = 'none';
        }
    };

    rows.forEach(row => {
        const input = isNameStep ? row.querySelector('.name-input') : row.querySelector('.nk-row-input');
        const sugBox = row.querySelector('.suggestion-box');
        
        // Botón eliminar
        row.querySelector('.delete-row-btn').onclick = () => {
            if (confirm('¿Eliminar este color de la carga? No se comparará ni se guardará.')) {
                deletedIds.add(row.dataset.id);
                row.style.opacity = '0.4';
                row.style.pointerEvents = 'none';
                row.querySelector('.status-indicator span').textContent = 'ELIMINADO';
                row.querySelector('.status-indicator span').style.color = '#64748b';
                row.querySelector('.status-indicator i').style.color = '#64748b';
            }
        };

        if (isNameStep) {
            const addContainer = row.querySelector('.add-to-db-container');
            const groupInput = row.querySelector('.group-search-input');
            const groupSugBox = row.querySelector('.group-suggestion-box');
            const btnSave = row.querySelector('.btn-save-to-db');

            groupInput.oninput = () => {
                const query = groupInput.value.trim().toUpperCase();
                if (query.length < 2) { groupSugBox.style.display = 'none'; return; }

                const families = Array.isArray(window.EQUIVALENCY_ROWS) ? window.EQUIVALENCY_ROWS : [];
                // families es [ [nk_code, color1, color2...], [...] ]
                const matches = families.filter(f => {
                    const groupId = f[0].toUpperCase();
                    const colors = f.slice(1).filter(c => c).map(c => c.toUpperCase());
                    return groupId.includes(query) || colors.some(c => c.includes(query));
                }).slice(0, 10);

                if (matches.length > 0) {
                    groupSugBox.innerHTML = matches.map(f => {
                        const groupId = f[0];
                        const colorNames = f.slice(1).filter(c => c).join(', ');
                        return `
                            <div class="group-sug-item" data-id="${groupId}" style="padding:8px; cursor:pointer; color:white; border-bottom:1px solid #334155; font-size:0.8rem;">
                                <div style="font-weight:bold; color:#f59e0b;">Grupo: ${groupId}</div>
                                <div style="font-size:0.7rem; color:#94a3b8; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${colorNames}</div>
                            </div>
                        `;
                    }).join('');
                    groupSugBox.style.display = 'block';
                    groupSugBox.querySelectorAll('.group-sug-item').forEach(item => {
                        item.onclick = () => {
                            groupInput.value = item.dataset.id;
                            groupSugBox.style.display = 'none';
                        };
                    });
                } else {
                    groupSugBox.style.display = 'none';
                }
            };

            const user = window.app?.auth?.getCurrentUser();
            const canEdit = user?.isMaster || user?.permissions?.includes('editCatalog');

            if (canEdit) {
                btnSave.onclick = async () => {
                    const groupToUse = groupInput.value.trim().toUpperCase();
                    const colorToRegister = input.value.trim().toUpperCase();
                    
                    if (!groupToUse) { alert('Selecciona o escribe un Grupo ID.'); return; }
                    
                    btnSave.disabled = true; btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESANDO...';
                    
                    // Intentar agregar a grupo existente
                    let result = await addColorNameToGroup(groupToUse, colorToRegister);
                    
                    // Si el grupo no existe, preguntar si desea crearlo
                    if (!result.success && result.error.includes('no encontrado')) {
                        if (confirm(`El grupo "${groupToUse}" no existe. ¿Deseas crear este NUEVO grupo con el color "${colorToRegister}"?`)) {
                            result = await createNewEquivalencyGroup(groupToUse, colorToRegister);
                        }
                    }

                    if (result.success) {
                        // Actualizar catálogo local
                        addNameToLocalCatalog(colorToRegister);
                        if (window.EQUIVALENCE_MAP) {
                            const cleanName = colorToRegister.replace(/[^A-Z0-9]/gi, '');
                            window.EQUIVALENCE_MAP.set(cleanName, groupToUse);
                        }
                        // Reflejar cambio en la UI
                        validateRow(row);
                        alert('✅ Operación exitosa. El catálogo ha sido actualizado.');
                    } else if (result) {
                        alert('❌ Error: ' + result.error);
                    }
                    
                    btnSave.disabled = false; btnSave.innerHTML = '<i class="fas fa-plus"></i> AGREGAR A BD';
                };
            } else {
                btnSave.style.display = 'none';
                groupInput.disabled = true;
                groupInput.placeholder = '🔒 Sin permiso para editar BD';
            }
        }

        input.oninput = () => {
            const val = input.value.trim().toUpperCase();
            if (val.length < 2) { sugBox.style.display = 'none'; validateRow(row); return; }

            let matches = [];
            if (isNameStep) {
                const families = Array.isArray(window.EQUIVALENCY_ROWS) ? window.EQUIVALENCY_ROWS : [];
                const allColors = [];
                families.forEach(f => {
                    const groupId = f[0];
                    for (let i = 1; i < f.length; i++) {
                        if (f[i]) allColors.push({ name: f[i].toUpperCase(), group: groupId });
                    }
                });
                matches = allColors.filter(c => c.name.includes(val)).slice(0, 15);
            } else {
                matches = Array.from(masterNksSet).filter(nk => nk.includes(val)).slice(0, 10);
            }

            if (matches.length > 0) {
                sugBox.innerHTML = matches.map(m => {
                    const text = isNameStep ? `<strong>${m.name}</strong> <small style="color:#64748b;">(Grupo: ${m.group})</small>` : `<strong>${m}</strong>`;
                    const value = isNameStep ? m.name : m;
                    return `<div class="sug-item" data-value="${value}" style="padding:10px; cursor:pointer; color:white; border-bottom:1px solid #334155;">${text}</div>`;
                }).join('');
                sugBox.style.display = 'block';
                sugBox.querySelectorAll('.sug-item').forEach(item => {
                    item.onclick = () => {
                        input.value = item.dataset.value;
                        sugBox.style.display = 'none';
                        validateRow(row);
                    };
                });
            } else {
                sugBox.style.display = 'none';
            }
            validateRow(row);
        };
        input.onblur = () => setTimeout(() => sugBox.style.display = 'none', 200);
        validateRow(row);
    });

    modal.querySelector('#btnApplyCorrections').onclick = async () => {
        const remainingRows = rows.filter(r => !deletedIds.has(r.dataset.id));
        
        if (!remainingRows.every(r => r.querySelector('.status-indicator span').textContent.trim() === 'LISTO')) {
            alert('Debes corregir o eliminar todos los registros bloqueados antes de continuar.');
            return;
        }

        const btn = modal.querySelector('#btnApplyCorrections');
        btn.disabled = true; btn.innerHTML = 'PROCESANDO...';

        const corrected = remainingRows.map(row => ({
            id: row.dataset.id,
            baseName: row.querySelector('.name-input').value.trim().toUpperCase(),
            nk: row.querySelector('.nk-row-input').value.trim().toUpperCase()
        }));

        // NOTA: Los registros eliminados simplemente no se incluyen en 'corrected'.
        // La lógica en validateAndCorrectRecords debe filtrar los originales.
        modal.remove();
        onComplete(corrected);
    };

    modal.querySelector('.cancel-modal').onclick = () => {
        if (confirm('¿Cancelar carga de archivo?')) { modal.remove(); onComplete(null); }
    };
}


export function revalidateRecord(name, nk) {
    const cleanName = (name || '').trim();
    const cleanNk = (nk || '').trim().toUpperCase();

    return {
        isNameValid: isValidColorName(cleanName),
        isNkValid: isValidNK(cleanNk),
        cleanBase: cleanName,
        cleanNk: cleanNk
    };
}

// ============================================================
// MODAL PASO 3: CORRECCIÓN DE VALORES CMYK FUERA DE RANGO
// ============================================================
function createCmykCorrectionModal(auditRecords, onComplete) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.style.zIndex = '10002';

    const rowsHtml = auditRecords.map(rec => {
        const rawCmyk = (rec.cmyk || [null, null, null, null]);
        const vals = rawCmyk.map(v => Number(v));
        return `
            <tr data-id="${rec.id}" class="cmyk-audit-row" style="background: #1e293b; border-radius: 10px;">
                <td style="padding: 12px 15px; color: #94a3b8; font-family: monospace; font-size: 0.85rem;">${rec.name || rec.id}</td>
                <td style="padding: 12px 8px;">
                    <div style="display: flex; gap: 8px; align-items: center;">
                        ${['C','M','Y','K'].map((ch, i) => {
                            const raw = rawCmyk[i];
                            const val = vals[i];
                            const err = raw === null || raw === undefined || String(raw).trim() === '' || isNaN(val) || val < 0 || val > 100;
                            // Valor original formateado con decimales (o "---" si es inválido)
                            const origDisplay = (raw === null || raw === undefined || String(raw).trim() === '') 
                                ? '---' 
                                : (isNaN(Number(raw)) ? String(raw) : Number(raw).toFixed(6));
                            const origColor = err ? '#ef4444' : '#10b981';
                            // Input: si el valor es válido usar el raw exacto, si no dejar vacío para forzar corrección
                            const inputVal = (!err) ? Number(raw).toFixed(6) : '';
                            return `<div style="text-align:center;">
                                <label style="color:#64748b; font-size:0.65rem; font-weight:900; display:block; margin-bottom:3px;">${ch}</label>
                                <input type="number" min="0" max="100" step="0.000001" class="cmyk-input" data-channel="${i}" value="${inputVal}"
                                    style="width:68px; background:#0b0f1a; color:${err ? '#ef4444' : '#10b981'}; padding:8px 4px; border-radius:6px 6px 0 0; text-align:center; font-weight:900; font-size:1rem; ${err ? 'border: 2px solid #ef4444; border-bottom:none;' : 'border: 2px solid #10b981; border-bottom:none;'}">
                                <div style="font-size:0.6rem; font-weight:700; color:${origColor}; background:#0b0f1a; border: 2px solid ${origColor}; border-top: 1px dashed ${origColor}; border-radius: 0 0 6px 6px; padding:2px 4px; font-family:monospace;" title="Valor original del archivo">
                                    orig: ${origDisplay}
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                </td>
                <td style="padding: 12px 15px; text-align:center;">
                    <div class="cmyk-status-indicator">
                        <i class="fas fa-times-circle" style="color: #ef4444; font-size: 1.5rem;"></i>
                        <span style="display:block; font-size:0.7rem; font-weight:900; color:#ef4444;">INVÁLIDO</span>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 860px; width: 95%; background: #0f172a; border: 2px solid #ef4444; border-radius: 12px;">
            <div class="modal-header" style="background: #1e1e2e; border-bottom: 3px solid #ef4444; padding: 1.5rem 2rem; border-radius: 12px 12px 0 0;">
                <h3 style="color: white; margin: 0; font-size: 1.4rem;">
                    <i class="fas fa-exclamation-triangle" style="color: #ef4444;"></i>
                    PASO 3: CORREGIR VALORES CMYK (Rango permitido: 0 – 100)
                </h3>
                <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 0.9rem;">Edita los valores en rojo hasta que todos estén dentro del rango.</p>
            </div>
            <div class="modal-body" style="padding: 2rem; overflow-y: auto; max-height: 60vh; background: #0b0f1a;">
                <table style="width: 100%; border-spacing: 0 10px; border-collapse: separate;">
                    <thead>
                        <tr style="color: #475569; font-size: 0.75rem; text-transform: uppercase; font-weight: 900;">
                            <th style="padding: 0 15px;">Color</th>
                            <th style="padding: 0 8px;">Valores CMYK</th>
                            <th style="padding: 0 15px; text-align:center; width:120px;">Estado</th>
                        </tr>
                    </thead>
                    <tbody id="cmykCorrectionBody">${rowsHtml}</tbody>
                </table>
            </div>
            <div class="modal-footer" style="background: #1e1e2e; border-top: 1px solid #334155; padding: 1.5rem 2.5rem; display: flex; justify-content: space-between; align-items: center; border-radius: 0 0 12px 12px;">
                <button class="cancel-cmyk-modal" style="background: transparent; border: 1px solid #475569; color: #64748b; padding: 12px 25px; border-radius: 10px; cursor: pointer;">CANCELAR</button>
                <button id="btnApplyCmyk" style="background: #ef4444; color: white; border: none; padding: 15px 40px; border-radius: 10px; cursor: pointer; font-weight: 900; font-size: 1rem;">
                    FINALIZAR Y CARGAR <i class="fas fa-check-double"></i>
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const validateCmykRow = (row) => {
        const inputs = row.querySelectorAll('.cmyk-input');
        const icon = row.querySelector('.cmyk-status-indicator i');
        const text = row.querySelector('.cmyk-status-indicator span');
        const allOk = Array.from(inputs).every(inp => {
            const v = Number(inp.value);
            const ok = !isNaN(v) && v >= 0 && v <= 100 && inp.value.trim() !== '';
            inp.style.borderColor = ok ? '#10b981' : '#ef4444';
            inp.style.color = ok ? '#10b981' : '#ef4444';
            return ok;
        });
        icon.className = allOk ? 'fas fa-check-circle' : 'fas fa-times-circle';
        icon.style.color = allOk ? '#10b981' : '#ef4444';
        text.textContent = allOk ? 'LISTO' : 'INVÁLIDO';
        text.style.color = allOk ? '#10b981' : '#ef4444';
    };

    modal.querySelectorAll('.cmyk-audit-row').forEach(row => {
        row.querySelectorAll('.cmyk-input').forEach(inp => {
            inp.oninput = () => validateCmykRow(row);
        });
        validateCmykRow(row);
    });

    modal.querySelector('#btnApplyCmyk').onclick = () => {
        const allRows = modal.querySelectorAll('.cmyk-audit-row');
        const allOk = Array.from(allRows).every(r =>
            r.querySelector('.cmyk-status-indicator span').textContent.trim() === 'LISTO'
        );
        if (!allOk) {
            alert('⚠️ Corrige todos los valores CMYK antes de continuar.');
            return;
        }
        const corrected = Array.from(allRows).map(row => ({
            id: row.dataset.id,
            cmyk: Array.from(row.querySelectorAll('.cmyk-input')).map(i => Number(i.value))
        }));
        modal.remove();
        onComplete(corrected);
    };

    modal.querySelector('.cancel-cmyk-modal').onclick = () => {
        if (confirm('¿Cancelar carga de archivo?')) { modal.remove(); onComplete(null); }
    };
}