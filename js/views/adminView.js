// js/views/adminView.js
import { Auth, ALL_PERMISSIONS } from '../core/auth.js';
import { supabase } from '../core/supabaseClient.js';

export class AdminView {
    constructor(app, auth) {
        this.app = app;
        this.auth = auth;
        this.currentUser = null;
        window.adminView = this;
        
        // Mapeo de nombres amigables para permisos
        this.permissionNames = {
            cyclicHub: 'Auditoría Cíclica',
            comparator: 'Auditoría Directa',
            history: 'Bandeja de Entrada',
            paletteValidator: 'Validar Paletas',
            assignment: 'Asignación Órdenes',
            reports: 'Reportes de Prod.',
            dashboard: 'Dashboard General',
            editCatalog: 'Editar Catálogos',
            admin: 'Panel Administrador'
        };

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
        await this.renderUsers();
    }

    attachEvents() {
        const btnAdd = document.getElementById('addUserBtn') || document.getElementById('btnAddUser');
        if (btnAdd) {
            btnAdd.onclick = () => this.showUserModal();
        }
    }

    async renderUsers() {
        const tableBody = document.getElementById('adminTableBody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:5rem;"><i class="fas fa-spinner fa-spin fa-3x" style="color:#3b82f6; margin-bottom:15px;"></i><br><span style="color:#64748b; font-weight:600; letter-spacing:1px;">SINCRONIZANDO USUARIOS...</span></td></tr>';
        
        try {
            const { data: users, error } = await supabase
                .from('usuarios')
                .select('*')
                .order('created_at', { ascending: false });
                
            if (error) throw error;
            
            tableBody.innerHTML = users.map(user => {
                const isMaster = user.is_master;
                return `
                <tr class="admin-row">
                    <td>
                        <div style="display:flex; align-items:center; gap:15px;">
                            <div style="width:40px; height:40px; border-radius:12px; background:${isMaster ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'rgba(59,130,246,0.1)'}; display:flex; align-items:center; justify-content:center; color:${isMaster ? 'white' : '#3b82f6'}; font-weight:800; border:1px solid ${isMaster ? '#f59e0b' : 'rgba(59,130,246,0.2)'};">
                                ${user.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style="font-weight:700; color:white; font-size:1rem;">${user.username}</div>
                                <div style="font-size:0.7rem; color:#64748b; margin-top:4px;">ID: ${user.id}</div>
                            </div>
                        </div>
                    </td>
                    <td style="text-align:center;">
                        <span class="permission-badge ${isMaster ? 'master' : ''}">
                            <i class="fas ${isMaster ? 'fa-crown' : 'fa-user'}"></i> ${isMaster ? 'MASTER' : 'USUARIO'}
                        </span>
                    </td>
                    <td>
                        <div style="display:flex; flex-wrap:wrap; gap:6px;">
                            ${isMaster ? 
                                '<span class="permission-badge master" style="font-size:0.65rem;"><i class="fas fa-star"></i> ACCESO TOTAL</span>' : 
                                (user.permisos || [])
                                    .map(p => `<span class="permission-badge" style="font-size:0.6rem;">${this.permissionNames[p] || p}</span>`)
                                    .join('') || '<span style="color:#475569; font-size:0.75rem; font-style:italic;">Sin permisos</span>'
                            }
                        </div>
                    </td>
                    <td>
                        <div style="display:flex; gap:10px; justify-content:flex-end;">
                            <button class="admin-btn" onclick="window.adminView.showUserModal('${user.id}')" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            ${!isMaster ? `
                                <button class="admin-btn delete" onclick="window.adminView.deleteUser('${user.id}')" title="Eliminar">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `}).join('');
            
        } catch (err) {
            console.error('Error renderUsers:', err);
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#ef4444; padding:3rem;">Error al cargar usuarios.</td></tr>';
        }
    }

    async showUserModal(userId = null) {
        let user = { username: '', password: '', is_master: false, permissions: [] };
        
        if (userId) {
            const { data, error } = await supabase.from('usuarios').select('*').eq('id', userId).single();
            if (!error && data) {
                user = { ...data, permissions: data.permisos || [] };
            }
        }

        const isEditingMaster = user.is_master;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 550px; width: 95%;">
                <div class="modal-header" style="background: ${isEditingMaster ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'linear-gradient(135deg,#3b82f6,#1d4ed8)'};">
                    <div>
                        <h3 style="color: white; margin: 0; font-size: 1.4rem; font-weight: 900; display:flex; align-items:center; gap:12px;">
                            ${userId ? (isEditingMaster ? '<i class="fas fa-crown"></i> PERFIL MASTER' : '<i class="fas fa-user-edit"></i> EDITAR USUARIO') : '<i class="fas fa-user-plus"></i> NUEVO USUARIO'}
                        </h3>
                        <p style="color:rgba(255,255,255,0.7); font-size:0.8rem; margin:5px 0 0 0; font-weight:500;">Gestión de identidad y niveles de seguridad</p>
                    </div>
                    <button class="modal-close" style="background:rgba(255,255,255,0.1); border:none; color:white; width:36px; height:36px; border-radius:50%; font-size:1.2rem; cursor:pointer;">&times;</button>
                </div>
                
                <div class="modal-body" style="padding: 2.5rem;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:2rem; margin-bottom:2.5rem;">
                        <div class="form-group">
                            <label style="display:block; color:#64748b; font-size:0.7rem; font-weight:800; margin-bottom:10px; text-transform:uppercase; letter-spacing:1px;">Nombre de Usuario</label>
                            <div style="position:relative;">
                                <i class="fas fa-user" style="position:absolute; left:15px; top:14px; color:#3b82f6; font-size:0.9rem;"></i>
                                <input type="text" id="editUsername" value="${user.username}" ${userId ? 'disabled' : ''} 
                                       style="width:100%; background:rgba(15,23,42,0.4); border:1px solid rgba(255,255,255,0.08); color:white; padding:14px 14px 14px 45px; border-radius:14px; font-weight:700; ${userId ? 'opacity:0.6;' : ''}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label style="display:block; color:#64748b; font-size:0.7rem; font-weight:800; margin-bottom:10px; text-transform:uppercase; letter-spacing:1px;">
                                ${userId ? 'Nueva Contraseña' : 'Contraseña'}
                            </label>
                            <div style="position:relative;">
                                <i class="fas fa-lock" style="position:absolute; left:15px; top:14px; color:#3b82f6; font-size:0.9rem;"></i>
                                <input type="password" id="editPassword" value="${user.password || ''}" placeholder="${userId ? 'En blanco para mantener' : 'Mínimo 6 caracteres'}" 
                                       style="width:100%; background:rgba(15,23,42,0.4); border:1px solid rgba(255,255,255,0.08); color:white; padding:14px 45px 14px 45px; border-radius:14px;">
                                <i class="fas fa-eye-slash toggle-password-btn" style="position:absolute; right:15px; top:14px; color:#475569; cursor:pointer; font-size:1.1rem;" title="Ver/Ocultar"></i>
                            </div>
                        </div>
                    </div>

                    <div style="margin-top:2rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.05);">
                            <h4 style="color:#3b82f6; font-size:0.8rem; font-weight:900; margin:0; display:flex; align-items:center; gap:10px; text-transform:uppercase; letter-spacing:1px;">
                                <i class="fas fa-key"></i> PERMISOS DE ACCESO
                            </h4>
                            <span style="font-size:0.7rem; color:#64748b; font-weight:600;">Habilitar módulos del sistema</span>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; background:rgba(15,23,42,0.2); padding:1.5rem; border-radius:20px; border:1px solid rgba(255,255,255,0.03);">
                            ${Object.entries(this.permissionNames).map(([key, label]) => `
                                <label style="display:flex; align-items:center; gap:12px; color:#cbd5e1; font-size:0.85rem; cursor:pointer; padding:10px 12px; border-radius:12px; transition:all 0.2s; background:rgba(255,255,255,0.02);">
                                    <input type="checkbox" class="perm-check" value="${key}" ${user.permissions.includes(key) ? 'checked' : ''} style="width:18px; height:18px; accent-color:#3b82f6;">
                                    <span style="font-weight:500;">${label}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <div class="modal-footer" style="padding:2rem 2.5rem; background:rgba(15,23,42,0.4); display:flex; gap:1.5rem; justify-content:flex-end; border-top:1px solid rgba(255,255,255,0.05);">
                    <button class="modal-cancel" style="background:transparent; border:1.5px solid rgba(255,255,255,0.1); color:#94a3b8; padding:14px 30px; border-radius:14px; cursor:pointer; font-weight:700;">CANCELAR</button>
                    <button id="btnSaveUser" style="background:${user.is_master ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'linear-gradient(135deg,#3b82f6,#1d4ed8)'}; border:none; padding:14px 40px; border-radius:14px; cursor:pointer; color:white; font-weight:800; box-shadow:0 10px 20px rgba(59, 130, 246, 0.3);">
                        ${userId ? 'GUARDAR CAMBIOS' : 'CREAR USUARIO'}
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Toggle password visibility
        const passInput = modal.querySelector('#editPassword');
        const toggleBtn = modal.querySelector('.toggle-password-btn');
        toggleBtn.onclick = () => {
            const isPass = passInput.type === 'password';
            passInput.type = isPass ? 'text' : 'password';
            toggleBtn.classList.toggle('fa-eye', isPass);
            toggleBtn.classList.toggle('fa-eye-slash', !isPass);
            toggleBtn.style.color = isPass ? '#3b82f6' : '#475569';
        };

        const close = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };

        modal.querySelector('.modal-close').onclick = close;
        modal.querySelector('.modal-cancel').onclick = close;
        
        modal.querySelector('#btnSaveUser').onclick = async () => {
            const username = document.getElementById('editUsername').value.trim();
            const password = document.getElementById('editPassword').value.trim();
            const isMaster = user.is_master; 
            const permissions = Array.from(modal.querySelectorAll('.perm-check:checked')).map(cb => cb.value);
            
            if (!username) { alert('El nombre es obligatorio.'); return; }
            
            const btn = modal.querySelector('#btnSaveUser');
            btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESANDO...';
            
            try {
                if (userId) {
                    const updateData = { username, permisos: permissions, is_master: isMaster };
                    if (password && password !== '********') updateData.password = password;
                    
                    const { error } = await supabase.from('usuarios').update(updateData).eq('id', userId);
                    if (error) throw error;
                } else {
                    if (!password) { alert('La contraseña es obligatoria.'); btn.disabled = false; return; }
                    const { error } = await supabase.from('usuarios').insert([{ username, password, permisos: permissions, is_master: isMaster }]);
                    if (error) throw error;
                }
                
                close();
                this.renderUsers();
                if (window.showNotification) {
                    window.showNotification('Éxito', `Usuario ${username} actualizado correctamente.`, 'success');
                }
            } catch (err) {
                console.error('Error al guardar:', err);
                if (window.showNotification) {
                    window.showNotification('Error', 'No se pudo guardar el usuario: ' + err.message, 'error');
                } else {
                    alert('Error al guardar: ' + err.message);
                }
                btn.disabled = false; btn.innerText = 'GUARDAR';
            }
        };
    }

    async deleteUser(userId) {
        if (!confirm('¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer.')) return;
        
        try {
            const { error } = await supabase.from('usuarios').delete().eq('id', userId);
            if (error) throw error;
            this.renderUsers();
            if (window.showNotification) {
                window.showNotification('Usuario Eliminado', 'El acceso ha sido revocado permanentemente.', 'info');
            }
        } catch (err) {
            console.error('Error al eliminar:', err);
            if (window.showNotification) {
                window.showNotification('Error', 'No se pudo eliminar el usuario: ' + err.message, 'error');
            } else {
                alert('Error al eliminar: ' + err.message);
            }
        }
    }
}