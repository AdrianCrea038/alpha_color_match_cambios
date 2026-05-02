// js/modules/auditHandler.js
import { supabase } from '../core/supabaseClient.js';
import { revalidateRecord, addNameToLocalCatalog } from './nameValidator.js';
import { renderResults } from './resultsRenderer.js';

/**
 * Módulo para manejar la auditoría en vivo directamente en la tabla
 */

export function initAuditHandler(appInstance) {
    window.updateLiveAudit = (recordId, field, value) => {
        const audit = appInstance.pendingAudit.get(recordId);
        if (!audit) return;

        if (field === 'nk') audit.nk = value;
        if (field === 'name') audit.baseName = value;

        // Re-validar en tiempo real (opcional: solo feedback visual)
        const check = revalidateRecord(audit.baseName, audit.nk);
        audit.nameError = !check.isNameValid;
        audit.nkError = !check.isNkValid;

        // No renderizamos todo de nuevo en cada pulsación para no perder el foco
        // Pero podríamos actualizar clases CSS
    };

    window.showFamilySuggestions = async (recordId, input) => {
        const query = input.value.trim();
        const suggestionsBox = document.getElementById(`suggestions-${recordId}`);
        if (!suggestionsBox) return;

        if (query.length < 2) {
            suggestionsBox.style.display = 'none';
            return;
        }

        try {
            const { data, error } = await supabase
                .from('equivalencias')
                .select('grupo_id')
                .ilike('grupo_id', `%${query}%`)
                .limit(5);

            if (error || !data || data.length === 0) {
                suggestionsBox.style.display = 'none';
                return;
            }

            suggestionsBox.innerHTML = data.map(item => `
                <div class="suggestion-item" 
                     onclick="window.selectAuditFamily('${recordId}', '${item.grupo_id}')"
                     style="padding: 8px; cursor: pointer; border-bottom: 1px solid #334155;">
                    ${item.grupo_id}
                </div>
            `).join('');
            suggestionsBox.style.display = 'block';
        } catch (e) { console.error(e); }
    };

    window.selectAuditFamily = (recordId, groupId) => {
        const container = document.querySelector(`.family-audit-container`); // Simplificado
        const input = document.querySelector(`#suggestions-${recordId}`).previousElementSibling;
        const hidden = document.getElementById(`family-id-${recordId}`);
        const suggestionsBox = document.getElementById(`suggestions-${recordId}`);

        if (input) input.value = groupId;
        if (hidden) hidden.value = groupId;
        if (suggestionsBox) suggestionsBox.style.display = 'none';
        
        input.style.borderColor = '#10b981';
        input.style.borderStyle = 'solid';
    };

    window.saveSingleAudit = async (recordId) => {
        const audit = appInstance.pendingAudit.get(recordId);
        const familyId = document.getElementById(`family-id-${recordId}`)?.value;
        const btn = event?.target?.closest('button');

        if (!audit) return;
        if (!familyId) {
            alert('⚠️ Debes seleccionar una familia de la lista para registrar este color.');
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        try {
            // 1. Registrar NK si es necesario
            const check = revalidateRecord(audit.baseName, audit.nk);
            if (!check.isNkValid) {
                const { error: nkError } = await supabase.from('master_nks').insert([{ nk_code: audit.nk.toUpperCase() }]);
                if (nkError && !nkError.message.includes('duplicate')) {
                    throw new Error(`Error NK: ${nkError.message}`);
                }
            }

            // 2. Registrar Color en Equivalencias
            const { data: results } = await supabase.from('equivalencias').select('colores').eq('grupo_id', familyId);
            const existingRow = results && results.length > 0 ? results[0] : null;
            
            const newName = audit.baseName.toUpperCase().trim();
            if (existingRow) {
                const updatedColores = Array.isArray(existingRow.colores) ? [...existingRow.colores] : [];
                if (!updatedColores.includes(newName)) {
                    updatedColores.push(newName);
                    await supabase.from('equivalencias').update({ colores: updatedColores }).eq('grupo_id', familyId);
                }
            } else {
                await supabase.from('equivalencias').insert({ grupo_id: familyId, colores: [newName] });
            }

            // 3. Éxito: Limpiar de pendientes y actualizar tablas
            addNameToLocalCatalog(newName);
            appInstance.pendingAudit.delete(recordId);
            
            // Actualizar el registro original en la app
            const allData = [...appInstance.primaryData, ...appInstance.secondaryData];
            const original = allData.find(r => r.id === recordId);
            if (original) {
                original.baseName = newName;
                original.nk = audit.nk.toUpperCase();
                original.name = `${original.baseName} ${original.nk}`.trim();
            }

            // Re-comparar para que la fila "caiga" a su lugar correcto
            appInstance.compareFiles();
            
            window.showNotification('Auditado', 'Color registrado y validado correctamente.', 'success');
        } catch (e) {
            alert(`❌ Error al registrar: ${e.message}`);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-save"></i> REINTENTAR';
            }
        }
    };
}
