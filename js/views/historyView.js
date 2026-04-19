// js/views/historyView.js
export class HistoryView {
    constructor(app) {
        this.app = app;
        this.selectedId = null;
        console.log('✅ HistoryView inicializado');
    }

    render() {
        const listContainer = document.getElementById('historyList');
        if (!listContainer) return;

        const items = this.app.getInboxItems();
        if (!items.length) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <p>No hay registros en la bandeja</p>
                </div>
            `;
            return;
        }

        if (!this.selectedId || !items.some(i => i.id === this.selectedId)) {
            this.selectedId = items[0].id;
        }

        const selected = items.find(i => i.id === this.selectedId) || items[0];
        listContainer.innerHTML = `
            <div class="mail-layout">
                <div class="mail-list">
                    ${items.map(item => {
                        const isRead = item.is_read || item.read;
                        const date = item.created_at || item.createdAt;
                        return `
                            <button class="mail-item ${item.id === selected.id ? 'active' : ''} ${isRead ? '' : 'unread'}" data-id="${item.id}">
                                <div class="mail-item-top">
                                    <span class="mail-subject">${this.escapeHtml(item.subject || 'Sin asunto')}</span>
                                    <span class="mail-date">${new Date(date).toLocaleDateString()}</span>
                                </div>
                                <div class="mail-meta">
                                    <span>🖨️ Plotter ${item.plotter || '-'}</span>
                                    <span>🎨 ${item.color_count || item.colorCount || 0} colores</span>
                                    ${isRead ? '' : '<span class="mail-unread-dot">● No leído</span>'}
                                </div>
                            </button>
                        `;
                    }).join('')}
                </div>
                <div class="mail-preview">
                    <div class="mail-preview-header">
                        <h4>${this.escapeHtml(selected.subject || 'Sin asunto')}</h4>
                        <div class="mail-preview-actions">
                            <button id="loadSecondaryBtn" class="btn-primary">🔄 Cargar Secundario</button>
                            <button id="markUnreadBtn" class="btn-secondary">📩 Marcar como no leído</button>
                        </div>
                    </div>
                    <div class="mail-preview-meta">
                        <span>📅 ${new Date(selected.created_at || selected.createdAt).toLocaleString()}</span>
                        <span>👤 ${this.escapeHtml(selected.created_by || selected.createdBy || 'usuario')}</span>
                        <span>🖨️ Plotter ${selected.plotter || '-'}</span>
                    </div>
                    <div class="mail-reason"><strong>Motivo:</strong> ${this.escapeHtml(selected.reason || 'Sin motivo')}</div>
                    <pre class="mail-content">${this.escapeHtml(selected.content || '')}</pre>
                </div>
            </div>
        `;

        if (!(selected.is_read || selected.read)) {
            this.app.markInboxAsRead(selected.id, true);
        }

        listContainer.querySelectorAll('.mail-item').forEach(btn => {
            btn.onclick = () => {
                this.selectedId = btn.dataset.id;
                this.render();
            };
        });

        const loadSecondaryBtn = document.getElementById('loadSecondaryBtn');
        if (loadSecondaryBtn) {
            loadSecondaryBtn.onclick = () => this.app.loadInboxItemAsSecondary(selected.id);
        }

        const markUnreadBtn = document.getElementById('markUnreadBtn');
        if (markUnreadBtn) {
            markUnreadBtn.onclick = () => this.app.markInboxAsRead(selected.id, false);
        }
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
}