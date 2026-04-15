// js/modules/nameValidator.js
import { ALL_VALID_COLOR_NAMES } from '../core/constants.js';
import { normalizeSpaces, escapeHtml } from '../core/utils.js';

console.log('📋 Todos los nombres válidos cargados:', ALL_VALID_COLOR_NAMES.length);

// Variable global para acceder a los datos desde nameValidator
let appInstance = null;

export function setAppInstance(app) {
    appInstance = app;
}

export function isValidColorName(baseName) {
    const normalized = normalizeSpaces(baseName).toUpperCase();
    return ALL_VALID_COLOR_NAMES.includes(normalized);
}

function findAndCorrectInOtherArray(originalName, newBaseName, newFullName, currentFileType) {
    if (!appInstance) return;
    
    const otherArray = currentFileType === 'primary' ? appInstance.secondaryData : appInstance.primaryData;
    const otherArrayName = currentFileType === 'primary' ? 'secondaryData' : 'primaryData';
    
    if (!otherArray || otherArray.length === 0) return;
    
    let corrected = false;
    for (let i = 0; i < otherArray.length; i++) {
        const record = otherArray[i];
        if (record.name === originalName) {
            otherArray[i].baseName = newBaseName;
            otherArray[i].name = newFullName;
            corrected = true;
            console.log(`🔄 Corrección automática en ${otherArrayName}: "${originalName}" → "${newFullName}"`);
        }
    }
    
    if (corrected) {
        // Actualizar la interfaz del otro archivo
        if (currentFileType === 'primary') {
            if (appInstance.renderDataList) {
                appInstance.renderDataList('secondary', appInstance.secondaryData);
            }
            if (appInstance.updateFileInfo) {
                appInstance.updateFileInfo('secondary', 'Datos actualizados', appInstance.secondaryData.length);
            }
        } else {
            if (appInstance.renderDataList) {
                appInstance.renderDataList('primary', appInstance.primaryData);
            }
            if (appInstance.updateFileInfo) {
                appInstance.updateFileInfo('primary', 'Datos actualizados', appInstance.primaryData.length);
            }
        }
        
        // Guardar estado
        if (appInstance.saveCurrentState) {
            appInstance.saveCurrentState();
        }
    }
}

function showCorrectionModal(colorData, index, totalInvalid, onApply) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '10001';
        
        let selectedValue = '';
        
        const renderSuggestions = (filterText) => {
            const suggestionsList = modal.querySelector('#suggestionsList');
            if (!filterText || filterText.length < 1) {
                suggestionsList.style.display = 'none';
                return;
            }
            
            const filterLower = filterText.toLowerCase();
            const matches = ALL_VALID_COLOR_NAMES.filter(name => 
                name.toLowerCase().includes(filterLower)
            ).slice(0, 15);
            
            if (matches.length === 0) {
                suggestionsList.innerHTML = `<div style="padding: 0.5rem; color: #f87171; text-align: center;">No se encontraron coincidencias</div>`;
                suggestionsList.style.display = 'block';
                return;
            }
            
            const highlight = (text, search) => {
                if (!search) return escapeHtml(text);
                const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                return escapeHtml(text).replace(regex, '<span style="background: #eab308; color: #1a1a2a; padding: 0 0.2rem; border-radius: 0.2rem;">$1</span>');
            };
            
            suggestionsList.innerHTML = matches.map(name => `
                <div class="suggestion-item" data-value="${escapeHtml(name)}" style="padding: 0.5rem 0.8rem; cursor: pointer; border-bottom: 1px solid #2d3748;">
                    🔍 ${highlight(name, filterText)}
                </div>
            `).join('');
            suggestionsList.style.display = 'block';
            
            suggestionsList.querySelectorAll('.suggestion-item').forEach(item => {
                item.onclick = () => {
                    selectedValue = item.dataset.value;
                    const searchInput = modal.querySelector('#searchInput');
                    searchInput.value = selectedValue;
                    suggestionsList.style.display = 'none';
                    validateForm();
                };
                item.onmouseenter = () => { item.style.background = 'rgba(0, 229, 255, 0.2)'; };
                item.onmouseleave = () => { item.style.background = 'transparent'; };
            });
        };
        
        const validateForm = () => {
            const applyBtn = modal.querySelector('.apply-correction');
            const reasonInput = modal.querySelector('#correctionReason');
            const hasSelection = selectedValue !== '' || modal.querySelector('#searchInput').value.trim() !== '';
            const hasReason = reasonInput.value.trim() !== '';
            applyBtn.disabled = !(hasSelection && hasReason);
        };
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 550px;">
                <div class="modal-header" style="background: #b45309;">
                    <h3 style="color: white;">✏️ Corregir nombre de color (${index + 1}/${totalInvalid})</h3>
                    <button class="modal-close" style="color: white; background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                <div class="modal-body">
                    <p><strong>Color incorrecto:</strong> ${escapeHtml(colorData.name)}</p>
                    <p><strong>NK detectado:</strong> ${colorData.nk || 'Desconocido'}</p>
                    <div class="form-group" style="margin-top: 1rem; position: relative;">
                        <label>Buscar nombre correcto:</label>
                        <input type="text" id="searchInput" placeholder="Escribe para buscar..." autocomplete="off" style="width:100%; padding:0.6rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;">
                        <div id="suggestionsList" style="max-height: 200px; overflow-y: auto; margin-top: 0.25rem; border-radius: 0.4rem; background: #1a1a2a; border: 1px solid #4b5563; display: none; position: absolute; z-index: 100; width: calc(100% - 2rem);"></div>
                        <small style="color: #6b7280; display: block; margin-top: 0.25rem;">💡 Escribe para buscar. Las coincidencias aparecerán automáticamente.</small>
                    </div>
                    <div class="form-group" style="margin-top: 1rem;">
                        <label for="correctionReason">Motivo de la corrección (obligatorio):</label>
                        <textarea id="correctionReason" rows="3" placeholder="Ej: El color estaba mal escrito, faltaba TM, etc..." style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></textarea>
                    </div>
                    <p style="color: #fbbf24; font-size: 0.75rem; margin-top:0.5rem;">⚠️ El motivo es obligatorio. Solo puede seleccionar nombres de la lista.</p>
                </div>
                <div class="modal-buttons" style="display: flex; gap: 1rem; justify-content: flex-end; padding: 1rem; border-top: 1px solid #2d3748;">
                    <button class="btn btn-secondary cancel-correction" style="padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer;">Cancelar</button>
                    <button class="btn btn-primary apply-correction" style="padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; background: #b45309; color: white; border: none;" disabled>✅ Aplicar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const searchInput = modal.querySelector('#searchInput');
        const suggestionsList = modal.querySelector('#suggestionsList');
        const reasonInput = modal.querySelector('#correctionReason');
        const applyBtn = modal.querySelector('.apply-correction');
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.cancel-correction');
        
        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                renderSuggestions(e.target.value);
                validateForm();
            }, 200);
        });
        
        const validate = () => {
            const hasSelection = selectedValue !== '' || searchInput.value.trim() !== '';
            const hasReason = reasonInput.value.trim() !== '';
            applyBtn.disabled = !(hasSelection && hasReason);
        };
        
        reasonInput.addEventListener('input', validate);
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        
        closeBtn.onclick = () => {
            closeModal();
            resolve(null);
        };
        
        cancelBtn.onclick = () => {
            closeModal();
            resolve(null);
        };
        
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeModal();
                resolve(null);
            }
        };
        
        document.addEventListener('click', (e) => {
            if (!modal.contains(e.target)) return;
            if (e.target !== searchInput && !suggestionsList.contains(e.target)) {
                suggestionsList.style.display = 'none';
            }
        });
        
        applyBtn.onclick = () => {
            let finalName = selectedValue || searchInput.value.trim();
            if (!finalName) {
                alert('⚠️ Debe seleccionar un nombre válido.');
                return;
            }
            
            const exactMatch = ALL_VALID_COLOR_NAMES.find(n => n.toLowerCase() === finalName.toLowerCase());
            if (!exactMatch) {
                alert('⚠️ El nombre ingresado no es válido. Seleccione una de las sugerencias.');
                return;
            }
            
            const reason = reasonInput.value.trim();
            if (!reason) {
                alert('⚠️ Debe ingresar un motivo.');
                return;
            }
            
            const newFullName = colorData.nk ? `${exactMatch} ${colorData.nk}` : exactMatch;
            closeModal();
            resolve({ newBaseName: exactMatch, newFullName, reason, originalName: colorData.name });
        };
    });
}

export async function validateAndCorrectRecords(records, fileType, onCorrectionApplied) {
    const correctedRecords = [...records];
    const correctionsNeeded = [];
    
    for (let i = 0; i < correctedRecords.length; i++) {
        const record = correctedRecords[i];
        if (!isValidColorName(record.baseName)) {
            correctionsNeeded.push({ record, index: i });
        }
    }
    
    if (correctionsNeeded.length === 0) {
        return { records: correctedRecords, corrected: false };
    }
    
    alert(`⚠️ Se encontraron ${correctionsNeeded.length} colores con nombres no válidos en el archivo ${fileType === 'primary' ? 'PRINCIPAL' : 'SECUNDARIO'}.\n\nSe abrirá un cuadro para corregir cada uno.`);
    
    for (let idx = 0; idx < correctionsNeeded.length; idx++) {
        const { record, index } = correctionsNeeded[idx];
        const originalName = record.name;
        
        const result = await showCorrectionModal(record, idx, correctionsNeeded.length);
        
        if (!result) {
            alert('❌ Corrección cancelada. No se cargarán los datos.');
            return { records: [], corrected: false };
        }
        
        correctedRecords[index].baseName = result.newBaseName;
        correctedRecords[index].name = result.newFullName;
        
        if (onCorrectionApplied) {
            onCorrectionApplied(originalName, result.newFullName, result.reason);
        }
        
        // Buscar y corregir automáticamente en el otro archivo
        findAndCorrectInOtherArray(originalName, result.newBaseName, result.newFullName, fileType);
        
        console.log(`✅ Corregido: "${originalName}" → "${result.newFullName}"`);
    }
    
    alert(`✅ Todas las correcciones aplicadas. Se cargarán ${correctedRecords.length} colores.`);
    
    return { records: correctedRecords, corrected: true };
}