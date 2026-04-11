// ============================================================
// DEVELOPMENT VIEW - Gestión de colores en desarrollo
// VERSIÓN CORREGIDA - Con estilos inline para las nuevas secciones
// ============================================================

export class DevelopmentView {
    constructor(app) {
        this.app = app;
        this.colors = [];
        this.nextId = 1;
        this.history = [];
        this.expandedGroups = new Set();
        this.selectedManagerGroup = '';
        
        this.container = null;
        this.pendingTableBody = null;
        this.groupsListContainer = null;
        this.managerGroupSelect = null;
        this.managerGroupColorsList = null;
        this.availableColorsContainer = null;
        
        this.loadFromLocalStorage();
        this.loadHistoryFromLocalStorage();
        this.init();
    }
    
    init() {
        this.container = document.getElementById('developmentView');
        if (!this.container) return;
        
        this.render();
        this.bindEvents();
        console.log('✅ DevelopmentView inicializado');
    }
    
    // ============================================================
    // SINCRONIZACIÓN CON TABLA PRINCIPAL
    // ============================================================
    
    syncFromEquivalencyRows() {
        if (!this.app || !this.app.equivalencyRows) return;
        
        const existingApprovedNames = new Set();
        
        for (const group of this.app.equivalencyRows) {
            if (!group || group.length === 0) continue;
            const groupName = group[0];
            
            for (const colorName of group) {
                existingApprovedNames.add(colorName);
                
                const existingColor = this.colors.find(c => c.name === colorName && c.group === groupName);
                if (existingColor) {
                    existingColor.approved = true;
                } else {
                    this.colors.push({
                        id: this.nextId++,
                        name: colorName,
                        nk: this.extractNKFromName(colorName),
                        cmyk: { c: 0, m: 0, y: 0, k: 0 },
                        lab: { l: 100, a: 0, b: 0 },
                        group: groupName,
                        approved: true,
                        createdAt: new Date().toISOString(),
                        modifiedAt: new Date().toISOString()
                    });
                }
            }
        }
        
        for (const color of this.colors) {
            if (color.approved && !existingApprovedNames.has(color.name)) {
                color.approved = false;
            }
        }
        
        this.saveToLocalStorage();
        this.renderAll();
    }
    
    syncToEquivalencyRows() {
        if (!this.app || !this.app.equivalencyRows) return;
        
        const approvedGroups = new Map();
        
        for (const color of this.colors) {
            if (!color.approved) continue;
            if (!approvedGroups.has(color.group)) {
                approvedGroups.set(color.group, []);
            }
            if (!approvedGroups.get(color.group).includes(color.name)) {
                approvedGroups.get(color.group).push(color.name);
            }
        }
        
        const newEquivalencyRows = [];
        for (const [groupName, colors] of approvedGroups) {
            if (colors.length > 0) {
                newEquivalencyRows.push(colors);
            }
        }
        
        this.app.equivalencyRows = newEquivalencyRows;
        this.app.saveEquivalencyRowsToLocalStorage();
        this.app.equivalenceMap = this.app.buildEquivalenceMap();
        
        if (this.app.creatorView) {
            this.app.creatorView.renderTable();
        }
    }
    
    extractNKFromName(fullName) {
        if (this.app && this.app.extractNK) {
            return this.app.extractNK(fullName) || 'NK001';
        }
        const match = fullName.match(/(NK\d+|T\d+|\d{4,8})$/i);
        return match ? match[1] : 'NK001';
    }
    
    normalizeName(name) {
        if (!name) return '';
        return name.toUpperCase().replace(/\s+/g, ' ').trim();
    }
    
    // ============================================================
    // PERSISTENCIA
    // ============================================================
    
    loadFromLocalStorage() {
        const saved = localStorage.getItem('developmentColors');
        if (saved) {
            try {
                this.colors = JSON.parse(saved);
                this.nextId = Math.max(...this.colors.map(c => c.id), 0) + 1;
            } catch(e) { 
                this.colors = [];
                this.nextId = 1;
            }
        } else {
            this.colors = [];
            this.nextId = 1;
        }
        
        setTimeout(() => this.syncFromEquivalencyRows(), 100);
    }
    
    saveToLocalStorage() {
        localStorage.setItem('developmentColors', JSON.stringify(this.colors));
        this.syncToEquivalencyRows();
    }
    
    loadHistoryFromLocalStorage() {
        const saved = localStorage.getItem('developmentHistory');
        if (saved) {
            try {
                this.history = JSON.parse(saved);
            } catch(e) { 
                this.history = [];
            }
        }
    }
    
    saveHistoryToLocalStorage() {
        localStorage.setItem('developmentHistory', JSON.stringify(this.history));
    }
    
    addHistoryEntry(action, details, reason = '') {
        const currentUser = this.app?.auth?.getCurrentUser()?.username || 'usuario';
        const entry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            user: currentUser,
            action: action,
            details: details,
            reason: reason
        };
        this.history.unshift(entry);
        if (this.history.length > 500) this.history = this.history.slice(0, 500);
        this.saveHistoryToLocalStorage();
    }
    
    // ============================================================
    // GESTIÓN DE COLORES PENDIENTES
    // ============================================================
    
    getPendingColors() {
        return this.colors.filter(c => !c.approved);
    }
    
    getApprovedColors() {
        return this.colors.filter(c => c.approved);
    }
    
    getAllGroups() {
        const groups = new Map();
        for (const color of this.colors) {
            if (!color.approved) continue;
            if (!groups.has(color.group)) {
                groups.set(color.group, []);
            }
            if (!groups.get(color.group).includes(color.name)) {
                groups.get(color.group).push(color.name);
            }
        }
        return groups;
    }
    
    addPendingColor(colorData = null) {
        const newId = this.nextId++;
        const newColor = {
            id: newId,
            name: colorData ? colorData.name : '',
            nk: colorData ? colorData.nk : '',
            cmyk: colorData ? { ...colorData.cmyk } : { c: 0, m: 0, y: 0, k: 0 },
            lab: colorData ? { ...colorData.lab } : { l: 100, a: 0, b: 0 },
            group: colorData ? colorData.group : '',
            approved: false,
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString()
        };
        this.colors.push(newColor);
        this.saveToLocalStorage();
        this.renderAll();
        return newColor;
    }
    
    updateColor(colorId, updates, reason = '') {
        const color = this.colors.find(c => c.id === colorId);
        if (!color) return;
        
        const oldName = color.name;
        const oldGroup = color.group;
        
        if (updates.name !== undefined) color.name = updates.name;
        if (updates.nk !== undefined) color.nk = updates.nk;
        if (updates.group !== undefined) color.group = updates.group;
        if (updates.cmyk) color.cmyk = { ...color.cmyk, ...updates.cmyk };
        if (updates.lab) color.lab = { ...color.lab, ...updates.lab };
        color.modifiedAt = new Date().toISOString();
        
        this.saveToLocalStorage();
        this.renderAll();
        this.addHistoryEntry('EDIT_PENDING', `Color "${oldName}" modificado`, reason);
    }
    
    deletePendingColor(colorId, reason = '') {
        const color = this.colors.find(c => c.id === colorId);
        if (!color) return;
        
        this.colors = this.colors.filter(c => c.id !== colorId);
        this.saveToLocalStorage();
        this.renderAll();
        this.addHistoryEntry('DELETE_PENDING', `Color "${color.name}" eliminado`, reason);
    }
    
    approveColor(colorId, reason = '') {
        const color = this.colors.find(c => c.id === colorId);
        if (!color) return;
        if (color.approved) {
            alert(`⚠️ "${color.name}" ya está aprobado.`);
            return;
        }
        
        if (!color.name || !color.group) {
            alert('❌ El color debe tener nombre y grupo asignado para ser aprobado.');
            return;
        }
        
        color.approved = true;
        this.saveToLocalStorage();
        this.renderAll();
        this.addHistoryEntry('APPROVE_COLOR', `Color "${color.name}" aprobado al grupo "${color.group}"`, reason);
        
        alert(`✅ "${color.name}" aprobado.`);
    }
    
    // ============================================================
    // GESTIÓN DE GRUPOS (Sección Crear/Editar ID)
    // ============================================================
    
    getColorsInGroup(groupName) {
        const groups = this.getAllGroups();
        return groups.get(groupName) || [];
    }
    
    addColorToGroup(colorName, groupName, reason = '') {
        const color = this.colors.find(c => c.name === colorName && c.approved === true);
        if (!color) {
            alert(`❌ El color "${colorName}" no existe o no está aprobado.`);
            return false;
        }
        
        const oldGroup = color.group;
        color.group = groupName;
        this.saveToLocalStorage();
        this.renderAll();
        this.addHistoryEntry('ADD_TO_GROUP', `Color "${colorName}" agregado al grupo "${groupName}"`, reason);
        return true;
    }
    
    removeColorFromGroup(colorName, groupName, reason = '') {
        const color = this.colors.find(c => c.name === colorName && c.group === groupName && c.approved === true);
        if (!color) {
            alert(`❌ El color "${colorName}" no existe en el grupo "${groupName}".`);
            return false;
        }
        
        color.approved = false;
        this.saveToLocalStorage();
        this.renderAll();
        this.addHistoryEntry('REMOVE_FROM_GROUP', `Color "${colorName}" removido del grupo "${groupName}"`, reason);
        return true;
    }
    
    renameGroup(oldName, newName, reason = '') {
        if (!oldName || !newName) return false;
        if (oldName === newName) return false;
        
        let changed = false;
        for (const color of this.colors) {
            if (color.approved && color.group === oldName) {
                color.group = newName;
                changed = true;
            }
        }
        
        if (changed) {
            this.saveToLocalStorage();
            this.renderAll();
            this.addHistoryEntry('RENAME_GROUP', `Grupo "${oldName}" renombrado a "${newName}"`, reason);
            alert(`✅ Grupo renombrado de "${oldName}" a "${newName}".`);
        }
        return changed;
    }
    
    // ============================================================
    // MODALES
    // ============================================================
    
    showAddPendingModal() {
        const groups = this.getAllGroups();
        const groupOptions = Array.from(groups.keys()).sort();
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 550px;">
                <div class="modal-header" style="background: #15803d;">
                    <h3 style="color: white;">➕ Agregar nuevo color pendiente</h3>
                    <button class="modal-close" style="color: white;">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Nombre del color:</label>
                        <input type="text" id="pendingColorName" placeholder="Ej: NEON GREEN" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;">
                    </div>
                    <div class="form-group" style="margin-top: 0.75rem;">
                        <label>NK:</label>
                        <input type="text" id="pendingColorNK" placeholder="Ej: NK001" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;">
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-top: 0.75rem;">
                        <div><label>C (%)</label><input type="number" id="pendingC" value="0" step="1" min="0" max="100" style="width:100%; padding:0.3rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></div>
                        <div><label>M (%)</label><input type="number" id="pendingM" value="0" step="1" min="0" max="100" style="width:100%; padding:0.3rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></div>
                        <div><label>Y (%)</label><input type="number" id="pendingY" value="0" step="1" min="0" max="100" style="width:100%; padding:0.3rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></div>
                        <div><label>K (%)</label><input type="number" id="pendingK" value="0" step="1" min="0" max="100" style="width:100%; padding:0.3rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></div>
                    </div>
                    <div class="form-group" style="margin-top: 0.75rem;">
                        <label>Grupo:</label>
                        <select id="pendingGroup" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;">
                            <option value="">-- Seleccionar grupo --</option>
                            ${groupOptions.map(g => `<option value="${this.escapeHtml(g)}">${this.escapeHtml(g)}</option>`).join('')}
                            <option value="__NEW__">+ Crear nuevo grupo...</option>
                        </select>
                    </div>
                    <div id="newGroupContainer" style="margin-top: 0.5rem; display: none;">
                        <input type="text" id="newGroupName" placeholder="Nombre del nuevo grupo" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;">
                    </div>
                    <div class="form-group" style="margin-top: 0.75rem;">
                        <label>Motivo:</label>
                        <textarea id="pendingReason" rows="2" placeholder="Motivo de la creación..." style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></textarea>
                    </div>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-secondary cancel-modal">Cancelar</button>
                    <button class="btn btn-primary confirm-modal">Agregar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        
        const groupSelect = modal.querySelector('#pendingGroup');
        const newGroupContainer = modal.querySelector('#newGroupContainer');
        
        groupSelect.addEventListener('change', (e) => {
            newGroupContainer.style.display = e.target.value === '__NEW__' ? 'block' : 'none';
        });
        
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.cancel-modal').onclick = closeModal;
        
        modal.querySelector('.confirm-modal').onclick = () => {
            const name = modal.querySelector('#pendingColorName').value.trim();
            const nk = modal.querySelector('#pendingColorNK').value.trim();
            const c = parseFloat(modal.querySelector('#pendingC').value) || 0;
            const m = parseFloat(modal.querySelector('#pendingM').value) || 0;
            const y = parseFloat(modal.querySelector('#pendingY').value) || 0;
            const k = parseFloat(modal.querySelector('#pendingK').value) || 0;
            const reason = modal.querySelector('#pendingReason').value.trim();
            
            let group = groupSelect.value;
            if (group === '__NEW__') {
                group = modal.querySelector('#newGroupName').value.trim().toUpperCase();
                if (!group) {
                    alert('⚠️ Debe ingresar un nombre para el nuevo grupo.');
                    return;
                }
            }
            
            if (!name) { alert('⚠️ Debe ingresar el nombre del color.'); return; }
            if (!nk) { alert('⚠️ Debe ingresar el NK.'); return; }
            if (!group) { alert('⚠️ Debe seleccionar un grupo.'); return; }
            if (!reason) { alert('⚠️ El motivo es obligatorio.'); return; }
            
            this.addPendingColor({
                name: name,
                nk: nk,
                group: group,
                cmyk: { c, m, y, k },
                lab: { l: 100, a: 0, b: 0 }
            });
            
            this.addHistoryEntry('ADD_PENDING', `Color "${name}" agregado a pendientes`, reason);
            closeModal();
        };
    }
    
    showEditPendingModal(color) {
        const groups = this.getAllGroups();
        const groupOptions = Array.from(groups.keys()).sort();
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 550px;">
                <div class="modal-header" style="background: #b45309;">
                    <h3 style="color: white;">✏️ Editar color pendiente</h3>
                    <button class="modal-close" style="color: white;">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Nombre del color:</label>
                        <input type="text" id="editColorName" value="${this.escapeHtml(color.name)}" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;">
                    </div>
                    <div class="form-group" style="margin-top: 0.75rem;">
                        <label>NK:</label>
                        <input type="text" id="editColorNK" value="${this.escapeHtml(color.nk)}" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;">
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-top: 0.75rem;">
                        <div><label>C (%)</label><input type="number" id="editC" value="${color.cmyk.c}" step="1" min="0" max="100" style="width:100%; padding:0.3rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></div>
                        <div><label>M (%)</label><input type="number" id="editM" value="${color.cmyk.m}" step="1" min="0" max="100" style="width:100%; padding:0.3rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></div>
                        <div><label>Y (%)</label><input type="number" id="editY" value="${color.cmyk.y}" step="1" min="0" max="100" style="width:100%; padding:0.3rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></div>
                        <div><label>K (%)</label><input type="number" id="editK" value="${color.cmyk.k}" step="1" min="0" max="100" style="width:100%; padding:0.3rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></div>
                    </div>
                    <div class="form-group" style="margin-top: 0.75rem;">
                        <label>Grupo:</label>
                        <select id="editGroup" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;">
                            <option value="">-- Seleccionar grupo --</option>
                            ${groupOptions.map(g => `<option value="${this.escapeHtml(g)}" ${color.group === g ? 'selected' : ''}>${this.escapeHtml(g)}</option>`).join('')}
                            <option value="__NEW__">+ Crear nuevo grupo...</option>
                        </select>
                    </div>
                    <div id="newGroupContainer" style="margin-top: 0.5rem; display: none;">
                        <input type="text" id="newGroupName" placeholder="Nombre del nuevo grupo" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;">
                    </div>
                    <div class="form-group" style="margin-top: 0.75rem;">
                        <label>Motivo del cambio:</label>
                        <textarea id="editReason" rows="2" placeholder="Motivo de la modificación..." style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></textarea>
                    </div>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-secondary cancel-modal">Cancelar</button>
                    <button class="btn btn-primary confirm-modal">Guardar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        
        const groupSelect = modal.querySelector('#editGroup');
        const newGroupContainer = modal.querySelector('#newGroupContainer');
        
        groupSelect.addEventListener('change', (e) => {
            newGroupContainer.style.display = e.target.value === '__NEW__' ? 'block' : 'none';
        });
        
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.cancel-modal').onclick = closeModal;
        
        modal.querySelector('.confirm-modal').onclick = () => {
            const name = modal.querySelector('#editColorName').value.trim();
            const nk = modal.querySelector('#editColorNK').value.trim();
            const c = parseFloat(modal.querySelector('#editC').value) || 0;
            const m = parseFloat(modal.querySelector('#editM').value) || 0;
            const y = parseFloat(modal.querySelector('#editY').value) || 0;
            const k = parseFloat(modal.querySelector('#editK').value) || 0;
            const reason = modal.querySelector('#editReason').value.trim();
            
            let group = groupSelect.value;
            if (group === '__NEW__') {
                group = modal.querySelector('#newGroupName').value.trim().toUpperCase();
                if (!group) {
                    alert('⚠️ Debe ingresar un nombre para el nuevo grupo.');
                    return;
                }
            }
            
            if (!name) { alert('⚠️ Debe ingresar el nombre del color.'); return; }
            if (!nk) { alert('⚠️ Debe ingresar el NK.'); return; }
            if (!group) { alert('⚠️ Debe seleccionar un grupo.'); return; }
            if (!reason) { alert('⚠️ El motivo es obligatorio.'); return; }
            
            this.updateColor(color.id, {
                name: name,
                nk: nk,
                group: group,
                cmyk: { c, m, y, k }
            }, reason);
            
            closeModal();
        };
    }
    
    showAddToGroupModal() {
        const groups = this.getAllGroups();
        const groupOptions = Array.from(groups.keys()).sort();
        const approvedColors = this.getApprovedColors();
        const colorsInSelectedGroup = this.selectedManagerGroup ? this.getColorsInGroup(this.selectedManagerGroup) : [];
        const availableColors = approvedColors.filter(c => !colorsInSelectedGroup.includes(c.name));
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header" style="background: #2d4ed6;">
                    <h3 style="color: white;">➕ Agregar color al grupo</h3>
                    <button class="modal-close" style="color: white;">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Grupo destino:</label>
                        <select id="targetGroup" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;">
                            <option value="">-- Seleccionar grupo --</option>
                            ${groupOptions.map(g => `<option value="${this.escapeHtml(g)}" ${this.selectedManagerGroup === g ? 'selected' : ''}>${this.escapeHtml(g)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="margin-top: 0.75rem;">
                        <label>Color a agregar:</label>
                        <select id="colorToAdd" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;">
                            <option value="">-- Seleccionar color --</option>
                            ${availableColors.map(c => `<option value="${this.escapeHtml(c.name)}">${this.escapeHtml(c.name)} (${c.group})</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="margin-top: 0.75rem;">
                        <label>Motivo:</label>
                        <textarea id="addReason" rows="2" placeholder="Motivo..." style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></textarea>
                    </div>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-secondary cancel-modal">Cancelar</button>
                    <button class="btn btn-primary confirm-modal">Agregar</button>
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
        modal.querySelector('.cancel-modal').onclick = closeModal;
        
        modal.querySelector('.confirm-modal').onclick = () => {
            const targetGroup = modal.querySelector('#targetGroup').value;
            const colorName = modal.querySelector('#colorToAdd').value;
            const reason = modal.querySelector('#addReason').value.trim();
            
            if (!targetGroup) { alert('⚠️ Debe seleccionar un grupo.'); return; }
            if (!colorName) { alert('⚠️ Debe seleccionar un color.'); return; }
            if (!reason) { alert('⚠️ El motivo es obligatorio.'); return; }
            
            this.addColorToGroup(colorName, targetGroup, reason);
            closeModal();
        };
    }
    
    // ============================================================
    // RENDERIZADO PRINCIPAL
    // ============================================================
    
    renderPendingColors() {
        if (!this.pendingTableBody) return;
        
        const pendingColors = this.getPendingColors();
        
        if (pendingColors.length === 0) {
            this.pendingTableBody.innerHTML = '<tr><td colspan="10" class="empty-state">No hay colores pendientes. Agregue uno nuevo.</td></tr>';
            return;
        }
        
        this.pendingTableBody.innerHTML = pendingColors.map(color => `
            <tr data-id="${color.id}">
                <td>${color.id}</td>
                <td><strong>${this.escapeHtml(color.name)}</strong></td>
                <td>${this.escapeHtml(color.nk)}</td>
                <td>${color.cmyk.c}%</td>
                <td>${color.cmyk.m}%</td>
                <td>${color.cmyk.y}%</td>
                <td>${color.cmyk.k}%</td>
                <td>${this.escapeHtml(color.group)}</td>
                <td><span class="status-badge pending" style="background:#b45309; color:white; padding:0.2rem 0.5rem; border-radius:1rem; font-size:0.7rem;">⏳ Pendiente</span></td>
                <td class="actions-cell">
                    <button class="dev-btn dev-edit-pending" data-id="${color.id}" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="dev-btn dev-approve-pending" data-id="${color.id}" title="Aprobar"><i class="fas fa-check-circle"></i></button>
                    <button class="dev-btn dev-delete-pending" data-id="${color.id}" title="Eliminar"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
        
        this.pendingTableBody.querySelectorAll('.dev-edit-pending').forEach(btn => {
            btn.onclick = () => {
                const id = parseInt(btn.dataset.id);
                const color = this.colors.find(c => c.id === id);
                if (color) this.showEditPendingModal(color);
            };
        });
        
        this.pendingTableBody.querySelectorAll('.dev-approve-pending').forEach(btn => {
            btn.onclick = () => {
                const id = parseInt(btn.dataset.id);
                const reason = prompt('Motivo para aprobar este color:');
                if (reason) this.approveColor(id, reason);
            };
        });
        
        this.pendingTableBody.querySelectorAll('.dev-delete-pending').forEach(btn => {
            btn.onclick = () => {
                const id = parseInt(btn.dataset.id);
                const color = this.colors.find(c => c.id === id);
                if (color) {
                    const reason = prompt(`Motivo para eliminar "${color.name}":`);
                    if (reason) this.deletePendingColor(id, reason);
                }
            };
        });
    }
    
    renderGroupManager() {
        if (!this.managerGroupSelect || !this.managerGroupColorsList || !this.availableColorsContainer) return;
        
        const groups = this.getAllGroups();
        const groupOptions = Array.from(groups.keys()).sort();
        
        this.managerGroupSelect.innerHTML = '<option value="">-- Seleccionar grupo --</option>' +
            groupOptions.map(g => `<option value="${this.escapeHtml(g)}" ${this.selectedManagerGroup === g ? 'selected' : ''}>${this.escapeHtml(g)}</option>`).join('');
        
        if (this.selectedManagerGroup && groups.has(this.selectedManagerGroup)) {
            const colorsInGroup = this.getColorsInGroup(this.selectedManagerGroup);
            const approvedColors = this.getApprovedColors();
            const colorsInGroupSet = new Set(colorsInGroup);
            const availableColors = approvedColors.filter(c => !colorsInGroupSet.has(c.name));
            
            this.managerGroupColorsList.innerHTML = colorsInGroup.map(colorName => `
                <div class="group-color-item" style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem; margin:0.25rem 0; background:#1f1f2a; border-radius:6px;">
                    <span class="group-color-name">${this.escapeHtml(colorName)}</span>
                    <button class="remove-from-group-btn" data-color="${this.escapeHtml(colorName)}" style="background:transparent; border:none; color:#f87171; cursor:pointer;" title="Eliminar del grupo"><i class="fas fa-trash-alt"></i></button>
                </div>
            `).join('');
            
            this.availableColorsContainer.innerHTML = availableColors.map(color => `
                <div class="available-color-item" style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem; margin:0.25rem 0; background:#1f1f2a; border-radius:6px;">
                    <span class="available-color-name">${this.escapeHtml(color.name)}</span>
                    <button class="add-to-group-btn" data-color="${this.escapeHtml(color.name)}" style="background:transparent; border:none; color:#4ade80; cursor:pointer;" title="Agregar al grupo"><i class="fas fa-plus-circle"></i></button>
                </div>
            `).join('');
            
            this.managerGroupColorsList.querySelectorAll('.remove-from-group-btn').forEach(btn => {
                btn.onclick = () => {
                    const colorName = btn.dataset.color;
                    const reason = prompt(`Motivo para eliminar "${colorName}" del grupo:`);
                    if (reason) this.removeColorFromGroup(colorName, this.selectedManagerGroup, reason);
                };
            });
            
            this.availableColorsContainer.querySelectorAll('.add-to-group-btn').forEach(btn => {
                btn.onclick = () => {
                    const colorName = btn.dataset.color;
                    const reason = prompt(`Motivo para agregar "${colorName}" al grupo:`);
                    if (reason) this.addColorToGroup(colorName, this.selectedManagerGroup, reason);
                };
            });
        } else {
            this.managerGroupColorsList.innerHTML = '<div class="empty-state" style="text-align:center; padding:2rem; color:#6b7280;">Seleccione un grupo para ver sus colores</div>';
            this.availableColorsContainer.innerHTML = '<div class="empty-state" style="text-align:center; padding:2rem; color:#6b7280;">Seleccione un grupo para ver colores disponibles</div>';
        }
    }
    
    renderExistingGroups() {
        if (!this.groupsListContainer) return;
        
        const groups = this.getAllGroups();
        
        if (groups.size === 0) {
            this.groupsListContainer.innerHTML = '<div class="empty-state" style="text-align:center; padding:2rem; color:#6b7280;">No hay grupos de equivalencia creados</div>';
            return;
        }
        
        this.groupsListContainer.innerHTML = Array.from(groups.entries()).map(([groupName, colors]) => {
            const isExpanded = this.expandedGroups.has(groupName);
            
            return `
                <div class="group-card" data-group="${this.escapeHtml(groupName)}" style="background:#0c0c12; border:1px solid #2d3748; border-radius:8px; margin-bottom:1rem; overflow:hidden;">
                    <div class="group-header" style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem 1rem; background:#111117; border-bottom:1px solid #2d3748;">
                        <div class="group-header-left" style="display:flex; align-items:center; gap:0.75rem;">
                            <button class="group-toggle-btn" data-group="${this.escapeHtml(groupName)}" style="background:transparent; border:none; color:#00e5ff; cursor:pointer;">
                                <i class="fas fa-chevron-${isExpanded ? 'down' : 'right'}"></i>
                            </button>
                            <strong style="color:#eab308;"><i class="fas fa-layer-group"></i> ${this.escapeHtml(groupName)}</strong>
                            <span class="group-count" style="background:#2d3748; color:#9ca3af; padding:0.2rem 0.6rem; border-radius:1rem; font-size:0.7rem;">${colors.length} colores</span>
                        </div>
                        <div class="group-header-actions" style="display:flex; gap:0.5rem;">
                            <button class="group-rename-btn" data-group="${this.escapeHtml(groupName)}" style="background:transparent; border:none; color:#00e5ff; cursor:pointer;" title="Renombrar grupo"><i class="fas fa-edit"></i></button>
                            <button class="group-add-color-btn" data-group="${this.escapeHtml(groupName)}" style="background:transparent; border:none; color:#4ade80; cursor:pointer;" title="Agregar color"><i class="fas fa-plus"></i></button>
                        </div>
                    </div>
                    <div class="group-colors-list ${isExpanded ? 'expanded' : 'collapsed'}" style="${isExpanded ? 'display:block' : 'display:none'}; padding:0.75rem;">
                        ${colors.map(colorName => `
                            <div class="group-color-item" style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem; margin:0.25rem 0; background:#1f1f2a; border-radius:6px;">
                                <span class="group-color-name">${this.escapeHtml(colorName)}</span>
                                <div class="group-color-actions" style="display:flex; gap:0.5rem;">
                                    <button class="color-edit-btn" data-group="${this.escapeHtml(groupName)}" data-color="${this.escapeHtml(colorName)}" style="background:transparent; border:none; color:#fbbf24; cursor:pointer;" title="Editar color"><i class="fas fa-edit"></i></button>
                                    <button class="color-remove-btn" data-group="${this.escapeHtml(groupName)}" data-color="${this.escapeHtml(colorName)}" style="background:transparent; border:none; color:#f87171; cursor:pointer;" title="Eliminar del grupo"><i class="fas fa-trash-alt"></i></button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
        
        this.groupsListContainer.querySelectorAll('.group-toggle-btn').forEach(btn => {
            btn.onclick = () => {
                const groupName = btn.dataset.group;
                if (this.expandedGroups.has(groupName)) {
                    this.expandedGroups.delete(groupName);
                } else {
                    this.expandedGroups.add(groupName);
                }
                this.renderExistingGroups();
            };
        });
        
        this.groupsListContainer.querySelectorAll('.group-rename-btn').forEach(btn => {
            btn.onclick = () => {
                const oldName = btn.dataset.group;
                const newName = prompt(`Renombrar grupo "${oldName}"`, oldName);
                if (newName && newName !== oldName) {
                    const reason = prompt('Motivo para renombrar el grupo:');
                    if (reason) this.renameGroup(oldName, newName, reason);
                }
            };
        });
        
        this.groupsListContainer.querySelectorAll('.group-add-color-btn').forEach(btn => {
            btn.onclick = () => {
                this.selectedManagerGroup = btn.dataset.group;
                this.renderGroupManager();
                this.showAddToGroupModal();
            };
        });
        
        this.groupsListContainer.querySelectorAll('.color-edit-btn').forEach(btn => {
            btn.onclick = () => {
                const groupName = btn.dataset.group;
                const colorName = btn.dataset.color;
                const color = this.colors.find(c => c.name === colorName && c.group === groupName);
                if (color) this.showEditPendingModal(color);
            };
        });
        
        this.groupsListContainer.querySelectorAll('.color-remove-btn').forEach(btn => {
            btn.onclick = () => {
                const groupName = btn.dataset.group;
                const colorName = btn.dataset.color;
                const reason = prompt(`Motivo para eliminar "${colorName}" del grupo "${groupName}":`);
                if (reason) this.removeColorFromGroup(colorName, groupName, reason);
            };
        });
    }
    
    renderAll() {
        this.renderPendingColors();
        this.renderGroupManager();
        this.renderExistingGroups();
    }
    
    // ============================================================
    // IMPORTAR / EXPORTAR / HISTORIAL
    // ============================================================
    
    exportColorTable() {
        const groups = this.getAllGroups();
        
        if (groups.size === 0) {
            alert('❌ No hay datos para exportar.');
            return;
        }
        
        let maxRows = 0;
        for (const colors of groups.values()) {
            if (colors.length > maxRows) maxRows = colors.length;
        }
        
        let html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Tabla de Colores</title></head>
<body>
<h2>Tabla de Colores</h2>
<p>Exportado: ${new Date().toLocaleString()}</p>
<table border="1">`;
        
        for (let row = 0; row < maxRows; row++) {
            html += '<tr>';
            for (const colors of groups.values()) {
                html += `<td>${this.escapeHtml(colors[row] || '')}</td>`;
            }
            html += '</tr>';
        }
        
        html += `</table></body></html>`;
        
        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tabla_colores_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xls`;
        a.click();
        URL.revokeObjectURL(url);
        
        alert('✅ Tabla exportada correctamente.');
    }
    
    importCSV() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,.xls,.txt,.html';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target.result;
                this.parseImportedData(content);
            };
            reader.readAsText(file);
        };
        
        input.click();
    }
    
    parseImportedData(content) {
        if (content.includes('<table')) {
            this.parseHTMLTable(content);
        } else {
            this.parseCSVAndLoad(content);
        }
    }
    
    parseHTMLTable(htmlContent) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const table = doc.querySelector('table');
        
        if (!table) { alert('⚠️ No se encontró tabla.'); return; }
        
        const rows = table.querySelectorAll('tr');
        const columnCount = rows[0]?.querySelectorAll('td, th').length || 0;
        const newEquivalencyRows = [];
        
        for (let col = 0; col < columnCount; col++) newEquivalencyRows.push([]);
        
        for (const row of rows) {
            const cells = row.querySelectorAll('td, th');
            for (let col = 0; col < cells.length && col < columnCount; col++) {
                const text = cells[col].textContent.trim();
                if (text) newEquivalencyRows[col].push(text);
            }
        }
        
        this.applyImportedGroups(newEquivalencyRows.filter(g => g.length > 0));
    }
    
    parseCSVAndLoad(csvContent) {
        const separator = csvContent.split(/\r?\n/)[0]?.includes(';') ? ';' : ',';
        const lines = csvContent.split(/\r?\n/);
        let startLine = lines[0]?.trim() === 'sep=;' ? 1 : 0;
        
        let maxCols = 0;
        const rowsData = [];
        
        for (let i = startLine; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;
            const row = this.parseCSVLine(line, separator);
            maxCols = Math.max(maxCols, row.length);
            rowsData.push(row);
        }
        
        const newEquivalencyRows = [];
        for (let col = 0; col < maxCols; col++) {
            const group = [];
            for (const row of rowsData) {
                const value = row[col]?.trim();
                if (value) group.push(value);
            }
            if (group.length) newEquivalencyRows.push(group);
        }
        
        this.applyImportedGroups(newEquivalencyRows);
    }
    
    parseCSVLine(line, separator) {
        const result = [];
        let inQuotes = false;
        let current = '';
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === separator && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        
        return result.map(cell => cell.replace(/^"|"$/g, '').trim());
    }
    
    applyImportedGroups(newEquivalencyRows) {
        if (!this.app) return;
        
        this.app.equivalencyRows = newEquivalencyRows;
        this.app.saveEquivalencyRowsToLocalStorage();
        this.app.equivalenceMap = this.app.buildEquivalenceMap();
        
        this.syncFromEquivalencyRows();
        
        if (this.app.creatorView) this.app.creatorView.renderTable();
        
        const totalColors = newEquivalencyRows.reduce((sum, g) => sum + g.length, 0);
        this.addHistoryEntry('IMPORT_TABLE', `Importados ${newEquivalencyRows.length} grupos, ${totalColors} colores`, 'Importación masiva');
        
        alert(`✅ Importados ${newEquivalencyRows.length} grupos.`);
    }
    
    deleteAllTable() {
        const reason = prompt('Motivo para eliminar TODA la tabla:');
        if (!reason) return;
        
        const confirmPassword = prompt('Contraseña de administrador:');
        if (confirmPassword !== 'admin123') {
            alert('❌ Contraseña incorrecta.');
            return;
        }
        
        if (this.app) {
            this.app.equivalencyRows = [];
            this.app.saveEquivalencyRowsToLocalStorage();
            this.app.equivalenceMap = this.app.buildEquivalenceMap();
            
            this.colors = this.colors.filter(c => !c.approved);
            this.saveToLocalStorage();
            
            if (this.app.creatorView) this.app.creatorView.renderTable();
            
            this.renderAll();
            this.addHistoryEntry('DELETE_ALL_TABLE', 'Toda la tabla eliminada', reason);
            alert('✅ Tabla eliminada.');
        }
    }
    
    showHistoryModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay history-modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header" style="background: #2d4ed6;">
                    <h3 style="color: white;"><i class="fas fa-history"></i> Historial de cambios</h3>
                    <button class="modal-close" style="color: white;">&times;</button>
                </div>
                <div class="modal-body" style="max-height: 65vh; overflow: auto;">
                    <input type="text" id="historySearch" placeholder="🔍 Buscar..." style="width:100%; padding:0.5rem; margin-bottom:1rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;">
                    <div id="historyList"></div>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-secondary close-modal">Cerrar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const renderHistory = (search = '') => {
            const filtered = this.history.filter(h => 
                h.user.includes(search) || h.action.includes(search) || 
                h.details.includes(search) || (h.reason && h.reason.includes(search))
            );
            
            const historyList = modal.querySelector('#historyList');
            historyList.innerHTML = filtered.map(h => `
                <div style="border-bottom:1px solid #2d3748; padding:0.5rem;">
                    <div><strong>${new Date(h.timestamp).toLocaleString()}</strong> - ${h.user}</div>
                    <div><span style="color:#00e5ff;">${h.action}</span>: ${h.details}</div>
                    ${h.reason ? `<div style="color:#fbbf24; font-size:0.7rem;">📝 ${h.reason}</div>` : ''}
                </div>
            `).join('');
            
            if (filtered.length === 0) historyList.innerHTML = '<div class="empty-state" style="text-align:center; padding:2rem;">No hay registros</div>';
        };
        
        modal.querySelector('#historySearch').addEventListener('input', (e) => renderHistory(e.target.value));
        renderHistory();
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.close-modal').onclick = closeModal;
    }
    
    // ============================================================
    // RENDER PRINCIPAL
    // ============================================================
    
    render() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <style>
                .development-section {
                    background: #0c0c12;
                    border: 1px solid #2d3748;
                    border-radius: 10px;
                    margin-bottom: 2rem;
                    overflow: hidden;
                }
                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem;
                    background: #111117;
                    border-bottom: 1px solid #2d3748;
                    flex-wrap: wrap;
                    gap: 1rem;
                }
                .section-header h3 {
                    margin: 0;
                    font-size: 1rem;
                    color: #eab308;
                }
                .section-actions {
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }
                .development-table-wrapper {
                    overflow-x: auto;
                    padding: 0.5rem;
                }
                .development-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.75rem;
                }
                .development-table th {
                    background: #1a1a2a;
                    padding: 0.5rem;
                    text-align: left;
                    color: #9ca3af;
                    border-bottom: 1px solid #2d3748;
                }
                .development-table td {
                    padding: 0.5rem;
                    border-bottom: 1px solid #1e1e2c;
                }
                .dev-btn {
                    background: transparent;
                    border: none;
                    color: #00e5ff;
                    cursor: pointer;
                    padding: 0.25rem 0.5rem;
                    border-radius: 4px;
                }
                .dev-btn:hover {
                    background: rgba(0, 229, 255, 0.1);
                }
                .group-manager-container {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                    padding: 1rem;
                }
                .group-selector {
                    grid-column: span 2;
                }
                .group-selector label {
                    display: block;
                    font-size: 0.8rem;
                    color: #9ca3af;
                    margin-bottom: 0.25rem;
                }
                .group-select {
                    width: 100%;
                    padding: 0.5rem;
                    background: #1f1f2a;
                    border: 1px solid #4b5563;
                    border-radius: 6px;
                    color: white;
                }
                .group-colors-panel h4, .available-colors-panel h4 {
                    font-size: 0.8rem;
                    color: #eab308;
                    margin-bottom: 0.5rem;
                }
                .group-colors-list, .available-colors-grid {
                    max-height: 300px;
                    overflow-y: auto;
                    background: #1a1a2a;
                    border-radius: 6px;
                    padding: 0.25rem;
                }
                .btn-primary, .btn-secondary, .btn-danger {
                    padding: 0.4rem 0.8rem;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    font-weight: 500;
                    cursor: pointer;
                    background: transparent;
                    transition: all 0.2s;
                }
                .btn-primary {
                    border: 1px solid #00e5ff;
                    color: #00e5ff;
                }
                .btn-primary:hover {
                    background: rgba(0, 229, 255, 0.1);
                }
                .btn-secondary {
                    border: 1px solid #9ca3af;
                    color: #9ca3af;
                }
                .btn-secondary:hover {
                    background: rgba(156, 163, 175, 0.1);
                }
                .btn-danger {
                    border: 1px solid #f87171;
                    color: #f87171;
                }
                .btn-danger:hover {
                    background: rgba(248, 113, 113, 0.1);
                }
                .empty-state {
                    text-align: center;
                    padding: 2rem;
                    color: #6b7280;
                }
            </style>
            
            <div class="development-container">
                <!-- SECCIÓN 1: COLORES PENDIENTES -->
                <div class="development-section">
                    <div class="section-header">
                        <h3><i class="fas fa-clock"></i> 📝 Colores Pendientes (No aprobados)</h3>
                        <button id="addPendingBtn" class="btn-primary"><i class="fas fa-plus"></i> Nuevo color pendiente</button>
                    </div>
                    <div class="development-table-wrapper">
                        <table class="development-table">
                            <thead>
                                <tr><th>ID</th><th>Nombre</th><th>NK</th><th>C</th><th>M</th><th>Y</th><th>K</th><th>Grupo</th><th>Estado</th><th>Acciones</th>
                            </thead>
                            <tbody id="pendingTableBody"></tbody>
                        </table>
                    </div>
                </div>
                
                <!-- SECCIÓN 2: CREAR/EDITAR ID PARA AGRUPAR -->
                <div class="development-section">
                    <div class="section-header">
                        <h3><i class="fas fa-tags"></i> 🏷️ Crear/Editar ID para Agrupar Colores</h3>
                        <div class="section-actions">
                            <button id="renameGroupBtn" class="btn-secondary"><i class="fas fa-edit"></i> Renombrar grupo</button>
                            <button id="addToGroupBtn" class="btn-primary"><i class="fas fa-plus"></i> Agregar color al grupo</button>
                        </div>
                    </div>
                    <div class="group-manager-container">
                        <div class="group-selector">
                            <label>Seleccionar grupo:</label>
                            <select id="managerGroupSelect" class="group-select"></select>
                        </div>
                        <div class="group-colors-panel">
                            <h4>Colores en este grupo:</h4>
                            <div id="managerGroupColorsList" class="group-colors-list"></div>
                        </div>
                        <div class="available-colors-panel">
                            <h4>Colores aprobados disponibles:</h4>
                            <div id="availableColorsContainer" class="available-colors-grid"></div>
                        </div>
                    </div>
                </div>
                
                <!-- SECCIÓN 3: GRUPOS DE EQUIVALENCIA EXISTENTES -->
                <div class="development-section">
                    <div class="section-header">
                        <h3><i class="fas fa-link"></i> 📁 Grupos de Equivalencia Existentes</h3>
                        <div class="section-actions">
                            <button id="exportTableBtn" class="btn-secondary"><i class="fas fa-download"></i> Exportar Excel</button>
                            <button id="importTableBtn" class="btn-secondary"><i class="fas fa-upload"></i> Importar</button>
                            <button id="deleteAllTableBtn" class="btn-danger"><i class="fas fa-trash-alt"></i> Eliminar tabla</button>
                            <button id="historyBtn" class="btn-secondary"><i class="fas fa-history"></i> Historial</button>
                        </div>
                    </div>
                    <div id="existingGroupsContainer" class="groups-list-container" style="padding: 1rem;"></div>
                </div>
            </div>
        `;
        
        this.pendingTableBody = this.container.querySelector('#pendingTableBody');
        this.managerGroupSelect = this.container.querySelector('#managerGroupSelect');
        this.managerGroupColorsList = this.container.querySelector('#managerGroupColorsList');
        this.availableColorsContainer = this.container.querySelector('#availableColorsContainer');
        this.groupsListContainer = this.container.querySelector('#existingGroupsContainer');
        
        const addPendingBtn = this.container.querySelector('#addPendingBtn');
        const renameGroupBtn = this.container.querySelector('#renameGroupBtn');
        const addToGroupBtn = this.container.querySelector('#addToGroupBtn');
        const exportTableBtn = this.container.querySelector('#exportTableBtn');
        const importTableBtn = this.container.querySelector('#importTableBtn');
        const deleteAllTableBtn = this.container.querySelector('#deleteAllTableBtn');
        const historyBtn = this.container.querySelector('#historyBtn');
        
        if (addPendingBtn) addPendingBtn.onclick = () => this.showAddPendingModal();
        if (renameGroupBtn) renameGroupBtn.onclick = () => {
            if (this.selectedManagerGroup) {
                const newName = prompt(`Renombrar grupo "${this.selectedManagerGroup}"`, this.selectedManagerGroup);
                if (newName && newName !== this.selectedManagerGroup) {
                    const reason = prompt('Motivo para renombrar:');
                    if (reason) this.renameGroup(this.selectedManagerGroup, newName, reason);
                }
            } else {
                alert('⚠️ Seleccione un grupo primero.');
            }
        };
        if (addToGroupBtn) addToGroupBtn.onclick = () => this.showAddToGroupModal();
        if (exportTableBtn) exportTableBtn.onclick = () => this.exportColorTable();
        if (importTableBtn) importTableBtn.onclick = () => this.importCSV();
        if (deleteAllTableBtn) deleteAllTableBtn.onclick = () => this.deleteAllTable();
        if (historyBtn) historyBtn.onclick = () => this.showHistoryModal();
        
        if (this.managerGroupSelect) {
            this.managerGroupSelect.onchange = (e) => {
                this.selectedManagerGroup = e.target.value;
                this.renderGroupManager();
            };
        }
        
        this.renderAll();
    }
    
    bindEvents() {}
    
    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
}