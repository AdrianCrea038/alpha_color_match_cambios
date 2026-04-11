// ============================================================
// ADMIN VIEW - Administración de usuarios
// ============================================================

import { ALL_PERMISSIONS, PERMISSIONS } from '../auth.js';

export class AdminView {
    constructor(app, auth) {
        this.app = app;
        this.auth = auth;
        this.container = null;
        this.tableBody = null;
        
        this.init();
    }
    
    init() {
        this.container = document.getElementById('adminView');
        if (!this.container) return;
        
        this.tableBody = this.container.querySelector('#adminTableBody');
        const addUserBtn = this.container.querySelector('#addUserBtn');
        
        if (addUserBtn) {
            addUserBtn.onclick = () => this.showUserModal();
        }
        
        this.render();
        console.log('✅ AdminView inicializado');
    }
    
    render() {
        if (!this.tableBody) return;
        
        const users = this.auth.getAllUsers();
        
        if (users.length === 0) {
            this.tableBody.innerHTML = '<tr><td colspan="4" class="empty-state">No hay usuarios registrados<\/td><\/tr>';
            return;
        }
        
        this.tableBody.innerHTML = users.map(user => {
            const permissionBadges = this.renderPermissionBadges(user);
            
            return `
                <tr data-id="${user.id}">
                    <td><strong>${this.escapeHtml(user.username)}</strong>${user.isMaster ? ' <span class="permission-badge master">👑 MASTER</span>' : ''}${!user.isMaster && user.id === this.auth.getCurrentUser()?.id ? ' <span class="permission-badge allowed">(tú)</span>' : ''}</td>
                    <td><input type="password" class="password-placeholder" value="********" disabled style="background:transparent; border:none; color:#9ca3af; width:100px;"><button class="admin-btn show-password" data-username="${user.username}" style="font-size:0.7rem;"><i class="fas fa-eye"></i></button></td>
                    <td class="user-permissions">${permissionBadges}</td>
                    <td class="admin-actions-cell">
                        <button class="admin-btn edit-user" data-id="${user.id}" data-username="${user.username}" data-permissions='${JSON.stringify(user.permissions)}' data-ismaster="${user.isMaster}"><i class="fas fa-edit"></i></button>
                        ${!user.isMaster ? `<button class="admin-btn delete" data-id="${user.id}" data-username="${user.username}"><i class="fas fa-trash"></i></button>` : ''}
                    </td>
                </tr>
            `;
        }).join('');
        
        this.attachEvents();
    }
    
    renderPermissionBadges(user) {
        if (user.isMaster) {
            return '<span class="permission-badge master">✅ Acceso total a todas las secciones</span>';
        }
        
        const badges = [];
        const permissionNames = {
            [PERMISSIONS.COMPARATOR]: 'Comparar',
            [PERMISSIONS.HISTORY]: 'Bandeja',
            [PERMISSIONS.CREATOR]: 'Crear TXT',
            [PERMISSIONS.EPS]: 'EPS',
            [PERMISSIONS.DEVELOPMENT]: 'Desarrollo',
            [PERMISSIONS.ASSIGNMENT]: 'Asignación',
            [PERMISSIONS.ADMIN]: 'Admin'
        };
        
        for (const perm of ALL_PERMISSIONS) {
            const hasPerm = user.permissions && user.permissions.includes(perm);
            badges.push(`
                <span class="permission-badge ${hasPerm ? 'allowed' : 'denied'}">
                    ${hasPerm ? '✅' : '❌'} ${permissionNames[perm]}
                </span>
            `);
        }
        
        return badges.join('');
    }
    
    attachEvents() {
        this.tableBody.querySelectorAll('.edit-user').forEach(btn => {
            btn.onclick = () => {
                const id = parseInt(btn.dataset.id);
                const username = btn.dataset.username;
                let permissions = [];
                try {
                    permissions = JSON.parse(btn.dataset.permissions);
                } catch(e) {}
                const isMaster = btn.dataset.ismaster === 'true';
                this.showUserModal({ id, username, permissions, isMaster });
            };
        });
        
        this.tableBody.querySelectorAll('.delete-user').forEach(btn => {
            btn.onclick = () => {
                const id = parseInt(btn.dataset.id);
                const username = btn.dataset.username;
                this.deleteUser(id, username);
            };
        });
        
        this.tableBody.querySelectorAll('.show-password').forEach(btn => {
            btn.onclick = () => {
                const username = btn.dataset.username;
                const user = this.auth.getUser(username);
                if (user) {
                    alert(`🔒 Contraseña de "${username}": ${user.password}`);
                } else {
                    alert('❌ Usuario no encontrado');
                }
            };
        });
    }
    
    showUserModal(userToEdit = null) {
        const isEditing = !!userToEdit;
        const isEditingMaster = isEditing && userToEdit.isMaster;
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay user-modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header" style="background: ${isEditingMaster ? '#b45309' : '#2d4ed6'};">
                    <h3 style="color: white;">${isEditing ? (isEditingMaster ? '👑 Editar Usuario MASTER' : '✏️ Editar Usuario') : '➕ Crear Nuevo Usuario'}</h3>
                    <button class="modal-close" style="color: white;">&times;</button>
                </div>
                <div class="modal-body">
                    ${isEditingMaster ? '<div style="background: rgba(180, 83, 9, 0.2); border: 1px solid #b45309; border-radius: 0.5rem; padding: 0.75rem; margin-bottom: 1rem;"><p style="color: #fbbf24; margin: 0; font-size: 0.8rem;">⚠️ El usuario MASTER tiene acceso total. No se pueden modificar sus permisos.</p></div>' : ''}
                    
                    <div class="form-group">
                        <label>👤 Usuario:</label>
                        <input type="text" id="modalUsername" value="${userToEdit ? this.escapeHtml(userToEdit.username) : ''}" ${isEditing ? 'disabled' : ''} placeholder="Ej: juan_perez" style="width:100%;">
                    </div>
                    
                    <div class="form-group">
                        <label>🔒 Contraseña:</label>
                        <div class="password-group">
                            <input type="password" id="modalPassword" value="${userToEdit ? '********' : ''}" placeholder="Ingrese contraseña" style="width:100%; padding-right: 2.5rem;">
                            <i class="fas fa-eye-slash toggle-modal-password" style="position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); cursor: pointer;"></i>
                        </div>
                        <small style="color: #6b7280;">${isEditing ? 'Dejar vacío para mantener la misma contraseña' : 'Mínimo 6 caracteres'}</small>
                    </div>
                    
                    ${!isEditingMaster ? `
                    <div class="permissions-group">
                        <h4>📋 Permisos de acceso:</h4>
                        <div class="permissions-checkboxes">
                            <label><input type="checkbox" value="comparator" ${userToEdit?.permissions?.includes('comparator') ? 'checked' : ''}> Comparar</label>
                            <label><input type="checkbox" value="history" ${userToEdit?.permissions?.includes('history') ? 'checked' : ''}> Bandeja</label>
                            <label><input type="checkbox" value="creator" ${userToEdit?.permissions?.includes('creator') ? 'checked' : ''}> Crear TXT</label>
                            <label><input type="checkbox" value="eps" ${userToEdit?.permissions?.includes('eps') ? 'checked' : ''}> EPS</label>
                            <label><input type="checkbox" value="development" ${userToEdit?.permissions?.includes('development') ? 'checked' : ''}> Desarrollo</label>
                            <label><input type="checkbox" value="assignment" ${userToEdit?.permissions?.includes('assignment') ? 'checked' : ''}> Asignación</label>
                            <label><input type="checkbox" value="admin" ${userToEdit?.permissions?.includes('admin') ? 'checked' : ''}> Admin</label>
                        </div>
                    </div>
                    ` : ''}
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-secondary cancel-modal">Cancelar</button>
                    <button class="btn btn-primary confirm-modal">${isEditing ? 'Guardar cambios' : 'Crear Usuario'}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        
        // Toggle password visibility
        const togglePassword = modal.querySelector('.toggle-modal-password');
        const passwordInput = modal.querySelector('#modalPassword');
        if (togglePassword && passwordInput) {
            togglePassword.onclick = () => {
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);
                togglePassword.classList.toggle('fa-eye');
                togglePassword.classList.toggle('fa-eye-slash');
            };
        }
        
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.cancel-modal').onclick = closeModal;
        
        modal.querySelector('.confirm-modal').onclick = () => {
            const username = modal.querySelector('#modalUsername').value.trim();
            let password = modal.querySelector('#modalPassword').value;
            let permissions = [];
            
            if (!isEditingMaster) {
                const checkboxes = modal.querySelectorAll('.permissions-checkboxes input:checked');
                permissions = Array.from(checkboxes).map(cb => cb.value);
            } else {
                permissions = ALL_PERMISSIONS;
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
            
            if (isEditing && userToEdit) {
                const updates = {};
                if (password) updates.password = password;
                if (!isEditingMaster) updates.permissions = permissions;
                
                const result = this.auth.updateUser(userToEdit.id, updates);
                if (result.success) {
                    alert(`✅ Usuario "${username}" actualizado correctamente.`);
                    closeModal();
                    this.render();
                    if (this.auth.getCurrentUser()?.id === userToEdit.id && password) {
                        alert('⚠️ Tu contraseña ha sido cambiada. Por favor inicia sesión nuevamente.');
                        this.app.logout();
                    }
                } else {
                    alert(`❌ Error: ${result.error}`);
                }
            } else {
                const result = this.auth.createUser(username, password, permissions, false);
                if (result.success) {
                    alert(`✅ Usuario "${username}" creado correctamente.`);
                    closeModal();
                    this.render();
                } else {
                    alert(`❌ Error: ${result.error}`);
                }
            }
        };
        
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    }
    
    deleteUser(id, username) {
        if (confirm(`¿Estás seguro de que quieres eliminar al usuario "${username}"?`)) {
            const result = this.auth.deleteUser(id);
            if (result.success) {
                alert(`✅ Usuario "${username}" eliminado.`);
                this.render();
            } else {
                alert(`❌ Error: ${result.error}`);
            }
        }
    }
    
    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
}