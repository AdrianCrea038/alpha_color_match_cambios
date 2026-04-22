// js/modules/duplicateHandler.js
import { escapeHtml } from '../core/utils.js';

/**
 * Agrupa registros duplicados por baseName + NK
 */
export function findDuplicateGroups(records) {
    const groups = new Map();
    records.forEach((record, index) => {
        const key = `${(record.baseName || '').toUpperCase().trim()}||${(record.nk || '').toUpperCase().trim()}`;
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key).push({ ...record, originalIndex: index });
    });

    const duplicateGroups = [];
    for (const [key, items] of groups) {
        if (items.length > 1) {
            duplicateGroups.push({
                key,
                name: items[0].baseName,
                nk: items[0].nk,
                items: items
            });
        }
    }
    return duplicateGroups;
}

/**
 * Muestra un modal para que el usuario elija qué registro mantener de cada grupo de duplicados
 */
export function showDuplicateModal(duplicateGroups) {
    return new Promise((resolve) => {
        if (!duplicateGroups || duplicateGroups.length === 0) {
            resolve([]);
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.zIndex = '10002';
        
        const selections = new Map(); // key -> selectedIndex (in duplicateGroups[i].items)

        const renderModalContent = () => {
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 800px; border: 2px solid #00e5ff;">
                    <div class="modal-header" style="background: linear-gradient(90deg, #0099cc, #00e5ff);">
                        <h3 style="color: white; margin:0;"><i class="fas fa-copy"></i> Resolución de Duplicados</h3>
                        <p style="color: white; font-size: 0.8rem; margin: 5px 0 0 0;">Se encontraron ${duplicateGroups.length} grupos con nombres repetidos. Selecciona cuál deseas conservar.</p>
                    </div>
                    <div class="modal-body" style="padding: 1.5rem; max-height: 60vh; overflow-y: auto;">
                        ${duplicateGroups.map((group, gIdx) => `
                            <div class="duplicate-group-box" style="background: #1a1a2a; border: 1px solid #2d3748; border-radius: 8px; margin-bottom: 1.5rem; overflow: hidden;">
                                <div style="background: rgba(0, 229, 255, 0.1); padding: 0.75rem; border-bottom: 1px solid #2d3748;">
                                    <strong style="color: #00e5ff;">${escapeHtml(group.name)}</strong> 
                                    <span style="color: #9ca3af; font-size: 0.8rem; margin-left: 10px;">NK: ${escapeHtml(group.nk || 'N/A')}</span>
                                </div>
                                <div style="padding: 0.5rem;">
                                    <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                                        <thead>
                                            <tr style="text-align: left; color: #6b7280;">
                                                <th style="padding: 0.5rem;">Mantener</th>
                                                <th style="padding: 0.5rem;">Fila</th>
                                                <th style="padding: 0.5rem;">CMYK</th>
                                                <th style="padding: 0.5rem;">Lab</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${group.items.map((item, iIdx) => {
                                                const isSelected = selections.get(group.key) === iIdx;
                                                return `
                                                    <tr style="border-top: 1px solid #2d3748; cursor: pointer; background: ${isSelected ? 'rgba(0, 229, 255, 0.05)' : 'transparent'};" onclick="window.selectDuplicateItem('${group.key}', ${iIdx})">
                                                        <td style="padding: 0.75rem; text-align: center;">
                                                            <input type="radio" name="radio_${gIdx}" ${isSelected ? 'checked' : ''} style="cursor: pointer;">
                                                        </td>
                                                        <td style="padding: 0.75rem; color: #9ca3af;">#${item.id || item.originalIndex + 1}</td>
                                                        <td style="padding: 0.75rem; font-family: monospace;">
                                                            ${(item.cmyk || []).map(v => Number(v).toFixed(1)).join(' / ')}
                                                        </td>
                                                        <td style="padding: 0.75rem; font-family: monospace;">
                                                            ${(item.lab || []).map(v => Number(v).toFixed(1)).join(' / ')}
                                                        </td>
                                                    </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="modal-buttons" style="display: flex; gap: 1rem; justify-content: flex-end; padding: 1.5rem; background: rgba(0,0,0,0.2); border-top: 1px solid #2d3748;">
                        <button class="btn-primary confirm-duplicates" style="padding: 0.8rem 2rem; background:#00e5ff !important; color: #0a0a0a; cursor:pointer; border: none; border-radius: 0.5rem; font-weight: bold; transition: all 0.2s ease;">
                            <i class="fas fa-check"></i> CONFIRMAR SELECCIÓN
                        </button>
                    </div>
                </div>
            `;

            // Vincular evento de confirmación
            modal.querySelector('.confirm-duplicates').onclick = () => {
                if (selections.size < duplicateGroups.length) {
                    alert('⚠️ Por favor, selecciona un registro para cada grupo de duplicados.');
                    return;
                }
                
                const indicesToRemove = [];
                duplicateGroups.forEach(group => {
                    const selectedIdx = selections.get(group.key);
                    group.items.forEach((item, idx) => {
                        if (idx !== selectedIdx) {
                            indicesToRemove.push(item.originalIndex);
                        }
                    });
                });

                modal.classList.remove('active');
                setTimeout(() => modal.remove(), 300);
                resolve(indicesToRemove);
            };
        };

        // Inicializar selecciones (por defecto el primero de cada grupo)
        duplicateGroups.forEach(group => selections.set(group.key, 0));

        // Función global para manejar clics en la tabla
        window.selectDuplicateItem = (key, idx) => {
            selections.set(key, idx);
            renderModalContent();
        };

        document.body.appendChild(modal);
        renderModalContent();
    });
}
