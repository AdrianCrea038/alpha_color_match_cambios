export class UIRenderer {
    constructor(app) {
        this.app = app;
        this.creatorRows = [];
        this.pendingActions = new Map();
    }
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = 'toast';
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
            undo: '↩️'
        };
        
        toast.innerHTML = `${icons[type] || 'ℹ️'} ${message}`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }
    
    escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    
    cmykToRgb(c, m, y, k) {
        const r = 255 * (1 - c / 100) * (1 - k / 100);
        const g = 255 * (1 - m / 100) * (1 - k / 100);
        const b = 255 * (1 - y / 100) * (1 - k / 100);
        return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    }
    
    renderComparisonTable(results, app) {
        const tbody = document.getElementById('tableBody');
        
        if (!results || results.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <div class="empty-icon">🔍</div>
                        <p>No se encontraron resultados</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = results.map((item, idx) => {
            const hasActionTaken = item.actionTaken === 'keep' || 
                                   item.actionTaken === 'replace' || 
                                   item.actionTaken === 'add' ||
                                   item.actionTaken === 'keep_missing' ||
                                   item.actionTaken === 'delete_missing' ||
                                   item.actionTaken === 'ignore_missing';
            
            let actionTakenText = '';
            if (item.actionTaken === 'keep') {
                actionTakenText = '🔒 Valor principal mantenido';
            } else if (item.actionTaken === 'replace') {
                actionTakenText = '🔄 Valor actualizado con secundario';
            } else if (item.actionTaken === 'add') {
                actionTakenText = '➕ Color agregado';
            } else if (item.actionTaken === 'keep_missing') {
                actionTakenText = '💾 Color mantenido en principal';
            } else if (item.actionTaken === 'delete_missing') {
                actionTakenText = '🗑️ Color eliminado de principal';
            } else if (item.actionTaken === 'ignore_missing') {
                actionTakenText = '⏭️ Color ignorado';
            }
            
            let statusClass = '';
            let statusText = '';
            if (item.status === 'match') {
                statusClass = 'status-match';
                statusText = '✅ Coincidencia exacta';
            } else if (item.status === 'diff') {
                statusClass = 'status-diff';
                statusText = '⚠️ Valores diferentes';
            } else {
                statusClass = 'status-missing';
                statusText = '❌ NO ENCONTRADO';
            }
            
            let diffHighlight = '';
            if (item.status === 'diff') {
                diffHighlight = 'diff-highlight';
            } else if (item.status === 'missing') {
                diffHighlight = 'missing-highlight';
            }
            
            let diffSeverityClass = '';
            if (item.status === 'diff' && item.diffPercentage) {
                const diffPct = parseFloat(item.diffPercentage);
                if (diffPct < 5) diffSeverityClass = 'diff-severity-low';
                else if (diffPct < 15) diffSeverityClass = 'diff-severity-medium';
                else diffSeverityClass = 'diff-severity-high';
            }
            
            let swatchColor = '#2d3748';
            let cmykValues = null;
            
            if (item.status === 'missing') {
                if (item.cmykSecondary && Array.isArray(item.cmykSecondary) && item.cmykSecondary.length >= 4) {
                    cmykValues = item.cmykSecondary;
                    swatchColor = this.cmykToRgb(cmykValues[0], cmykValues[1], cmykValues[2], cmykValues[3]);
                } else if (item.cmykPrimary && Array.isArray(item.cmykPrimary) && item.cmykPrimary.length >= 4) {
                    cmykValues = item.cmykPrimary;
                    swatchColor = this.cmykToRgb(cmykValues[0], cmykValues[1], cmykValues[2], cmykValues[3]);
                }
            } else {
                const cmykForSwatch = item.cmykPrimary || item.cmykSecondary;
                if (cmykForSwatch && Array.isArray(cmykForSwatch) && cmykForSwatch.length >= 4) {
                    cmykValues = cmykForSwatch;
                    swatchColor = this.cmykToRgb(cmykValues[0], cmykValues[1], cmykValues[2], cmykValues[3]);
                }
            }
            
            let tooltipText = '';
            if (cmykValues && cmykValues.length >= 4) {
                tooltipText = `CMYK: ${cmykValues.map(v => v.toFixed(1)).join(', ')}`;
            } else {
                tooltipText = 'Sin datos CMYK';
            }
            
            let nameDisplay = '';
            if (item.areEquivalent && item.primaryName && item.secondaryName && item.primaryName !== item.secondaryName) {
                nameDisplay = `
                    <div class="equivalent-names">
                        <strong>📁 Principal:</strong> ${this.escapeHtml(item.primaryName)}<br>
                        <strong>🔄 Secundario:</strong> ${this.escapeHtml(item.secondaryName)}
                        <br><small style="color:#fbbf24;">✨ Son equivalentes (mismo color)</small>
                    </div>
                `;
            } else if (item.originalName && item.originalName !== item.name) {
                nameDisplay = `
                    <strong>${this.escapeHtml(item.name)}</strong>
                    <br><small style="color:#888;">↳ Original: ${this.escapeHtml(item.originalName)}</small>
                `;
            } else {
                nameDisplay = `<strong>${this.escapeHtml(item.name)}</strong>`;
            }
            
            let cmykDisplay = '';
            if (item.status === 'missing') {
                if (item.cmykSecondary && Array.isArray(item.cmykSecondary) && item.cmykSecondary.length >= 4) {
                    cmykDisplay = `
                        <div class="cmyk-comparison">
                            <div class="cmyk-secondary">
                                <strong>📁 Secundario:</strong><br>
                                C:${item.cmykSecondary[0].toFixed(1)} M:${item.cmykSecondary[1].toFixed(1)} Y:${item.cmykSecondary[2].toFixed(1)} K:${item.cmykSecondary[3].toFixed(1)}
                            </div>
                            <div class="cmyk-primary missing">
                                <strong>⚠️ No encontrado en archivo principal</strong>
                            </div>
                        </div>
                    `;
                } else if (item.cmykPrimary && Array.isArray(item.cmykPrimary) && item.cmykPrimary.length >= 4) {
                    cmykDisplay = `
                        <div class="cmyk-comparison">
                            <div class="cmyk-primary">
                                <strong>📁 Principal:</strong><br>
                                C:${item.cmykPrimary[0].toFixed(1)} M:${item.cmykPrimary[1].toFixed(1)} Y:${item.cmykPrimary[2].toFixed(1)} K:${item.cmykPrimary[3].toFixed(1)}
                            </div>
                            <div class="cmyk-secondary missing">
                                <strong>⚠️ No encontrado en archivo secundario</strong>
                            </div>
                        </div>
                    `;
                }
            } else if (item.cmykPrimary && item.cmykSecondary) {
                cmykDisplay = `
                    <div class="cmyk-comparison">
                        <div class="cmyk-primary ${item.status === 'diff' && !hasActionTaken ? 'diff-value' : ''}">
                            <strong>📁 Principal (Referencia):</strong><br>
                            C:${item.cmykPrimary[0].toFixed(1)} M:${item.cmykPrimary[1].toFixed(1)} Y:${item.cmykPrimary[2].toFixed(1)} K:${item.cmykPrimary[3].toFixed(1)}
                        </div>
                        <div class="cmyk-secondary ${item.status === 'diff' && !hasActionTaken ? 'diff-value' : ''}">
                            <strong>🔄 Secundario (Comparar):</strong><br>
                            C:${item.cmykSecondary[0].toFixed(1)} M:${item.cmykSecondary[1].toFixed(1)} Y:${item.cmykSecondary[2].toFixed(1)} K:${item.cmykSecondary[3].toFixed(1)}
                        </div>
                    </div>
                `;
            }
            
            let labDisplay = '';
            if (item.status !== 'missing' && item.labPrimary && item.labSecondary) {
                labDisplay = `
                    <div class="lab-comparison">
                        <div class="lab-primary">
                            📁 L:${item.labPrimary[0].toFixed(1)} a:${item.labPrimary[1].toFixed(1)} b:${item.labPrimary[2].toFixed(1)}
                        </div>
                        <div class="lab-secondary">
                            🔄 L:${item.labSecondary[0].toFixed(1)} a:${item.labSecondary[1].toFixed(1)} b:${item.labSecondary[2].toFixed(1)}
                        </div>
                    </div>
                `;
            } else if (item.status === 'missing') {
                if (item.labSecondary && Array.isArray(item.labSecondary) && item.labSecondary.length >= 3) {
                    labDisplay = `
                        <div class="lab-secondary">
                            🔄 L:${item.labSecondary[0].toFixed(1)} a:${item.labSecondary[1].toFixed(1)} b:${item.labSecondary[2].toFixed(1)}
                        </div>
                    `;
                } else if (item.labPrimary && Array.isArray(item.labPrimary) && item.labPrimary.length >= 3) {
                    labDisplay = `
                        <div class="lab-primary">
                            📁 L:${item.labPrimary[0].toFixed(1)} a:${item.labPrimary[1].toFixed(1)} b:${item.labPrimary[2].toFixed(1)}
                        </div>
                    `;
                }
            }
            
            const diffDetails = item.diffDetails && !hasActionTaken && item.status === 'diff' ? 
                `<div class="diff-details">
                    📊 Diferencia: C:${item.diffDetails.cyan} | M:${item.diffDetails.magenta} | Y:${item.diffDetails.yellow} | K:${item.diffDetails.black}
                    <br>📈 Total: ${item.diffDetails.total}%
                </div>` : '';
            
            const message = item.message ? 
                `<div class="error-message">${this.escapeHtml(item.message)}</div>` : '';
            
            const actionTakenHtml = actionTakenText ? 
                `<div class="action-taken">${actionTakenText}</div>` : '';
            
            let actions = '';
            
            if (hasActionTaken) {
                actions = `
                    <div class="action-buttons-cell">
                        <button class="small-btn btn-undo" onclick="window.app.showUndoDialog('${item.id}', '${item.actionTaken}')">
                            ↩️ Deshacer (${item.actionTaken === 'keep' ? 'Mantener' : item.actionTaken === 'replace' ? 'Reemplazar' : item.actionTaken === 'add' ? 'Agregar' : item.actionTaken === 'keep_missing' ? 'Mantener' : item.actionTaken === 'delete_missing' ? 'Eliminar' : 'Ignorar'})
                        </button>
                    </div>
                `;
            } else if (item.status === 'diff') {
                actions = `
                    <div class="action-buttons-cell">
                        <button class="small-btn btn-replace" onclick="window.app.showReplaceConfirm('${item.id}')">
                            🔄 Reemplazar con valor secundario
                        </button>
                        <button class="small-btn btn-keep" onclick="window.app.showKeepConfirm('${item.id}')">
                            💾 Mantener valor principal
                        </button>
                    </div>
                `;
            } else if (item.status === 'missing') {
                if (item.cmykPrimary && !item.cmykSecondary) {
                    actions = `
                        <div class="action-buttons-cell">
                            <button class="small-btn btn-keep" onclick="window.app.showKeepMissingConfirm('${item.id}')">
                                💾 Mantener en principal
                            </button>
                            <button class="small-btn btn-danger" onclick="window.app.showDeleteMissingConfirm('${item.id}')">
                                🗑️ Eliminar de principal
                            </button>
                        </div>
                    `;
                } else if (item.cmykSecondary && !item.cmykPrimary) {
                    actions = `
                        <div class="action-buttons-cell">
                            <button class="small-btn btn-success" onclick="window.app.showAddConfirm('${item.id}')">
                                ➕ Agregar a principal
                            </button>
                            <button class="small-btn btn-secondary" onclick="window.app.showIgnoreConfirm('${item.id}')">
                                ⏭️ Ignorar
                            </button>
                        </div>
                    `;
                }
            }
            
            return `
                <tr class="${diffHighlight} ${diffSeverityClass}" data-color-id="${item.id}">
                    <td><strong>${item.id}</strong></td>
                    <td>
                        <div class="color-swatch" style="background: ${swatchColor};" 
                             data-tooltip="${this.escapeHtml(tooltipText)}">
                        </div>
                    </td>
                    <td>${nameDisplay}</td>
                    <td>${cmykDisplay}</td>
                    <td>${labDisplay}</td>
                    <td>
                        <span class="${statusClass}">${statusText}</span>
                        ${diffDetails}
                        ${message}
                        ${actionTakenHtml}
                        ${item.recommendation && !hasActionTaken && item.status !== 'missing' ? `<div class="recommendation">💡 ${item.recommendation}</div>` : ''}
                    </td>
                    <td>${actions}</td>
                </tr>
            `;
        }).join('');
        
        window.app = app;
    }
    
    showUndoModal(colorId, actionType, onConfirm) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>↩️ Deshacer acción</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Estás a punto de deshacer la acción: <strong>${actionType === 'keep' ? 'Mantener valor principal' : actionType === 'replace' ? 'Reemplazar con valor secundario' : actionType === 'add' ? 'Agregar color' : actionType === 'keep_missing' ? 'Mantener color faltante' : actionType === 'delete_missing' ? 'Eliminar color faltante' : 'Ignorar color'}</strong></p>
                    <p>Color: <strong>${colorId}</strong></p>
                    <div class="form-group">
                        <label for="undoReason">Motivo del cambio (opcional):</label>
                        <textarea id="undoReason" class="undo-reason-input" rows="3" placeholder="Ej: Me equivoqué, el color correcto era otro..."></textarea>
                    </div>
                    <div class="modal-buttons">
                        <button class="btn btn-secondary cancel-undo">Cancelar</button>
                        <button class="btn btn-warning confirm-undo">Confirmar deshacer</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.cancel-undo').onclick = closeModal;
        
        const reasonTextarea = modal.querySelector('#undoReason');
        const confirmBtn = modal.querySelector('.confirm-undo');
        
        confirmBtn.onclick = () => {
            const reason = reasonTextarea.value.trim();
            onConfirm(reason);
            closeModal();
        };
        
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };
    }
    
    showReplaceConfirm(colorId, onConfirm) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🔄 Confirmar reemplazo</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p>¿Estás seguro de reemplazar el color <strong>${colorId}</strong>?</p>
                    <p>Los valores CMYK del archivo secundario reemplazarán a los del archivo principal.</p>
                    <div class="form-group">
                        <label for="replaceReason">Motivo del cambio (opcional):</label>
                        <textarea id="replaceReason" class="undo-reason-input" rows="2" placeholder="Ej: El nuevo valor es más preciso..."></textarea>
                    </div>
                    <div class="modal-buttons">
                        <button class="btn btn-secondary cancel-replace">Cancelar</button>
                        <button class="btn btn-primary confirm-replace">Confirmar reemplazo</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.cancel-replace').onclick = closeModal;
        
        const reasonTextarea = modal.querySelector('#replaceReason');
        const confirmBtn = modal.querySelector('.confirm-replace');
        
        confirmBtn.onclick = () => {
            const reason = reasonTextarea.value.trim();
            onConfirm(reason);
            closeModal();
        };
        
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };
    }
    
    showKeepConfirm(colorId, onConfirm) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>💾 Confirmar mantener valor</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p>¿Estás seguro de mantener el valor principal del color <strong>${colorId}</strong>?</p>
                    <p>Se conservarán los valores CMYK del archivo principal.</p>
                    <div class="form-group">
                        <label for="keepReason">Motivo de la decisión (opcional):</label>
                        <textarea id="keepReason" class="undo-reason-input" rows="2" placeholder="Ej: El valor principal es el correcto..."></textarea>
                    </div>
                    <div class="modal-buttons">
                        <button class="btn btn-secondary cancel-keep">Cancelar</button>
                        <button class="btn btn-primary confirm-keep">Confirmar</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.cancel-keep').onclick = closeModal;
        
        const reasonTextarea = modal.querySelector('#keepReason');
        const confirmBtn = modal.querySelector('.confirm-keep');
        
        confirmBtn.onclick = () => {
            const reason = reasonTextarea.value.trim();
            onConfirm(reason);
            closeModal();
        };
        
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };
    }
    
    showAddConfirm(colorId, colorName, onConfirm) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>➕ Confirmar agregar color</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p>¿Agregar el color <strong>${colorName}</strong> a la referencia principal?</p>
                    <div class="form-group">
                        <label for="addReason">Motivo de la adición (opcional):</label>
                        <textarea id="addReason" class="undo-reason-input" rows="2" placeholder="Ej: Nuevo color necesario para el proyecto..."></textarea>
                    </div>
                    <div class="modal-buttons">
                        <button class="btn btn-secondary cancel-add">Cancelar</button>
                        <button class="btn btn-success confirm-add">Agregar color</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.cancel-add').onclick = closeModal;
        
        const reasonTextarea = modal.querySelector('#addReason');
        const confirmBtn = modal.querySelector('.confirm-add');
        
        confirmBtn.onclick = () => {
            const reason = reasonTextarea.value.trim();
            onConfirm(reason);
            closeModal();
        };
        
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };
    }
    
    showKeepMissingConfirm(colorId, colorName, onConfirm) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>💾 Confirmar mantener color</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p>¿Mantener el color <strong>${colorName}</strong> en el archivo principal?</p>
                    <p>Este color no existe en el archivo secundario.</p>
                    <div class="form-group">
                        <label for="keepReason">Motivo (opcional):</label>
                        <textarea id="keepReason" class="undo-reason-input" rows="2" placeholder="Ej: Este color es necesario..."></textarea>
                    </div>
                    <div class="modal-buttons">
                        <button class="btn btn-secondary cancel-keep">Cancelar</button>
                        <button class="btn btn-primary confirm-keep">Mantener</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.cancel-keep').onclick = closeModal;
        
        const reasonTextarea = modal.querySelector('#keepReason');
        const confirmBtn = modal.querySelector('.confirm-keep');
        
        confirmBtn.onclick = () => {
            const reason = reasonTextarea.value.trim();
            onConfirm(reason);
            closeModal();
        };
        
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };
    }
    
    showDeleteMissingConfirm(colorId, colorName, onConfirm) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🗑️ Confirmar eliminar color</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p>¿Eliminar el color <strong>${colorName}</strong> del archivo principal?</p>
                    <p>Este color no existe en el archivo secundario.</p>
                    <div class="form-group">
                        <label for="deleteReason">Motivo (opcional):</label>
                        <textarea id="deleteReason" class="undo-reason-input" rows="2" placeholder="Ej: Color obsoleto..."></textarea>
                    </div>
                    <div class="modal-buttons">
                        <button class="btn btn-secondary cancel-delete">Cancelar</button>
                        <button class="btn btn-danger confirm-delete">Eliminar</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.cancel-delete').onclick = closeModal;
        
        const reasonTextarea = modal.querySelector('#deleteReason');
        const confirmBtn = modal.querySelector('.confirm-delete');
        
        confirmBtn.onclick = () => {
            const reason = reasonTextarea.value.trim();
            onConfirm(reason);
            closeModal();
        };
        
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };
    }
    
    showIgnoreConfirm(colorId, colorName, onConfirm) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>⏭️ Confirmar ignorar color</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p>¿Ignorar el color <strong>${colorName}</strong>?</p>
                    <p>Este color solo existe en el archivo secundario y no se agregará al principal.</p>
                    <div class="form-group">
                        <label for="ignoreReason">Motivo (opcional):</label>
                        <textarea id="ignoreReason" class="undo-reason-input" rows="2" placeholder="Ej: No es necesario..."></textarea>
                    </div>
                    <div class="modal-buttons">
                        <button class="btn btn-secondary cancel-ignore">Cancelar</button>
                        <button class="btn btn-primary confirm-ignore">Ignorar</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.cancel-ignore').onclick = closeModal;
        
        const reasonTextarea = modal.querySelector('#ignoreReason');
        const confirmBtn = modal.querySelector('.confirm-ignore');
        
        confirmBtn.onclick = () => {
            const reason = reasonTextarea.value.trim();
            onConfirm(reason);
            closeModal();
        };
        
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };
    }
    
    renderHistory(history) {
        const container = document.getElementById('historyList');
        
        if (history.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <p>No hay historial de comparaciones</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = history.map(item => `
            <div class="history-item">
                <div style="display: flex; justify-content: space-between;">
                    <strong>${new Date(item.date).toLocaleString()}</strong>
                    <span class="history-date">ID: ${item.id}</span>
                </div>
                <div style="margin-top: 0.5rem; font-size: 0.85rem;">
                    <div>📁 Principal: ${item.primaryFile}</div>
                    <div>🔄 Secundario: ${item.secondaryFile}</div>
                </div>
                <div class="history-stats">
                    <span>✅ Coincidencias: ${item.stats.matches}</span>
                    <span>⚠️ Diferencias: ${item.stats.differences}</span>
                    <span>❌ No encontrados: ${item.stats.missing}</span>
                </div>
                ${item.actionsLog && item.actionsLog.length ? `
                    <details class="history-actions">
                        <summary>📝 Acciones realizadas (${item.actionsLog.length})</summary>
                        <div class="actions-log">
                            ${item.actionsLog.map(log => `
                                <div class="action-log-item">
                                    <span class="action-date">${new Date(log.timestamp).toLocaleTimeString()}</span>
                                    <span class="action-type ${log.type}">${log.type === 'keep' ? '💾 Mantener' : log.type === 'replace' ? '🔄 Reemplazar' : log.type === 'add' ? '➕ Agregar' : log.type === 'keep_missing' ? '💾 Mantener (falta)' : log.type === 'delete_missing' ? '🗑️ Eliminar' : log.type === 'ignore_missing' ? '⏭️ Ignorar' : '↩️ Deshacer'}</span>
                                    <span class="action-color">${log.colorId}: ${log.colorName}</span>
                                    ${log.reason ? `<span class="action-reason">📝 ${log.reason}</span>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </details>
                ` : ''}
            </div>
        `).join('');
    }
    
    initCreatorTable() {
        this.resetCreatorTable();
    }
    
    resetCreatorTable() {
        this.creatorRows = [this.createEmptyRow(1)];
        this.renderCreatorTable();
    }
    
    createEmptyRow(id) {
        return {
            id: id,
            name: '',
            cmyk: { c: 0, m: 0, y: 0, k: 0 },
            lab: { l: 0, a: 0, b: 0 }
        };
    }
    
    addCreatorRow() {
        const newId = this.creatorRows.length + 1;
        this.creatorRows.push(this.createEmptyRow(newId));
        this.renderCreatorTable();
    }
    
    renderCreatorTable() {
        const tbody = document.getElementById('creatorTableBody');
        const downloadBtn = document.getElementById('downloadTxtBtn');
        
        if (this.creatorRows.length === 0) {
            tbody.innerHTML = '发展<td colspan="10" class="empty-state">Agregue colores para comenzar</td>';

            downloadBtn.disabled = true;
            return;
        }
        
        tbody.innerHTML = this.creatorRows.map((row, idx) => `
            <tr>
                <td>${row.id}</td>
                <td><input type="text" value="${row.name.replace(/"/g, '&quot;')}" placeholder="Nombre del color" data-field="name" data-idx="${idx}"></td>
                <td><input type="number" step="0.1" value="${row.cmyk.c}" data-field="cmyk_c" data-idx="${idx}"></td>
                <td><input type="number" step="0.1" value="${row.cmyk.m}" data-field="cmyk_m" data-idx="${idx}"></td>
                <td><input type="number" step="0.1" value="${row.cmyk.y}" data-field="cmyk_y" data-idx="${idx}"></td>
                <td><input type="number" step="0.1" value="${row.cmyk.k}" data-field="cmyk_k" data-idx="${idx}"></td>
                <td><input type="number" step="0.1" value="${row.lab.l}" data-field="lab_l" data-idx="${idx}"></td>
                <td><input type="number" step="0.1" value="${row.lab.a}" data-field="lab_a" data-idx="${idx}"></td>
                <td><input type="number" step="0.1" value="${row.lab.b}" data-field="lab_b" data-idx="${idx}"></td>
                <td><button class="small-btn btn-delete" onclick="window.app.uiRenderer.removeCreatorRow(${idx})">🗑️</button></td>
            </tr>
        `).join('');
        
        downloadBtn.disabled = false;
        this.attachCreatorEvents();
    }
    
    attachCreatorEvents() {
        const inputs = document.querySelectorAll('#creatorTableBody input');
        inputs.forEach(input => {
            input.removeEventListener('input', this.handleCreatorInput);
            input.addEventListener('input', (e) => this.handleCreatorInput(e));
        });
    }
    
    handleCreatorInput(e) {
        const idx = parseInt(e.target.dataset.idx);
        const field = e.target.dataset.field;
        const value = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
        
        if (this.creatorRows[idx]) {
            if (field === 'name') {
                this.creatorRows[idx].name = value;
            } else if (field === 'cmyk_c') {
                this.creatorRows[idx].cmyk.c = value;
            } else if (field === 'cmyk_m') {
                this.creatorRows[idx].cmyk.m = value;
            } else if (field === 'cmyk_y') {
                this.creatorRows[idx].cmyk.y = value;
            } else if (field === 'cmyk_k') {
                this.creatorRows[idx].cmyk.k = value;
            } else if (field === 'lab_l') {
                this.creatorRows[idx].lab.l = value;
            } else if (field === 'lab_a') {
                this.creatorRows[idx].lab.a = value;
            } else if (field === 'lab_b') {
                this.creatorRows[idx].lab.b = value;
            }
        }
    }
    
    removeCreatorRow(idx) {
        this.creatorRows.splice(idx, 1);
        this.creatorRows.forEach((row, newIdx) => row.id = newIdx + 1);
        this.renderCreatorTable();
    }
    
    getCreatorData() {
        return this.creatorRows.filter(row => row.name.trim() !== '');
    }
}
