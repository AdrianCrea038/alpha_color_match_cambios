// js/modules/fusionWizard.js
import { escapeHtml } from '../core/utils.js';

/**
 * Muestra un asistente paso a paso para resolver conflictos de fusión
 */
export function showFusionWizard(results, groupSelections, selectedPending, deletedPending) {
    return new Promise((resolve) => {
        // Filtrar solo lo que requiere atención (no exactos)
        const conflicts = results.filter(r => r.matchType !== 'exact');
        
        if (conflicts.length === 0) {
            resolve(true);
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.zIndex = '10003';
        
        let currentIndex = 0;

        const renderWizard = () => {
            const item = conflicts[currentIndex];
            const isEquivalent = item.matchType === 'equivalent';
            const isPendingPrimary = item.matchType === 'pending_primary';
            const isPendingSecondary = item.matchType === 'pending_secondary';

            let title = '';
            let description = '';
            let icon = '';
            let colorClass = '';

            if (isEquivalent) {
                title = 'Conflicto de Datos';
                description = 'El NK ya existe en el Master, pero los datos (Nombre o CMYK) son diferentes.';
                icon = 'fas fa-exclamation-triangle';
                colorClass = '#fbbf24';
            } else if (isPendingPrimary) {
                title = 'Color Solo en Master';
                description = 'Este color existe en tu archivo original pero NO está en el de cambios.';
                icon = 'fas fa-history';
                colorClass = '#0099cc';
            } else if (isPendingSecondary) {
                title = 'Nuevo Color Detectado';
                description = 'Este color es nuevo y no existe en tu archivo Master.';
                icon = 'fas fa-plus-circle';
                colorClass = '#10b981';
            }

            modal.innerHTML = `
                <div class="modal-content" style="max-width: 650px; border: 2px solid ${colorClass};">
                    <div class="modal-header" style="background: ${colorClass}; color: #000;">
                        <h3 style="margin:0;"><i class="${icon}"></i> ${title}</h3>
                        <p style="margin: 5px 0 0 0; font-size: 0.85rem; opacity: 0.9;">Paso ${currentIndex + 1} de ${conflicts.length}</p>
                    </div>
                    <div class="modal-body" style="padding: 2rem; background: #0c0c12;">
                        <p style="color: #eef2ff; margin-bottom: 1.5rem; line-height: 1.5;">${description}</p>
                        
                        <div class="fusion-comparison-box" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;">
                            <!-- MASTER -->
                            <div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 8px; border: 1px solid ${item.primaryData ? 'rgba(0,153,204,0.3)' : '#2d3748'}; opacity: ${item.primaryData ? '1' : '0.4'}">
                                <small style="display:block; color:#9ca3af; margin-bottom: 0.5rem;">VALOR EN MASTER</small>
                                <strong style="display:block; color:white; font-size: 1rem;">${escapeHtml(item.primaryData?.name || '—')}</strong>
                                <span style="font-family: monospace; color: #00e5ff; font-size: 0.8rem;">
                                    ${item.primaryData ? item.primaryData.cmyk.map(v => v.toFixed(1)).join(' / ') : 'N/A'}
                                </span>
                            </div>

                            <!-- CAMBIOS -->
                            <div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 8px; border: 1px solid ${item.secondaryData ? 'rgba(16,185,129,0.3)' : '#2d3748'}; opacity: ${item.secondaryData ? '1' : '0.4'}">
                                <small style="display:block; color:#9ca3af; margin-bottom: 0.5rem;">VALOR EN CAMBIOS</small>
                                <strong style="display:block; color:white; font-size: 1rem;">${escapeHtml(item.secondaryData?.name || '—')}</strong>
                                <span style="font-family: monospace; color: #10b981; font-size: 0.8rem;">
                                    ${item.secondaryData ? item.secondaryData.cmyk.map(v => v.toFixed(1)).join(' / ') : 'N/A'}
                                </span>
                            </div>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 0.8rem;">
                            ${isEquivalent ? `
                                <button class="wizard-btn keep-master" style="background: #0099cc; color: white;">💎 MANTENER VALOR DEL MASTER</button>
                                <button class="wizard-btn use-changes" style="background: #fbbf24; color: black;">✏️ ACTUALIZAR CON EL NUEVO VALOR</button>
                            ` : ''}

                            ${isPendingPrimary ? `
                                <button class="wizard-btn keep-master" style="background: #0099cc; color: white;">✅ CONSERVAR EN EL ARCHIVO FINAL</button>
                                <button class="wizard-btn delete-item" style="background: #991b1b; color: white;">🗑️ ELIMINAR DEL ARCHIVO FINAL</button>
                            ` : ''}

                            ${isPendingSecondary ? `
                                <button class="wizard-btn use-changes" style="background: #10b981; color: white;">🚀 AÑADIR NUEVO COLOR</button>
                                <button class="wizard-btn delete-item" style="background: #4b5563; color: white;">🚫 IGNORAR Y NO AÑADIR</button>
                            ` : ''}
                        </div>
                    </div>
                    <div class="modal-footer" style="padding: 1rem; text-align: center; border-top: 1px solid #2d3748; background: rgba(0,0,0,0.2);">
                         <button class="skip-wizard" style="background: transparent; color: #6b7280; border: none; cursor: pointer; text-decoration: underline; font-size: 0.8rem;">Resolver el resto manualmente en la tabla</button>
                    </div>
                </div>
            `;

            // EVENTOS
            const next = () => {
                currentIndex++;
                if (currentIndex < conflicts.length) {
                    renderWizard();
                } else {
                    closeWizard();
                }
            };

            const wizardBtns = modal.querySelectorAll('.wizard-btn');
            wizardBtns.forEach(btn => {
                btn.onclick = () => {
                    if (btn.classList.contains('keep-master')) {
                        if (isEquivalent) groupSelections.set(item.groupId, 'primary');
                        if (isPendingPrimary) {
                            selectedPending.add(item.id);
                            deletedPending.delete(item.id);
                        }
                    } else if (btn.classList.contains('use-changes')) {
                        if (isEquivalent) groupSelections.set(item.groupId, 'secondary');
                        if (isPendingSecondary) {
                            selectedPending.add(item.id);
                            deletedPending.delete(item.id);
                        }
                    } else if (btn.classList.contains('delete-item')) {
                        if (isPendingPrimary || isPendingSecondary) {
                            deletedPending.add(item.id);
                            selectedPending.delete(item.id);
                        }
                    }
                    next();
                };
            });

            modal.querySelector('.skip-wizard').onclick = () => closeWizard();
        };

        const closeWizard = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
            resolve(true);
        };

        document.body.appendChild(modal);
        renderWizard();
    });
}
