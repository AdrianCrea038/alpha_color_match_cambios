// js/modules/nameValidator.js
import { normalizeSpaces, escapeHtml } from '../core/utils.js';
import { addCustomValidColorName, getCustomValidColorNames } from '../core/supabaseClient.js';

let appInstance = null;
let validColorNamesLoaded = false;

export function setAppInstance(app) {
    appInstance = app;
}

/**
 * Obtiene el Set de nombres válidos actualizado desde window o constants
 */
function getValidNamesSet() {
    const names = window.ALL_VALID_COLOR_NAMES || [];
    return new Set(names.map(name => normalizeSpaces(name).toUpperCase()));
}

export function isValidColorName(baseName) {
    if (!baseName) return false;
    
    // 1. Si contiene paréntesis, es inválido
    if (/\([^)]*\)/.test(baseName)) return false;
    
    // 2. Si contiene un código NK al final (ej: "BLUE NK123"), es inválido para linearización
    if (/\s+NK[A-Z0-9\-]+$/i.test(baseName.trim())) return false;
    
    const validSet = getValidNamesSet();
    const normalized = normalizeSpaces(baseName).toUpperCase();
    return validSet.has(normalized);
}

function addNameToLocalCatalog(name) {
    const normalized = normalizeSpaces(name || '').toUpperCase();
    if (!window.ALL_VALID_COLOR_NAMES) window.ALL_VALID_COLOR_NAMES = [];
    if (!window.ALL_VALID_COLOR_NAMES.includes(normalized)) {
        window.ALL_VALID_COLOR_NAMES.push(normalized);
        window.ALL_VALID_COLOR_NAMES.sort();
    }
}

async function ensureValidColorCatalogLoaded() {
    if (validColorNamesLoaded) return;
    validColorNamesLoaded = true;
    const customNames = await getCustomValidColorNames();
    for (const name of customNames) {
        addNameToLocalCatalog(name);
    }
}

function findAndCorrectInOtherArray(originalName, newBaseName, newFullName, currentFileType) {
    if (!appInstance) return;
    const otherArray = currentFileType === 'primary' ? appInstance.secondaryData : appInstance.primaryData;
    if (!otherArray || otherArray.length === 0) return;
    
    let corrected = false;
    for (let i = 0; i < otherArray.length; i++) {
        if (otherArray[i].name === originalName) {
            otherArray[i].baseName = newBaseName;
            otherArray[i].name = newFullName;
            corrected = true;
        }
    }
    
    if (corrected) {
        if (currentFileType === 'primary') {
            appInstance.renderDataList?.('secondary', appInstance.secondaryData);
        } else {
            appInstance.renderDataList?.('primary', appInstance.primaryData);
        }
        appInstance.saveCurrentState?.();
    }
}

function showCorrectionModal(colorData, index, totalInvalid, suggestedNk = '') {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.zIndex = '10001';
        
        let selectedValue = '';
        const allNames = window.ALL_VALID_COLOR_NAMES || [];
        
        const renderSuggestions = (filterText) => {
            const suggestionsList = modal.querySelector('#suggestionsList');
            const filterLower = (filterText || '').toLowerCase();
            
            const matches = allNames.filter(name =>
                name.toLowerCase().includes(filterLower)
            ).slice(0, 15);
            
            if (matches.length === 0) {
                const escapedInput = escapeHtml(filterText.trim().toUpperCase());
                suggestionsList.innerHTML = `
                    <div style="padding: 0.5rem; color: #f87171; text-align: center;">No hay coincidencias exactas</div>
                    <div class="suggestion-item add-new-name" data-value="${escapedInput}" style="padding: 0.6rem 0.8rem; cursor: pointer; border-top: 1px solid #2d3748; color: #4ade80;">
                        ➕ Usar "${escapedInput}" (temporal o nuevo)
                    </div>
                `;
                suggestionsList.querySelector('.add-new-name').onclick = () => {
                    selectedValue = escapedInput;
                    modal.querySelector('#searchInput').value = selectedValue;
                    suggestionsList.style.display = 'none';
                    validateForm();
                };
            } else {
                suggestionsList.innerHTML = matches.map(name => `
                    <div class="suggestion-item" data-value="${escapeHtml(name)}" style="padding: 0.5rem 0.8rem; cursor: pointer; border-bottom: 1px solid #2d3748;">
                        🔍 ${name}
                    </div>
                `).join('');
                
                suggestionsList.querySelectorAll('.suggestion-item').forEach(item => {
                    item.onclick = () => {
                        selectedValue = item.dataset.value;
                        modal.querySelector('#searchInput').value = selectedValue;
                        suggestionsList.style.display = 'none';
                        validateForm();
                    };
                });
            }
            suggestionsList.style.display = 'block';
        };
        
        const validateForm = () => {
            const applyBtn = modal.querySelector('.apply-correction');
            const reasonSelect = modal.querySelector('#correctionReason');
            const searchVal = modal.querySelector('#searchInput').value.trim();
            const nkVal = modal.querySelector('#manualNkInput').value.trim();
            
            const isValid = searchVal !== '' && nkVal !== '' && reasonSelect.value !== '';
            applyBtn.disabled = !isValid;
            applyBtn.style.opacity = isValid ? '1' : '0.5';
        };
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 550px; border: 2px solid #ff007f;">
                <div class="modal-header" style="background: linear-gradient(90deg, #ff007f, #b45309);">
                    <h3 style="color: white; margin:0;"><i class="fas fa-edit"></i> Auditoría de Color (${index + 1}/${totalInvalid})</h3>
                    <button class="modal-close" style="color: white; background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                <div class="modal-body" style="padding: 1.5rem;">
                    <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 0.5rem; margin-bottom: 1.5rem; border-left: 4px solid #ff007f;">
                        <p style="margin:0 0 0.5rem;"><strong>Valor Original:</strong> <span style="color:#ff007f;">${escapeHtml(colorData.name)}</span></p>
                        <p style="margin:0;"><strong>Estado:</strong> <span style="color: #fbbf24;">${!colorData.nk ? '⚠️ Código NK Faltante' : '✅ NK Detectado'}</span></p>
                    </div>

                    <div class="form-group" style="margin-bottom: 1.2rem;">
                        <label style="display:block; margin-bottom:0.4rem; color:#9ca3af; font-size: 0.85rem;">Nombre Correcto del Color:</label>
                        <div style="position:relative;">
                            <input type="text" id="searchInput" placeholder="Buscar nombre oficial..." autocomplete="off" style="width:100%; padding:0.7rem; background:#0c0c12; border:1px solid #2d3748; border-radius:0.5rem; color:white;">
                        </div>
                        <div id="suggestionsList" style="max-height: 150px; overflow-y: auto; margin-top: 0.25rem; border-radius: 0.5rem; background: #1a1a2a; border: 1px solid #4b5563; display: none; position: absolute; z-index: 100; width: calc(100% - 3rem); box-shadow: 0 10px 25px rgba(0,0,0,0.5);"></div>
                    </div>

                    <div class="form-group" style="margin-bottom: 1.2rem;">
                        <label style="display:block; margin-bottom:0.4rem; color:#9ca3af; font-size: 0.85rem;">Código NK:</label>
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            <input type="text" id="manualNkInput" placeholder="Ej: NK123" style="flex: 1; padding:0.7rem; background:#0c0c12; border:1px solid #2d3748; border-radius:0.5rem; color:#00e5ff; font-weight: bold;">
                            ${suggestedNk ? `<span title="Sugerencia basada en el archivo" style="background: #b45309; color: white; padding: 0.2rem 0.5rem; border-radius: 1rem; font-size: 0.65rem; cursor: help;">💡 SUGERIDO</span>` : ''}
                        </div>
                        ${suggestedNk ? `<p style="margin: 0.3rem 0 0; font-size: 0.75rem; color: #fbbf24;">Sugerencia detectada: <strong>${suggestedNk}</strong></p>` : ''}
                    </div>

                    <div class="form-group" style="margin-bottom: 1.5rem;">
                        <label style="display:block; margin-bottom:0.4rem; color:#9ca3af; font-size: 0.85rem;">Motivo de la corrección:</label>
                        <select id="correctionReason" style="width:100%; padding:0.7rem; background:#0c0c12; border:1px solid #2d3748; border-radius:0.5rem; color:white;">
                            <option value="" disabled>-- Selecciona --</option>
                            <option value="Falta NK" ${!colorData.nk ? 'selected' : ''}>1. Falta NK / Código de tela</option>
                            <option value="Mal escrito nombre" ${colorData.nk ? 'selected' : ''}>2. Nombre mal escrito / Paréntesis</option>
                            <option value="Limpieza de NK">3. Limpieza de NK en nombre</option>
                            <option value="Error en el CYMK">4. Error en el CYMK</option>
                        </select>
                    </div>
                </div>
                <div class="modal-buttons" style="display: flex; gap: 1rem; justify-content: flex-end; padding: 1.5rem; background: rgba(0,0,0,0.2); border-top: 1px solid #2d3748;">
                    <button class="btn-secondary cancel-correction" style="padding: 0.7rem 1.2rem; cursor:pointer; border-radius: 0.5rem; border: 1px solid #4b5563; background: transparent; color: white;">Cancelar</button>
                    <button class="btn-primary apply-correction" style="padding: 0.7rem 1.5rem; background:#ff007f !important; cursor:pointer; border: none; border-radius: 0.5rem; color: white; font-weight: bold; transition: all 0.2s;">
                        APLICAR CAMBIOS
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const searchInput = modal.querySelector('#searchInput');
        const manualNkInput = modal.querySelector('#manualNkInput');
        const reasonSelect = modal.querySelector('#correctionReason');
        const applyBtn = modal.querySelector('.apply-correction');
        
        // PRE-LLENAR DATOS
        searchInput.value = colorData.baseName || '';
        manualNkInput.value = colorData.nk || suggestedNk || '';
        renderSuggestions(searchInput.value);
        
        searchInput.addEventListener('input', (e) => {
            renderSuggestions(e.target.value);
            validateForm();
        });

        manualNkInput.addEventListener('input', validateForm);
        reasonSelect.addEventListener('change', validateForm);
        
        // Ejecución inicial de validación
        validateForm();
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        
        modal.querySelector('.modal-close').onclick = () => { closeModal(); resolve(null); };
        modal.querySelector('.cancel-correction').onclick = () => { closeModal(); resolve(null); };
        
        applyBtn.onclick = async () => {
            const finalBaseName = (selectedValue || searchInput.value.trim()).toUpperCase();
            const finalNk = manualNkInput.value.trim().toUpperCase();
            
            let exactMatch = allNames.find(n => n.toUpperCase() === finalBaseName);
            
            if (!exactMatch) {
                if (confirm(`⚠️ "${finalBaseName}" no está en la lista oficial.\n\n¿Desea agregarlo a la base de datos permanentemente?`)) {
                    const res = await addCustomValidColorName(finalBaseName, appInstance?.auth?.getCurrentUser()?.username || 'usuario');
                    if (res.success) addNameToLocalCatalog(finalBaseName);
                }
                exactMatch = finalBaseName;
            }
            
            const newFullName = finalNk ? `${exactMatch} ${finalNk}` : exactMatch;
            closeModal();
            resolve({ newBaseName: exactMatch, newNk: finalNk, newFullName, reason: reasonSelect.value });
        };
    });
}

export async function validateAndCorrectRecords(records, fileType, onCorrectionApplied, suggestedNk = '') {
    await ensureValidColorCatalogLoaded();
    const correctedRecords = [...records];
    const correctionsNeeded = [];
    
    for (let i = 0; i < correctedRecords.length; i++) {
        const record = correctedRecords[i];
        const isNameInvalid = !isValidColorName(record.baseName);
        
        // Validación de NK contra tabla maestra
        const masterNks = (window.ALL_MASTER_NKS || []).map(n => n.toUpperCase());
        const currentNk = (record.nk || '').trim().toUpperCase();
        const isNkMissing = !currentNk || (masterNks.length > 0 && !masterNks.includes(currentNk));

        if (isNameInvalid || isNkMissing) {
            correctionsNeeded.push({ record: record, index: i });
        }
    }
    
    if (correctionsNeeded.length === 0) return { records: correctedRecords, corrected: false };
    
    alert(`⚠️ Se encontraron ${correctionsNeeded.length} nombres que requieren atención.`);
    
    for (let idx = 0; idx < correctionsNeeded.length; idx++) {
        const { record, index } = correctionsNeeded[idx];
        const originalName = record.name;
        const result = await showCorrectionModal(record, idx, correctionsNeeded.length, suggestedNk);
        
        if (!result) return { records: [], corrected: false };
        
        correctedRecords[index].baseName = result.newBaseName;
        correctedRecords[index].name = result.newFullName;
        correctedRecords[index].nk = result.newFullName.split(' ').pop().startsWith('NK') ? result.newFullName.split(' ').pop() : '';
        
        if (onCorrectionApplied) onCorrectionApplied(originalName, result.newFullName, result.reason);
        findAndCorrectInOtherArray(originalName, result.newBaseName, result.newFullName, fileType);
    }
    
    return { records: correctedRecords, corrected: true };
}