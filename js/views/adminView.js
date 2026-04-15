// js/views/adminView.js
import { Auth, ALL_PERMISSIONS } from '../core/auth.js';

export class AdminView {
    constructor(app, auth) {
        this.app = app;
        this.auth = auth;
        this.currentUser = null;
        this.init();
    }
    
    async init() {
        this.currentUser = this.auth.getCurrentUser();
        if (!this.currentUser || (!this.currentUser.isMaster && !this.currentUser.permissions?.includes('admin'))) {
            console.warn('⚠️ Usuario sin permisos de administrador');
            return;
        }
        
        this.render();
        this.attachEvents();
    }
    
    async render() {
        const container = document.getElementById('adminView');
        if (!container) return;
        
        await this.renderUsers();
    }
    
    async renderUsers() {
        const tableBody = document.getElementById('adminTableBody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '<tr><td colspan="4" class="empty-state"><div class="loading-spinner"></div> Cargando usuarios...</td></tr>';
        
        try {
            const users = await this.auth.getAllUsers();
            
            if (!users || users.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4" class="empty-state">No hay usuarios registrados</td><\/tr>';
                return;
            }
            
            const permissionNames = {
                comparator: 'Comparar',
                history: 'Bandeja',
                paletteValidator: 'Validar Paleta',
                development: 'Desarrollo',
                assignment: 'Asignación',
                reports: 'Reportes',
                admin: 'Admin'
            };
            
            tableBody.innerHTML = users.map(user => {
                const isCurrentUser = user.id === this.currentUser?.id;
                
                let badgesHtml = '';
                if (user.is_master) {
                    badgesHtml = '<span class="permission-badge master">👑 MASTER (Acceso total)</span>';
                } else {
                    const perms = user.permisos || [];
                    badgesHtml = ALL_PERMISSIONS.map(perm => {
                        const hasPerm = perms.includes(perm);
                        return `<span class="permission-badge ${hasPerm ? 'allowed' : 'denied'}">${hasPerm ? '✅' : '❌'} ${permissionNames[perm] || perm}</span>`;
                    }).join('');
                }
                
                return `
                    <tr data-id="${user.id}">
                        <td>
                            <strong>${this.escapeHtml(user.username)}</strong>
                            ${user.is_master ? '<span class="permission-badge master">👑 MASTER</span>' : ''}
                            ${isCurrentUser ? '<span class="permission-badge allowed">(tú)</span>' : ''}
                        </td>
                        <td>
                            <input type="password" value="********" disabled style="background:transparent; border:none; color:#9ca3af; width:100px;">
                            <button class="admin-btn show-password" data-username="${this.escapeHtml(user.username)}" data-password="${user.password || ''}" title="Ver contraseña">
                                <i class="fas fa-eye"></i>
                            </button>
                        </td>
                        <td class="user-permissions">${badgesHtml}</td>
                        <td class="admin-actions-cell">
                            <button class="admin-btn edit-user" data-id="${user.id}" data-username="${this.escapeHtml(user.username)}" data-permissions='${JSON.stringify(user.permisos || [])}' data-ismaster="${user.is_master}" data-password="${user.password || ''}">
                                <i class="fas fa-edit"></i>
                            </button>
                            ${!user.is_master ? `<button class="admin-btn delete delete-user" data-id="${user.id}" data-username="${this.escapeHtml(user.username)}"><i class="fas fa-trash"></i></button>` : ''}
                        </td>
                    </tr>
                `;
            }).join('');
            
            this.attachTableEvents();
            
        } catch (error) {
            console.error('Error al cargar usuarios:', error);
            tableBody.innerHTML = '<tr><td colspan="4" class="empty-state">❌ Error al cargar usuarios</td><\/tr>';
        }
    }
    
    attachTableEvents() {
        document.querySelectorAll('.edit-user').forEach(btn => {
            btn.onclick = () => this.showUserModal({
                id: parseInt(btn.dataset.id),
                username: btn.dataset.username,
                permissions: JSON.parse(btn.dataset.permissions),
                isMaster: btn.dataset.ismaster === 'true',
                password: btn.dataset.password
            });
        });
        
        document.querySelectorAll('.delete-user').forEach(btn => {
            btn.onclick = () => this.deleteUser(parseInt(btn.dataset.id), btn.dataset.username);
        });
        
        document.querySelectorAll('.show-password').forEach(btn => {
            btn.onclick = () => {
                const username = btn.dataset.username;
                const password = btn.dataset.password;
                if (password) {
                    alert(`🔐 Contraseña de "${username}": ${password}`);
                } else {
                    alert('❌ No se pudo obtener la contraseña');
                }
            };
        });
    }
    
    attachEvents() {
        const addUserBtn = document.getElementById('addUserBtn');
        if (addUserBtn) {
            addUserBtn.onclick = () => this.showUserModal();
        }
    }
    
    showUserModal(userToEdit = null) {
        const isEditing = !!userToEdit;
        const isEditingMaster = isEditing && userToEdit.isMaster;
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay user-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas ${isEditing ? 'fa-edit' : 'fa-user-plus'}"></i> ${isEditing ? 'Editar Usuario' : 'Crear Nuevo Usuario'}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    ${isEditingMaster ? '<div class="warning-box">⚠️ El usuario MASTER tiene acceso total. No se pueden modificar sus permisos.</div>' : ''}
                    
                    <div class="form-group">
                        <label><i class="fas fa-user"></i> Usuario:</label>
                        <input type="text" id="modalUsername" value="${userToEdit ? this.escapeHtml(userToEdit.username) : ''}" ${isEditing ? 'disabled' : ''} placeholder="Ej: juan_perez">
                    </div>
                    
                    <div class="form-group">
                        <label><i class="fas fa-lock"></i> Contraseña:</label>
                        <div class="password-group">
                            <input type="password" id="modalPassword" value="${userToEdit ? '********' : ''}" placeholder="${isEditing ? 'Dejar vacío para mantener' : 'Ingrese contraseña'}">
                            <i class="fas fa-eye-slash toggle-password"></i>
                        </div>
                        <small>${isEditing ? 'Dejar vacío para mantener la misma contraseña' : 'Mínimo 6 caracteres'}</small>
                    </div>
                    
                    ${!isEditingMaster ? `
                    <div class="permissions-group">
                        <h4><i class="fas fa-check-circle"></i> Permisos de acceso:</h4>
                        <div class="permissions-checkboxes">
                            <label><input type="checkbox" value="comparator" ${userToEdit?.permissions?.includes('comparator') ? 'checked' : ''}> <i class="fas fa-code-compare"></i> Comparar</label>
                            <label><input type="checkbox" value="history" ${userToEdit?.permissions?.includes('history') ? 'checked' : ''}> <i class="fas fa-inbox"></i> Bandeja</label>
                            <label><input type="checkbox" value="paletteValidator" ${userToEdit?.permissions?.includes('paletteValidator') ? 'checked' : ''}> <i class="fas fa-palette"></i> Validar Paleta</label>
                            <label><input type="checkbox" value="development" ${userToEdit?.permissions?.includes('development') ? 'checked' : ''}> <i class="fas fa-paintbrush"></i> Desarrollo</label>
                            <label><input type="checkbox" value="assignment" ${userToEdit?.permissions?.includes('assignment') ? 'checked' : ''}> <i class="fas fa-tasks"></i> Asignación</label>
                            <label><input type="checkbox" value="reports" ${userToEdit?.permissions?.includes('reports') ? 'checked' : ''}> <i class="fas fa-chart-bar"></i> Reportes</label>
                            <label><input type="checkbox" value="admin" ${userToEdit?.permissions?.includes('admin') ? 'checked' : ''}> <i class="fas fa-cog"></i> Admin</label>
                        </div>
                    </div>
                    
                    <div class="master-checkbox">
                        <label><input type="checkbox" id="isMasterCheckbox" ${userToEdit?.isMaster ? 'checked' : ''}> <i class="fas fa-crown"></i> 👑 Es usuario MASTER (acceso total)</label>
                    </div>
                    ` : ''}
                </div>
                <div class="modal-buttons">
                    <button class="btn-cancel">Cancelar</button>
                    <button class="btn-save">${isEditing ? '💾 Guardar cambios' : '✅ Crear Usuario'}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        
        const togglePassword = modal.querySelector('.toggle-password');
        const passwordInput = modal.querySelector('#modalPassword');
        if (togglePassword) {
            togglePassword.onclick = () => {
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);
                togglePassword.classList.toggle('fa-eye');
                togglePassword.classList.toggle('fa-eye-slash');
            };
        }
        
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.btn-cancel').onclick = closeModal;
        
        modal.querySelector('.btn-save').onclick = async () => {
            const username = modal.querySelector('#modalUsername').value.trim();
            let password = modal.querySelector('#modalPassword').value;
            let permissions = [];
            let isMaster = false;
            
            if (!isEditingMaster) {
                const checkboxes = modal.querySelectorAll('.permissions-checkboxes input:checked');
                permissions = Array.from(checkboxes).map(cb => cb.value);
                const masterCheckbox = modal.querySelector('#isMasterCheckbox');
                if (masterCheckbox) isMaster = masterCheckbox.checked;
            } else {
                permissions = ALL_PERMISSIONS;
                isMaster = true;
            }
            
            if (!username) {
                alert('⚠️ Debe ingresar un nombre de usuario.');
                return;
            }
            
            if (!isEditing && !password) {
                alert('⚠️ Debe ingresar una contraseña.');
                return;
            }
            
            if (!isEditing && password.length < 6) {
                alert('⚠️ La contraseña debe tener al menos 6 caracteres.');
                return;
            }
            
            if (isEditing && password === '********') {
                password = null;
            }
            
            const saveBtn = modal.querySelector('.btn-save');
            const originalText = saveBtn.innerHTML;
            saveBtn.innerHTML = '<div class="loading-spinner"></div> Procesando...';
            saveBtn.disabled = true;
            
            try {
                if (isEditing && userToEdit) {
                    const updates = {};
                    if (password) updates.password = password;
                    if (!isEditingMaster) {
                        updates.permissions = permissions;
                        updates.isMaster = isMaster;
                    }
                    
                    const result = await this.auth.updateUser(userToEdit.id, updates);
                    if (result.success) {
                        alert(`✅ Usuario "${username}" actualizado correctamente.`);
                        closeModal();
                        await this.renderUsers();
                        if (this.currentUser?.id === userToEdit.id && password) {
                            alert('⚠️ Tu contraseña ha sido cambiada. Por favor inicia sesión nuevamente.');
                            this.auth.logout();
                        }
                    } else {
                        alert(`❌ Error: ${result.error}`);
                    }
                } else {
                    const result = await this.auth.createUser(username, password, permissions, isMaster);
                    if (result.success) {
                        alert(`✅ Usuario "${username}" creado correctamente.\n🔑 Contraseña: ${password}`);
                        closeModal();
                        await this.renderUsers();
                    } else {
                        alert(`❌ Error: ${result.error}`);
                    }
                }
            } catch (error) {
                alert(`❌ Error inesperado: ${error.message}`);
            } finally {
                saveBtn.innerHTML = originalText;
                saveBtn.disabled = false;
            }
        };
        
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    }
    
    async deleteUser(id, username) {
        if (!confirm(`¿Estás seguro de que quieres eliminar al usuario "${username}"?`)) return;
        
        try {
            const result = await this.auth.deleteUser(id);
            if (result.success) {
                alert(`✅ Usuario "${username}" eliminado.`);
                await this.renderUsers();
            } else {
                alert(`❌ Error: ${result.error}`);
            }
        } catch (error) {
            alert(`❌ Error inesperado: ${error.message}`);
        }
    }
    
    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
}