// ============================================================
// GROUP COLORS VIEW - Tabla de grupos de colores
// ============================================================

export class GroupColorsView {
    constructor(app) {
        this.app = app;
        this.groups = [];
        this.nextGroupId = 1;
        this.filterText = '';
        
        this.container = null;
        this.groupsContainer = null;
        this.searchInput = null;
        this.addGroupBtn = null;
        
        this.loadFromLocalStorage();
        this.init();
    }
    
    init() {
        this.container = document.getElementById('groupColorsView');
        if (!this.container) {
            console.error('❌ groupColorsView no encontrado en el DOM');
            return;
        }
        
        this.render();
        this.bindEvents();
        console.log('✅ GroupColorsView inicializado con', this.groups.length, 'grupos');
    }
    
    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('alphaColorMatchGroups');
            if (saved) {
                this.groups = JSON.parse(saved);
                if (this.groups.length > 0) {
                    this.nextGroupId = Math.max(...this.groups.map(g => g.id)) + 1;
                }
                console.log('📂 Grupos cargados:', this.groups.length);
            } else {
                this.groups = [];
                this.nextGroupId = 1;
                this.initializeDefaultGroups();
            }
        } catch(e) {
            console.error(e);
            this.groups = [];
            this.nextGroupId = 1;
            this.initializeDefaultGroups();
        }
    }
    
    initializeDefaultGroups() {
        if (this.app && this.app.equivalencyRows) {
            for (let i = 0; i < this.app.equivalencyRows.length; i++) {
                const row = this.app.equivalencyRows[i];
                if (row && row.length > 0) {
                    const groupName = this.normalizeGroupName(row[0]);
                    this.groups.push({
                        id: this.nextGroupId++,
                        name: groupName,
                        colors: [...row]
                    });
                }
            }
            this.saveToLocalStorage();
        }
    }
    
    normalizeGroupName(name) {
        if (!name) return 'UNKNOWN';
        return name.toUpperCase().replace(/\s+/g, ' ').trim();
    }
    
    saveToLocalStorage() {
        localStorage.setItem('alphaColorMatchGroups', JSON.stringify(this.groups));
        console.log('💾 Grupos guardados:', this.groups.length);
    }
    
    syncWithEquivalencyRows() {
        if (!this.app || !this.app.equivalencyRows) return;
        
        for (const row of this.app.equivalencyRows) {
            if (row && row.length > 0) {
                const groupName = this.normalizeGroupName(row[0]);
                const existingGroup = this.groups.find(g => g.name === groupName);
                
                if (existingGroup) {
                    existingGroup.colors = [...row];
                } else {
                    this.groups.push({
                        id: this.nextGroupId++,
                        name: groupName,
                        colors: [...row]
                    });
                }
            }
        }
        
        const validGroupNames = this.app.equivalencyRows.map(row => this.normalizeGroupName(row[0]));
        this.groups = this.groups.filter(g => validGroupNames.includes(g.name));
        
        this.saveToLocalStorage();
        this.render();
    }
    
    showDeleteColorModal(groupId, colorName) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 450px;">
                <div class="modal-header" style="background: #991b1b;">
                    <h3 style="color: white;">🗑️ Eliminar color</h3>
                    <button class="modal-close" style="color: white;">&times;</button>
                </div>
                <div class="modal-body">
                    <p><strong>Grupo:</strong> ${this.escapeHtml(group.name)}</p>
                    <p><strong>Color a eliminar:</strong> ${this.escapeHtml(colorName)}</p>
                    <div class="form-group" style="margin-top: 1rem;">
                        <label for="deleteReason">Motivo de la eliminación: <span style="color:#f87171;">*</span></label>
                        <textarea id="deleteReason" rows="3" placeholder="Ej: Color duplicado, ya no se usa, cliente solicitó cambio..." style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></textarea>
                    </div>
                    <p style="color: #fbbf24; font-size: 0.75rem;">⚠️ El motivo es obligatorio para eliminar el color.</p>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-secondary cancel-delete">Cancelar</button>
                    <button class="btn btn-danger confirm-delete" disabled>🗑️ Eliminar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        
        const reasonTextarea = modal.querySelector('#deleteReason');
        const confirmBtn = modal.querySelector('.confirm-delete');
        
        const validateReason = () => {
            const reason = reasonTextarea.value.trim();
            confirmBtn.disabled = reason === '';
            confirmBtn.style.opacity = reason === '' ? '0.5' : '1';
        };
        
        reasonTextarea.addEventListener('input', validateReason);
        reasonTextarea.addEventListener('change', validateReason);
        
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.cancel-delete').onclick = closeModal;
        
        confirmBtn.onclick = () => {
            const reason = reasonTextarea.value.trim();
            if (!reason) {
                alert('⚠️ Debe ingresar un motivo para eliminar el color.');
                return;
            }
            this.deleteColorFromGroup(groupId, colorName, reason);
            closeModal();
        };
    }
    
    deleteColorFromGroup(groupId, colorName, reason) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) return;
        
        const index = group.colors.indexOf(colorName);
        if (index !== -1) {
            group.colors.splice(index, 1);
            
            if (this.app && this.app.equivalencyRows) {
                for (let i = 0; i < this.app.equivalencyRows.length; i++) {
                    const row = this.app.equivalencyRows[i];
                    const rowGroupName = this.normalizeGroupName(row[0]);
                    if (rowGroupName === group.name) {
                        const colorIndex = row.indexOf(colorName);
                        if (colorIndex !== -1) {
                            row.splice(colorIndex, 1);
                            if (row.length === 0) {
                                this.app.equivalencyRows.splice(i, 1);
                            }
                            break;
                        }
                    }
                }
                this.app.saveEquivalencyRowsToLocalStorage();
                this.app.equivalenceMap = this.app.buildEquivalenceMap();
            }
            
            if (group.colors.length === 0) {
                const groupIndex = this.groups.findIndex(g => g.id === groupId);
                if (groupIndex !== -1) {
                    this.groups.splice(groupIndex, 1);
                }
            }
            
            this.saveToLocalStorage();
            this.render();
            
            if (this.app && this.app.developmentView) {
                this.app.developmentView.addHistoryEntry('DELETE_FROM_GROUP', `Color "${colorName}" eliminado del grupo "${group.name}"`, reason);
            }
            
            alert(`✅ Color "${colorName}" eliminado correctamente.\nMotivo: ${reason}`);
        }
    }
    
    showAddGroupModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 450px;">
                <div class="modal-header" style="background: #15803d;">
                    <h3 style="color: white;">➕ Crear nuevo grupo</h3>
                    <button class="modal-close" style="color: white;">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group" style="margin-top: 1rem;">
                        <label for="groupName">Nombre del grupo: <span style="color:#f87171;">*</span></label>
                        <input type="text" id="groupName" placeholder="Ej: NEON, METALLIC, PASTEL" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;">
                    </div>
                    <div class="form-group" style="margin-top: 1rem;">
                        <label for="groupColors">Colores (uno por línea):</label>
                        <textarea id="groupColors" rows="5" placeholder="Ej: NEON GREEN&#10;NEON YELLOW&#10;NEON PINK" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></textarea>
                    </div>
                    <div class="form-group" style="margin-top: 1rem;">
                        <label for="groupReason">Motivo de creación: <span style="color:#f87171;">*</span></label>
                        <textarea id="groupReason" rows="2" placeholder="Ej: Nuevo grupo para colores fluorescentes..." style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></textarea>
                    </div>
                    <p style="color: #fbbf24; font-size: 0.75rem;">⚠️ El motivo es obligatorio para crear el grupo.</p>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-secondary cancel-modal">Cancelar</button>
                    <button class="btn btn-primary confirm-modal" disabled>➕ Crear grupo</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        
        const groupNameInput = modal.querySelector('#groupName');
        const groupColorsTextarea = modal.querySelector('#groupColors');
        const groupReasonTextarea = modal.querySelector('#groupReason');
        const confirmBtn = modal.querySelector('.confirm-modal');
        
        const validateForm = () => {
            const groupName = groupNameInput.value.trim();
            const reason = groupReasonTextarea.value.trim();
            const isValid = groupName !== '' && reason !== '';
            confirmBtn.disabled = !isValid;
            confirmBtn.style.opacity = isValid ? '1' : '0.5';
        };
        
        groupNameInput.addEventListener('input', validateForm);
        groupReasonTextarea.addEventListener('input', validateForm);
        
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.cancel-modal').onclick = closeModal;
        
        confirmBtn.onclick = () => {
            const groupName = groupNameInput.value.trim().toUpperCase();
            const colorsText = groupColorsTextarea.value;
            const reason = groupReasonTextarea.value.trim();
            
            if (!groupName) {
                alert('⚠️ El nombre del grupo es obligatorio.');
                return;
            }
            if (!reason) {
                alert('⚠️ El motivo es obligatorio.');
                return;
            }
            
            if (this.groups.some(g => g.name === groupName)) {
                alert(`⚠️ El grupo "${groupName}" ya existe.`);
                return;
            }
            
            const colors = colorsText.split(/\r?\n/).filter(c => c.trim() !== '');
            
            const newGroup = {
                id: this.nextGroupId++,
                name: groupName,
                colors: colors.length > 0 ? colors : []
            };
            
            this.groups.push(newGroup);
            
            if (this.app && this.app.equivalencyRows) {
                if (colors.length > 0) {
                    this.app.equivalencyRows.push(colors);
                } else {
                    this.app.equivalencyRows.push([groupName]);
                }
                this.app.saveEquivalencyRowsToLocalStorage();
                this.app.equivalenceMap = this.app.buildEquivalenceMap();
            }
            
            this.saveToLocalStorage();
            this.render();
            
            if (this.app && this.app.developmentView) {
                this.app.developmentView.addHistoryEntry('CREATE_GROUP', `Nuevo grupo "${groupName}" creado con ${colors.length} colores`, reason);
            }
            
            alert(`✅ Grupo "${groupName}" creado correctamente.`);
            closeModal();
        };
    }
    
    filterGroups() {
        this.filterText = this.searchInput ? this.searchInput.value.trim().toLowerCase() : '';
        this.renderGroups();
    }
    
    renderGroups() {
        if (!this.groupsContainer) return;
        
        let filteredGroups = this.groups;
        
        if (this.filterText) {
            filteredGroups = this.groups.filter(group => {
                const matchesGroupName = group.name.toLowerCase().includes(this.filterText);
                const matchesGroupId = group.id.toString().includes(this.filterText);
                const matchesAnyColor = group.colors.some(color => color.toLowerCase().includes(this.filterText));
                return matchesGroupName || matchesGroupId || matchesAnyColor;
            });
        }
        
        if (filteredGroups.length === 0) {
            this.groupsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📁</div>
                    <p>No hay grupos de colores</p>
                    <p style="font-size: 0.7rem;">Haga clic en "➕ Nuevo grupo" para crear uno</p>
                </div>
            `;
            return;
        }
        
        this.groupsContainer.innerHTML = filteredGroups.map(group => `
            <div class="group-card" data-group-id="${group.id}">
                <div class="group-header">
                    <div class="group-header-left">
                        <span class="group-id-badge">ID: ${group.id}</span>
                        <strong class="group-name">${this.escapeHtml(group.name)}</strong>
                    </div>
                    <div class="group-header-right">
                        <span class="group-count">${group.colors.length} colores</span>
                    </div>
                </div>
                <div class="group-colors-list">
                    ${group.colors.map(color => `
                        <div class="group-color-item">
                            <span class="group-color-name">${this.escapeHtml(color)}</span>
                            <button class="delete-color-btn" data-group-id="${group.id}" data-color-name="${this.escapeHtml(color)}" title="Eliminar color">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
        
        this.attachDeleteEvents();
    }
    
    attachDeleteEvents() {
        this.groupsContainer.querySelectorAll('.delete-color-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const groupId = parseInt(btn.dataset.groupId);
                const colorName = btn.dataset.colorName;
                this.showDeleteColorModal(groupId, colorName);
            };
        });
    }
    
    render() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="group-colors-container">
                <div class="group-colors-header">
                    <h3><i class="fas fa-layer-group"></i> Grupos de colores</h3>
                    <button id="addGroupBtn" class="btn-primary"><i class="fas fa-plus"></i> Nuevo grupo</button>
                </div>
                
                <div class="group-colors-search">
                    <i class="fas fa-search"></i>
                    <input type="text" id="groupSearchInput" placeholder="Buscar por ID, grupo o color..." class="search-input">
                    <button id="clearSearchBtn" class="search-clear" title="Limpiar búsqueda">✖</button>
                </div>
                
                <div id="groupsListContainer" class="groups-list-container"></div>
            </div>
        `;
        
        this.groupsContainer = this.container.querySelector('#groupsListContainer');
        this.searchInput = this.container.querySelector('#groupSearchInput');
        this.addGroupBtn = this.container.querySelector('#addGroupBtn');
        const clearSearchBtn = this.container.querySelector('#clearSearchBtn');
        
        if (this.addGroupBtn) {
            this.addGroupBtn.onclick = () => this.showAddGroupModal();
        }
        
        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => this.filterGroups());
        }
        
        if (clearSearchBtn) {
            clearSearchBtn.onclick = () => {
                if (this.searchInput) this.searchInput.value = '';
                this.filterGroups();
            };
        }
        
        this.renderGroups();
    }
    
    bindEvents() {
        if (this.app && this.app.developmentView) {
            document.addEventListener('colorStatusChanged', () => {
                this.syncWithEquivalencyRows();
            });
        }
    }
    
    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
}