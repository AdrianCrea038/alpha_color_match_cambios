// ============================================================
// HISTORY VIEW - Bandeja de Entrada (antes Historial)
// ============================================================

export class HistoryView {
    constructor(app) {
        this.app = app;
        this.container = null;
        this.listContainer = null;
        
        this.init();
    }
    
    init() {
        this.container = document.getElementById('historyView');
        if (!this.container) return;
        
        this.listContainer = this.container.querySelector('#historyList');
        
        this.render();
        
        window.addEventListener('storage', (e) => {
            if (e.key === 'alphaColorMatchInbox') {
                this.render();
            }
        });
        
        console.log('✅ HistoryView (Bandeja) inicializado');
    }
    
    render() {
        if (!this.listContainer) return;
        
        const items = this.app ? this.app.getInboxItems() : [];
        
        if (items.length === 0) {
            this.listContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <p>No hay mensajes en la bandeja</p>
                </div>
            `;
            return;
        }
        
        this.listContainer.innerHTML = items.map(item => {
            const date = new Date(item.date);
            const dateStr = date.toLocaleString();
            const statusBadge = item.isRead 
                ? '<span class="status-badge read" style="background:#15803d; color:white; padding:0.2rem 0.5rem; border-radius:1rem; font-size:0.7rem;">✅ Leído</span>'
                : '<span class="status-badge unread" style="background:#b45309; color:white; padding:0.2rem 0.5rem; border-radius:1rem; font-size:0.7rem;">📩 No leído</span>';
            
            const actionButton = item.isRead
                ? `<button class="small-btn btn-mark-unread" data-id="${item.id}" style="background:#b45309; color:white;"><i class="fas fa-envelope"></i> Marcar como no leído</button>`
                : `<button class="small-btn btn-mark-read" data-id="${item.id}" style="background:#15803d; color:white;"><i class="fas fa-check-circle"></i> Marcar como leído</button>`;
            
            return `
                <div class="history-item" data-id="${item.id}">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                        <strong><i class="fas fa-file-alt"></i> ${this.escapeHtml(item.filename)}</strong>
                        ${statusBadge}
                    </div>
                    <div style="margin-top: 0.5rem; padding: 0.5rem; background: #1e1e2c; border-radius: 0.5rem;">
                        <div><strong>Enviado por:</strong> ${this.escapeHtml(item.user)}</div>
                        <div><strong>Fecha:</strong> ${dateStr}</div>
                        <div><strong>Plotter:</strong> ${item.plotter}</div>
                        <div><strong>Colores:</strong> ${item.colorCount}</div>
                        <div><strong>Motivo:</strong> ${this.escapeHtml(item.reason)}</div>
                    </div>
                    <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="small-btn btn-view-content" data-id="${item.id}" style="background:#2d3748; color:white;"><i class="fas fa-eye"></i> Ver contenido</button>
                        ${actionButton}
                        <button class="small-btn btn-load-to-secondary" data-id="${item.id}" style="background:#2d4ed6; color:white;"><i class="fas fa-upload"></i> Cargar a Secundario</button>
                    </div>
                </div>
            `;
        }).join('');
        
        this.attachEvents();
    }
    
    attachEvents() {
        this.listContainer.querySelectorAll('.btn-view-content').forEach(btn => {
            btn.onclick = () => {
                const id = parseInt(btn.dataset.id);
                const item = this.app.getInboxItems().find(i => i.id === id);
                if (item) {
                    this.showContentModal(item);
                }
            };
        });
        
        this.listContainer.querySelectorAll('.btn-mark-read').forEach(btn => {
            btn.onclick = () => {
                const id = parseInt(btn.dataset.id);
                this.app.markInboxAsRead(id);
                this.render();
            };
        });
        
        this.listContainer.querySelectorAll('.btn-mark-unread').forEach(btn => {
            btn.onclick = () => {
                const id = parseInt(btn.dataset.id);
                this.app.markInboxAsUnread(id);
                this.render();
            };
        });
        
        this.listContainer.querySelectorAll('.btn-load-to-secondary').forEach(btn => {
            btn.onclick = () => {
                const id = parseInt(btn.dataset.id);
                const item = this.app.getInboxItems().find(i => i.id === id);
                if (item) {
                    this.loadToSecondary(item);
                }
            };
        });
    }
    
    loadToSecondary(item) {
        if (this.app) {
            const success = this.app.loadSecondaryFromInbox(item.content, item.filename);
            if (success) {
                alert(`✅ Archivo "${item.filename}" cargado a Datos Secundario.\nAhora puedes hacer clic en COMPARAR.`);
            } else {
                alert('❌ Error al cargar el archivo a Datos Secundario.');
            }
        }
    }
    
    showContentModal(item) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px; max-height: 85vh;">
                <div class="modal-header" style="background: #2d4ed6;">
                    <h3 style="color: white;"><i class="fas fa-file-alt"></i> ${this.escapeHtml(item.filename)}</h3>
                    <button class="modal-close" style="color: white;">&times;</button>
                </div>
                <div class="modal-body" style="overflow: auto; max-height: 65vh;">
                    <div style="margin-bottom: 1rem; padding: 0.75rem; background: #1e1e2c; border-radius: 0.5rem;">
                        <strong>📊 Información:</strong><br>
                        Enviado por: ${this.escapeHtml(item.user)}<br>
                        Fecha: ${new Date(item.date).toLocaleString()}<br>
                        Plotter: ${item.plotter}<br>
                        Colores: ${item.colorCount}<br>
                        Motivo: ${this.escapeHtml(item.reason)}
                    </div>
                    <div style="font-family: monospace; font-size: 0.7rem; background: #0a0a0a; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; white-space: pre-wrap;">
                        <pre style="margin: 0; color: #e2e8f0;">${this.escapeHtml(item.content)}</pre>
                    </div>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-secondary close-modal" style="color:white;">Cerrar</button>
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
        modal.querySelector('.close-modal').onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    }
    
    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
}