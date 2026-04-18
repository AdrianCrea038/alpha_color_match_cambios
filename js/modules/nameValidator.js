// js/modules/nameValidator.js
import { ALL_VALID_COLOR_NAMES } from '../core/constants.js';
import { normalizeSpaces, escapeHtml } from '../core/utils.js';
import { addCustomValidColorName, getCustomValidColorNames } from '../core/supabaseClient.js';

console.log('📋 Todos los nombres válidos cargados:', ALL_VALID_COLOR_NAMES.length);

let appInstance = null;
let validColorNamesLoaded = false;
const validColorNamesSet = new Set(ALL_VALID_COLOR_NAMES.map(name => normalizeSpaces(name).toUpperCase()));

export function setAppInstance(app) {
    appInstance = app;
}

export function isValidColorName(baseName) {
    const normalized = normalizeSpaces(baseName).toUpperCase();
    return validColorNamesSet.has(normalized);
}

function addNameToLocalCatalog(name) {
    const normalized = normalizeSpaces(name || '').toUpperCase();
    if (!normalized || validColorNamesSet.has(normalized)) return;
    validColorNamesSet.add(normalized);
    ALL_VALID_COLOR_NAMES.push(normalized);
    ALL_VALID_COLOR_NAMES.sort((a, b) => a.localeCompare(b));
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

function showCorrectionModal(colorData, index, totalInvalid) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.zIndex = '10001';
        
        let selectedValue = '';
        
        const renderSuggestions = (filterText) => {
            const suggestionsList = modal.querySelector('#suggestionsList');
            const filterLower = (filterText || '').toLowerCase();
            
            const matches = ALL_VALID_COLOR_NAMES.filter(name =>
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
            applyBtn.disabled = !(searchVal !== '' && reasonSelect.value !== '');
        };
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 550px; border: 2px solid #ff007f;">
                <div class="modal-header" style="background: linear-gradient(90deg, #ff007f, #b45309);">
                    <h3 style="color: white; margin:0;"><i class="fas fa-edit"></i> Corregir nombre (${index + 1}/${totalInvalid})</h3>
                    <button class="modal-close" style="color: white; background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                <div class="modal-body" style="padding: 1.5rem;">
                    <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 0.5rem; margin-bottom: 1.5rem; border-left: 4px solid #ff007f;">
                        <p style="margin:0 0 0.5rem;"><strong>Color mal escrito:</strong> <span style="color:#ff007f;">${escapeHtml(colorData.name)}</span></p>
                        <p style="margin:0;"><strong>NK:</strong> ${colorData.nk || 'N/A'}</p>
                    </div>

                    <div class="form-group" style="margin-bottom: 1.5rem; position: relative;">
                        <label style="display:block; margin-bottom:0.5rem; color:#9ca3af;">Buscar nombre correcto en la lista:</label>
                        <div style="position:relative;">
                            <input type="text" id="searchInput" placeholder="Escribe para buscar..." autocomplete="off" style="width:100%; padding:0.8rem; background:#0c0c12; border:1px solid #2d3748; border-radius:0.5rem; color:white; font-size:1rem;">
                        </div>
                        <div id="suggestionsList" style="max-height: 200px; overflow-y: auto; margin-top: 0.25rem; border-radius: 0.5rem; background: #1a1a2a; border: 1px solid #4b5563; display: none; position: absolute; z-index: 100; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.5);"></div>
                    </div>

                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label style="display:block; margin-bottom:0.5rem; color:#9ca3af;">Motivo de la corrección:</label>
                        <select id="correctionReason" style="width:100%; padding:0.8rem; background:#0c0c12; border:1px solid #2d3748; border-radius:0.5rem; color:white; font-size:1rem;">
                            <option value="" disabled selected>-- Selecciona un motivo --</option>
                            <option value="Mal escrito nombre">1. Mal escrito nombre</option>
                            <option value="Error en el CYMK">2. Error en el CYMK</option>
                            <option value="Color no encontrado">3. Color no encontrado</option>
                        </select>
                    </div>
                </div>
                <div class="modal-buttons" style="display: flex; gap: 1rem; justify-content: flex-end; padding: 1.5rem; background: rgba(0,0,0,0.2); border-top: 1px solid #2d3748;">
                    <button class="btn-secondary cancel-correction" style="padding: 0.8rem 1.5rem; cursor:pointer;">Cancelar</button>
                    <button class="btn-primary apply-correction" style="padding: 0.8rem 2rem; background:#ff007f !important; cursor:pointer;" disabled>✅ Aplicar Corrección</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const searchInput = modal.querySelector('#searchInput');
        const reasonSelect = modal.querySelector('#correctionReason');
        const applyBtn = modal.querySelector('.apply-correction');
        
        // PRE-LLENAR CON EL NOMBRE MAL ESCRITO
        searchInput.value = colorData.baseName || '';
        renderSuggestions(searchInput.value);
        
        searchInput.addEventListener('input', (e) => {
            renderSuggestions(e.target.value);
            validateForm();
        });
        
        reasonSelect.addEventListener('change', validateForm);
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        
        modal.querySelector('.modal-close').onclick = () => { closeModal(); resolve(null); };
        modal.querySelector('.cancel-correction').onclick = () => { closeModal(); resolve(null); };
        
        applyBtn.onclick = async () => {
            const finalName = (selectedValue || searchInput.value.trim()).toUpperCase();
            let exactMatch = ALL_VALID_COLOR_NAMES.find(n => n.toUpperCase() === finalName);
            
            if (!exactMatch) {
                if (confirm(`⚠️ "${finalName}" no está en la lista oficial.\n\n¿Desea agregarlo a la base de datos permanentemente?`)) {
                    const res = await addCustomValidColorName(finalName, appInstance?.auth?.getCurrentUser()?.username || 'usuario');
                    if (res.success) addNameToLocalCatalog(finalName);
                }
                exactMatch = finalName;
            }
            
            const newFullName = colorData.nk ? `${exactMatch} ${colorData.nk}` : exactMatch;
            closeModal();
            resolve({ newBaseName: exactMatch, newFullName, reason: reasonSelect.value });
        };
    });
}

export async function validateAndCorrectRecords(records, fileType, onCorrectionApplied) {
    await ensureValidColorCatalogLoaded();
    const correctedRecords = [...records];
    const correctionsNeeded = [];
    
    for (let i = 0; i < correctedRecords.length; i++) {
        if (!isValidColorName(correctedRecords[i].baseName)) {
            correctionsNeeded.push({ record: correctedRecords[i], index: i });
        }
    }
    
    if (correctionsNeeded.length === 0) return { records: correctedRecords, corrected: false };
    
    alert(`⚠️ Se encontraron ${correctionsNeeded.length} colores no válidos.`);
    
    for (let idx = 0; idx < correctionsNeeded.length; idx++) {
        const { record, index } = correctionsNeeded[idx];
        const originalName = record.name;
        const result = await showCorrectionModal(record, idx, correctionsNeeded.length);
        
        if (!result) return { records: [], corrected: false };
        
        correctedRecords[index].baseName = result.newBaseName;
        correctedRecords[index].name = result.newFullName;
        
        if (onCorrectionApplied) onCorrectionApplied(originalName, result.newFullName, result.reason);
        findAndCorrectInOtherArray(originalName, result.newBaseName, result.newFullName, fileType);
    }
    
    return { records: correctedRecords, corrected: true };
}