export class HistoryView {
    constructor(app) {
        this.app = app;
        this.container = null;
        this.listContainer = null;
        this.detailContainer = null;
        this.detailEmpty = null;
        this.detailContent = null;
        this.layout = null;
        this.selectedId = null;
        
        this.init();
    }
    
    init() {
        this.container = document.getElementById('historyView');
        if (!this.container) return;
        
        this.listContainer = this.container.querySelector('#historyList');
        this.detailContainer = this.container.querySelector('#mailDetailContainer');
        this.detailEmpty = this.container.querySelector('#mailDetailEmpty');
        this.detailContent = this.container.querySelector('#mailDetailContent');
        this.layout = this.container.querySelector('#mailLayout');
        
        console.log('✅ HistoryView (Bandeja) sincronizado con Master-Detail');
    }
    
    render() {
        if (!this.listContainer) return;
        
        const items = this.app ? this.app.getInboxItems() : [];
        const badge = document.getElementById('mailCountBadge');
        if (badge) badge.textContent = items.length;
        
        if (items.length === 0) {
            this.listContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <p>No hay mensajes</p>
                </div>
            `;
            this.showEmpty();
            return;
        }
        
        this.listContainer.innerHTML = items.map(item => {
            const date = new Date(item.created_at || item.date);
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const isRead = item.is_read || item.read;
            const activeClass = this.selectedId === item.id ? 'active' : '';
            const unreadClass = !isRead ? 'unread' : '';
            
            return `
                <div class="mail-item ${activeClass} ${unreadClass}" data-id="${item.id}">
                    <div class="mail-item-header">
                        <span class="mail-item-title">${this.escapeHtml(item.subject || item.filename)}</span>
                        <span class="mail-item-date">${timeStr}</span>
                    </div>
                    <div class="mail-item-preview">
                        ${item.plotter ? `Plotter ${item.plotter} • ` : ''} ${this.escapeHtml(item.reason || 'Sin motivo')}
                    </div>
                </div>
            `;
        }).join('');
        
        this.attachEvents();
        
        // Si hay un item seleccionado, asegurarse de que se vea el detalle
        if (this.selectedId) {
            const selectedItem = items.find(i => String(i.id) === String(this.selectedId));
            if (selectedItem) this.showDetail(selectedItem);
        }
    }
    
    attachEvents() {
        this.listContainer.querySelectorAll('.mail-item').forEach(itemEl => {
            itemEl.onclick = () => {
                const id = itemEl.dataset.id;
                const items = this.app.getInboxItems();
                const item = items.find(i => String(i.id) === String(id));
                if (item) {
                    this.selectedId = item.id;
                    this.showDetail(item);
                    
                    // Marcar como leído
                    if (!(item.is_read || item.read)) {
                        this.app.markInboxAsRead(item.id, true);
                        itemEl.classList.remove('unread');
                    }
                    
                    // Actualizar clase activa
                    this.listContainer.querySelectorAll('.mail-item').forEach(el => el.classList.remove('active'));
                    itemEl.classList.add('active');
                }
            };
        });
    }
    
    showDetail(item) {
        if (!this.detailContent || !this.detailEmpty) return;
        
        this.detailEmpty.style.display = 'none';
        this.detailContent.style.display = 'flex';
        
        const date = new Date(item.created_at || item.date);
        
        this.detailContent.innerHTML = `
            <div class="mail-detail-header">
                <button class="btn-back-to-list" id="btnBackToList">
                    <i class="fas fa-arrow-left"></i> Volver a la lista
                </button>
                <div class="mail-detail-title">
                    <i class="fas fa-file-alt"></i> ${this.escapeHtml(item.subject || item.filename)}
                </div>
                <div class="mail-detail-meta">
                    <div><strong>De:</strong> ${this.escapeHtml(item.created_by || item.user || item.sender || 'Sistema')}</div>
                    <div><strong>Fecha:</strong> ${date.toLocaleString()}</div>
                    <div><strong>Plotter:</strong> ${item.plotter || 'N/A'} | <strong>Colores:</strong> ${item.color_count || item.colorCount || 0}</div>
                    <div style="margin-top: 0.5rem; color: #fbbf24;"><strong>Motivo:</strong> ${this.escapeHtml(item.reason || 'No especificado')}</div>
                </div>
            </div>
            <div class="mail-detail-body">
                <div class="mail-content-raw">${this.escapeHtml(item.content)}</div>
            </div>
            <div class="mail-detail-actions">
                <button class="btn-primary btn-load-to-secondary" data-id="${item.id}" style="background:#2d4ed6;">
                    <i class="fas fa-upload"></i> CARGAR A SECUNDARIO
                </button>
                <button class="btn-secondary btn-mark-unread" data-id="${item.id}">
                    <i class="fas fa-envelope"></i> Marcar como no leído
                </button>
            </div>
        `;
        
        if (this.layout) {
            this.layout.classList.add('showing-detail');
        }
        
        const backBtn = this.detailContent.querySelector('#btnBackToList');
        if (backBtn) {
            backBtn.onclick = () => {
                this.layout.classList.remove('showing-detail');
                this.selectedId = null;
                this.listContainer.querySelectorAll('.mail-item').forEach(el => el.classList.remove('active'));
            };
        }
        
        const loadBtn = this.detailContent.querySelector('.btn-load-to-secondary');
        if (loadBtn) {
            loadBtn.onclick = () => this.loadToSecondary(item);
        }
        
        const unreadBtn = this.detailContent.querySelector('.btn-mark-unread');
        if (unreadBtn) {
            unreadBtn.onclick = () => {
                this.app.markInboxAsRead(item.id, false);
                this.render();
                if (window.innerWidth <= 900) {
                    this.layout.classList.remove('showing-detail');
                }
            };
        }
    }
    
    showEmpty() {
        if (this.detailContent && this.detailEmpty) {
            this.detailContent.style.display = 'none';
            this.detailEmpty.style.display = 'flex';
        }
    }
    
    loadToSecondary(item) {
        if (this.app) {
            const success = this.app.loadInboxItemAsSecondary(item.id);
            if (success) {
                // El método loadInboxItemAsSecondary ya hace el switch y la notificación
            }
        }
    }
    
    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
}