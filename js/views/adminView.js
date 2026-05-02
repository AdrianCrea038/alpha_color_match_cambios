// js/views/adminView.js
import { Auth, ALL_PERMISSIONS } from '../core/auth.js';
import { supabase } from '../core/supabaseClient.js';

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
        await this.renderUsers();
    }
    
    async renderUsers() {
        const tableBody = document.getElementById('adminTableBody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '<tr><td colspan="4" class="empty-state"><div class="loading-spinner"></div> Cargando usuarios...<\/tr>';
        
        try {
            const users = await this.auth.getAllUsers();
            
            if (!users || users.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4" class="empty-state">No hay usuarios registrados<\/tr>';
                return;
            }
            
            const permissionNames = {
                comparator:      'Comparar',
                history:         'Bandeja',
                paletteValidator:'Validar Paleta',
                development:     'Desarrollo',
                assignment:      'Asignación',
                reports:         'Reportes',
                dashboard:       'Dashboard',
                backup:          'Backup Automático',
                admin:           'Admin',
                linearization:   'Auditoría'
            };
            
            tableBody.innerHTML = users.map(user => {
                const isCurrentUser = user.id === this.currentUser?.id;
                
                // Detectar nivel: MASTER (is_master=true) / COMPLETO (todos los permisos) / Regular
                const userPerms = user.permisos || [];
                const isCompleto = !user.is_master && ALL_PERMISSIONS.every(p => userPerms.includes(p));

                let badgesHtml = '';
                if (user.is_master) {
                    badgesHtml = '<span class="permission-badge master" style="background:linear-gradient(135deg,#7c3aed,#4c1d95);border:1px solid #7c3aed;">♟️ MASTER (Control Total)</span>';
                } else if (isCompleto) {
                    badgesHtml = '<span class="permission-badge" style="background:linear-gradient(135deg,#0ea5e9,#0369a1);border:1px solid #0ea5e9;color:white;padding:4px 10px;border-radius:6px;font-size:0.75rem;font-weight:900;">🔷 COMPLETO (Acceso Total)</span>';
                } else {
                    badgesHtml = ALL_PERMISSIONS.map(perm => {
                        const hasPerm = userPerms.includes(perm);
                        return `<span class="permission-badge ${hasPerm ? 'allowed' : 'denied'}">${hasPerm ? '✅' : '❌'} ${permissionNames[perm] || perm}</span>`;
                    }).join('');
                }
                
                // Solo MASTER puede editar/eliminar a MASTER y COMPLETO
                const currentIsMaster = this.currentUser?.isMaster === true;
                const canEditThisUser = currentIsMaster || (!user.is_master && !isCompleto);

                return `
                    <tr data-id="${user.id}">
                        <td>
                            <strong>${this.escapeHtml(user.username)}</strong>
                            ${user.is_master ? ' <span style="background:linear-gradient(135deg,#7c3aed,#4c1d95);color:white;padding:2px 8px;border-radius:4px;font-size:0.7rem;font-weight:900;margin-left:4px;">♟️ MASTER</span>' : ''}
                            ${isCompleto ? ' <span style="background:linear-gradient(135deg,#0ea5e9,#0369a1);color:white;padding:2px 8px;border-radius:4px;font-size:0.7rem;font-weight:900;margin-left:4px;">🔷 COMPLETO</span>' : ''}
                            ${isCurrentUser ? ' <span class="permission-badge allowed" style="margin-left:4px;">(tú)</span>' : ''}
                        </td>
                        <td><input type="password" value="********" disabled style="background:transparent;border:none;color:#9ca3af;width:100px;"><button class="admin-btn show-password" data-username="${this.escapeHtml(user.username)}" data-password="${user.password || ''}"><i class="fas fa-eye"></i></button></td>
                        <td class="user-permissions">${badgesHtml}</td>
                        <td class="admin-actions-cell">
                            ${canEditThisUser ? `<button class="admin-btn edit-user" data-id="${user.id}" data-username="${this.escapeHtml(user.username)}" data-permissions='${JSON.stringify(user.permisos || [])}' data-ismaster="${user.is_master}" data-iscompleto="${isCompleto}" data-password="${user.password || ''}"><i class="fas fa-edit"></i></button>` : '<span style="color:#475569;font-size:0.7rem;">🔒</span>'}
                            ${(canEditThisUser && !user.is_master) ? `<button class="admin-btn delete delete-user" data-id="${user.id}" data-username="${this.escapeHtml(user.username)}"><i class="fas fa-trash"></i></button>` : ''}
                        </td>
                    </tr>
                `;
            }).join('');
            
            this.attachTableEvents();
            
        } catch (error) {
            console.error('Error al cargar usuarios:', error);
            tableBody.innerHTML = '<tr><td colspan="4" class="empty-state">❌ Error al cargar usuarios<\/tr>';
        }
    }
    
    attachTableEvents() {
        document.querySelectorAll('.edit-user').forEach(btn => {
            btn.onclick = () => this.showUserModal({
                id: parseInt(btn.dataset.id),
                username: btn.dataset.username,
                permissions: JSON.parse(btn.dataset.permissions),
                isMaster: btn.dataset.ismaster === 'true',
                isCompleto: btn.dataset.iscompleto === 'true',
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

        // Solo el MASTER real puede ver y ejecutar la migración
        const migrateBtn = document.getElementById('migrateMasterBtn');
        if (migrateBtn) {
            if (this.currentUser?.isMaster) {
                migrateBtn.style.display = 'inline-flex';
                migrateBtn.onclick = () => this.migrateMasterToCompleto();
            } else {
                migrateBtn.style.display = 'none';
            }
        }
    }
    
    showUserModal(userToEdit = null) {
        const isEditing = !!userToEdit;
        const isEditingMaster = isEditing && userToEdit.isMaster;
        const isEditingCompleto = isEditing && userToEdit.isCompleto;
        const currentIsMaster = this.currentUser?.isMaster === true;

        const allPerms = {
            comparator:       { label: 'Comparar',          icon: '🔀' },
            history:          { label: 'Bandeja',            icon: '📬' },
            paletteValidator: { label: 'Validar Paleta',     icon: '🎨' },
            development:      { label: 'Desarrollo',         icon: '🛠️' },
            assignment:       { label: 'Asignación',         icon: '📋' },
            reports:          { label: 'Reportes',           icon: '📊' },
            dashboard:        { label: 'Dashboard',          icon: '📈' },
            backup:           { label: 'Backup Automático',  icon: '💾' },
            admin:            { label: 'Admin',              icon: '⚙️' },
            linearization:    { label: 'Auditoría',          icon: '🔍' }
        };

        const checkboxesHtml = Object.entries(allPerms).map(([key, info]) => {
            const checked = userToEdit?.permissions?.includes(key) ? 'checked' : '';
            return `
                <label class="perm-chip ${checked ? 'perm-active' : ''}" style="
                    display:inline-flex; align-items:center; gap:6px; padding:8px 14px;
                    background:${checked ? 'rgba(16,185,129,0.15)' : 'rgba(30,41,59,0.8)'};
                    border:2px solid ${checked ? '#10b981' : '#334155'};
                    border-radius:8px; cursor:pointer; color:${checked ? '#10b981' : '#64748b'};
                    font-size:0.82rem; font-weight:700; transition:all 0.2s; user-select:none;
                    " onmouseover="this.style.borderColor='#10b981'" onmouseout="if(!this.querySelector('input').checked)this.style.borderColor='#334155'">
                    <input type="checkbox" value="${key}" ${checked} style="display:none;"
                        onchange="
                            const l=this.closest('label');
                            const on=this.checked;
                            l.style.background=on?'rgba(16,185,129,0.15)':'rgba(30,41,59,0.8)';
                            l.style.borderColor=on?'#10b981':'#334155';
                            l.style.color=on?'#10b981':'#64748b';
                        ">
                    <span>${info.icon} ${info.label}</span>
                </label>`;
        }).join('');

        const modal = document.createElement('div');
        modal.className = 'modal-overlay user-modal active';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:10050;';
        modal.innerHTML = `
            <div style="max-width:600px;width:95%;background:#0f172a;border:2px solid #334155;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;max-height:92vh;">

                <!-- HEADER -->
                <div style="background:linear-gradient(135deg,#1e293b,#0f172a);border-bottom:3px solid ${isEditing ? '#f59e0b' : '#10b981'};padding:1.4rem 2rem;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
                    <div>
                        <h3 style="color:white;margin:0;font-size:1.25rem;font-weight:900;">
                            <i class="fas ${isEditing ? 'fa-user-edit' : 'fa-user-plus'}" style="color:${isEditing ? '#f59e0b' : '#10b981'};margin-right:8px;"></i>
                            ${isEditing ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
                        </h3>
                        <p style="color:#64748b;margin:4px 0 0;font-size:0.8rem;">
                            ${isEditing ? `Editando cuenta de: <strong style="color:#94a3b8">${this.escapeHtml(userToEdit.username)}</strong>` : 'Completa todos los campos para crear el acceso'}
                        </p>
                    </div>
                    <button id="adminModalClose" style="background:rgba(255,255,255,0.05);border:1px solid #334155;color:#94a3b8;width:36px;height:36px;border-radius:8px;cursor:pointer;font-size:1.2rem;display:flex;align-items:center;justify-content:center;">&times;</button>
                </div>

                <!-- BODY -->
                <div style="padding:1.6rem 2rem;background:#0b0f1a;display:flex;flex-direction:column;gap:1.2rem;overflow-y:auto;flex:1;">

                    ${isEditingMaster ? `
                    <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.4);border-radius:10px;padding:10px 14px;color:#fbbf24;font-size:0.82rem;">
                        ⚠️ Usuario MASTER: tiene acceso total. Solo puedes editar su nombre o contraseña.
                    </div>` : ''}

                    <!-- NOMBRE DE USUARIO -->
                    <div>
                        <label style="color:#94a3b8;font-size:0.72rem;font-weight:900;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:7px;">👤 Nombre de Usuario</label>
                        <input type="text" id="modalUsername"
                            value="${userToEdit ? this.escapeHtml(userToEdit.username) : ''}"
                            placeholder="Ej: juan_perez"
                            style="width:100%;background:#1e293b;border:2px solid #334155;color:white;padding:12px 16px;border-radius:10px;font-size:1rem;font-weight:700;box-sizing:border-box;outline:none;transition:border-color 0.2s;"
                            onfocus="this.style.borderColor='#f59e0b'" onblur="this.style.borderColor='#334155'">
                    </div>

                    <!-- CONTRASEÑA -->
                    <div>
                        <label style="color:#94a3b8;font-size:0.72rem;font-weight:900;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:7px;">🔒 Contraseña</label>
                        <div style="position:relative;">
                            <input type="text" id="modalPassword"
                                value="${userToEdit ? this.escapeHtml(userToEdit.password || '') : ''}"
                                placeholder="${isEditing ? 'Dejar vacío para no cambiar' : 'Mínimo 6 caracteres'}"
                                style="width:100%;background:#1e293b;border:2px solid #334155;color:#10b981;padding:12px 48px 12px 16px;border-radius:10px;font-size:1rem;font-family:monospace;font-weight:700;box-sizing:border-box;outline:none;transition:border-color 0.2s;"
                                onfocus="this.style.borderColor='#10b981'" onblur="this.style.borderColor='#334155'">
                            <button type="button" id="togglePwdBtn"
                                style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:transparent;border:none;color:#64748b;cursor:pointer;font-size:1rem;padding:4px;">
                                <i class="fas fa-eye-slash"></i>
                            </button>
                        </div>
                        <small style="color:#475569;font-size:0.72rem;margin-top:4px;display:block;">
                            ${isEditing ? '📌 La contraseña actual está visible. Modifícala si deseas cambiarla.' : '📌 Mínimo 6 caracteres requeridos.'}
                        </small>
                    </div>

                    <!-- PERMISOS -->
                    ${!isEditingMaster ? `
                    <div>
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                            <label style="color:#94a3b8;font-size:0.72rem;font-weight:900;text-transform:uppercase;letter-spacing:1px;">📋 Secciones con Acceso</label>
                            <div style="display:flex;gap:6px;">
                                <button type="button" id="checkAllPerms" style="background:#10b981;border:none;color:white;padding:4px 12px;border-radius:6px;font-size:0.7rem;font-weight:900;cursor:pointer;">✅ Todo</button>
                                <button type="button" id="uncheckAllPerms" style="background:#ef4444;border:none;color:white;padding:4px 12px;border-radius:6px;font-size:0.7rem;font-weight:900;cursor:pointer;">❌ Nada</button>
                            </div>
                        </div>
                        <div class="permissions-checkboxes" style="display:flex;flex-wrap:wrap;gap:8px;">
                            ${checkboxesHtml}
                        </div>
                    </div>

                    <!-- COMPLETO TOGGLE (solo MASTER puede asignar) -->
                    ${currentIsMaster ? `
                    <label style="display:flex;align-items:center;gap:12px;background:#1e293b;border:2px solid #334155;border-radius:10px;padding:14px 16px;cursor:pointer;transition:border-color 0.2s;"
                        onmouseover="this.style.borderColor='#0ea5e9'" onmouseout="this.style.borderColor='#334155'">
                        <input type="checkbox" id="isCompletoCheckbox" ${(userToEdit?.isCompleto || userToEdit?.isMaster) ? 'checked' : ''}
                            style="width:18px;height:18px;accent-color:#0ea5e9;flex-shrink:0;"
                            onchange="const l=this.closest('label');l.style.borderColor=this.checked?'#0ea5e9':'#334155';">
                        <div>
                            <div style="color:#38bdf8;font-weight:900;font-size:0.9rem;">🔷 Usuario COMPLETO</div>
                            <div style="color:#64748b;font-size:0.75rem;">Activa todos los permisos. Solo tú (MASTER) puedes asignar este nivel.</div>
                        </div>
                    </label>
                    ` : ''}
                    ` : ''}
                </div>

                <!-- FOOTER -->
                <div style="background:#1e1e2e;border-top:1px solid #334155;padding:1.2rem 2rem;display:flex;justify-content:flex-end;gap:12px;flex-shrink:0;">
                    <button id="adminModalCancel" style="background:transparent;border:1px solid #475569;color:#94a3b8;padding:10px 24px;border-radius:10px;cursor:pointer;font-weight:700;font-size:0.9rem;">Cancelar</button>
                    <button id="adminModalSave" style="background:linear-gradient(135deg,${isEditing ? '#f59e0b,#d97706' : '#10b981,#059669'});color:white;border:none;padding:12px 32px;border-radius:10px;cursor:pointer;font-weight:900;font-size:1rem;letter-spacing:0.5px;">
                        ${isEditing ? '💾 Guardar Cambios' : '✅ Crear Usuario'}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const closeModal = () => modal.remove();

        // Toggle contraseña visible/oculta
        const pwdInput = modal.querySelector('#modalPassword');
        modal.querySelector('#togglePwdBtn').onclick = (e) => {
            const showing = pwdInput.getAttribute('type') === 'text';
            pwdInput.setAttribute('type', showing ? 'password' : 'text');
            e.currentTarget.querySelector('i').className = showing ? 'fas fa-eye' : 'fas fa-eye-slash';
        };

        // Todo / Nada
        const btnAll = modal.querySelector('#checkAllPerms');
        const btnNone = modal.querySelector('#uncheckAllPerms');
        if (btnAll) btnAll.onclick = () => {
            modal.querySelectorAll('.permissions-checkboxes input[type=checkbox]').forEach(cb => {
                cb.checked = true; cb.dispatchEvent(new Event('change'));
            });
        };
        if (btnNone) btnNone.onclick = () => {
            modal.querySelectorAll('.permissions-checkboxes input[type=checkbox]').forEach(cb => {
                cb.checked = false; cb.dispatchEvent(new Event('change'));
            });
        };

        modal.querySelector('#adminModalClose').onclick = closeModal;
        modal.querySelector('#adminModalCancel').onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };

        modal.querySelector('#adminModalSave').onclick = async () => {
            const newUsername = modal.querySelector('#modalUsername').value.trim();
            const newPassword = modal.querySelector('#modalPassword').value.trim();
            let permissions = [];
            let isMaster = false;

            if (!isEditingMaster) {
                // Si marcó COMPLETO, forzar todos los permisos
                const completoCb = modal.querySelector('#isCompletoCheckbox');
                if (completoCb && completoCb.checked) {
                    permissions = [...ALL_PERMISSIONS];
                } else {
                    const checkboxes = modal.querySelectorAll('.permissions-checkboxes input:checked');
                    permissions = Array.from(checkboxes).map(cb => cb.value);
                }
                isMaster = false; // MASTER no se puede asignar desde el modal
            } else {
                permissions = ALL_PERMISSIONS;
                isMaster = true;
            }

            if (!newUsername) { alert('⚠️ El nombre de usuario no puede estar vacío.'); return; }
            if (!isEditing && !newPassword) { alert('⚠️ Debes ingresar una contraseña.'); return; }
            if (!isEditing && newPassword.length < 6) { alert('⚠️ La contraseña debe tener al menos 6 caracteres.'); return; }

            const saveBtn = modal.querySelector('#adminModalSave');
            saveBtn.innerHTML = '⏳ Procesando...';
            saveBtn.disabled = true;

            try {
                if (isEditing && userToEdit) {
                    const updates = { username: newUsername };
                    if (newPassword) updates.password = newPassword;
                    if (!isEditingMaster) {
                        updates.permissions = permissions;
                        updates.isMaster = isMaster;
                    }

                    const result = await this.auth.updateUser(userToEdit.id, updates);
                    if (result.success) {
                        window.showNotification?.('Usuario Actualizado', `"${newUsername}" guardado correctamente.`, 'success');
                        closeModal();
                        await this.renderUsers();
                        if (this.currentUser?.id === userToEdit.id && newPassword) {
                            alert('⚠️ Tu contraseña cambió. Inicia sesión nuevamente.');
                            this.auth.logout();
                        }
                    } else {
                        alert(`❌ Error: ${result.error}`);
                        saveBtn.innerHTML = '💾 Guardar Cambios';
                        saveBtn.disabled = false;
                    }
                } else {
                    const result = await this.auth.createUser(newUsername, newPassword, permissions, isMaster);
                    if (result.success) {
                        window.showNotification?.('Usuario Creado', `"${newUsername}" registrado exitosamente.`, 'success');
                        closeModal();
                        await this.renderUsers();
                    } else {
                        alert(`❌ Error: ${result.error}`);
                        saveBtn.innerHTML = '✅ Crear Usuario';
                        saveBtn.disabled = false;
                    }
                }
            } catch (error) {
                alert(`❌ Error inesperado: ${error.message}`);
                saveBtn.disabled = false;
            }
        };
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
    
    async migrateMasterToCompleto() {
        const users = await this.auth.getAllUsers();
        const otherMasters = users.filter(u => u.is_master && u.id !== this.currentUser?.id);

        if (otherMasters.length === 0) {
            window.showNotification?.('Sin cambios', 'No hay otros usuarios MASTER que convertir.', 'info');
            return;
        }

        const names = otherMasters.map(u => u.username).join(', ');
        if (!confirm(`⚠️ Esto convertirá a los siguientes usuarios de MASTER → COMPLETO:\n\n${names}\n\nEllos mantendrán acceso total a todas las secciones, pero solo tú (MASTER) podrás editarlos.\n\n¿Continuar?`)) return;

        let ok = 0;
        let fail = 0;
        for (const user of otherMasters) {
            const { error } = await supabase
                .from('usuarios')
                .update({ is_master: false, permisos: ALL_PERMISSIONS })
                .eq('id', user.id);
            if (error) { console.error('Error migrando:', user.username, error); fail++; }
            else ok++;
        }

        if (ok > 0) {
            window.showNotification?.('Migración Completa', `${ok} usuario(s) convertidos a COMPLETO. ${fail > 0 ? fail + ' fallaron.' : ''}`, ok > 0 ? 'success' : 'error');
            await this.renderUsers();
        } else {
            alert('❌ No se pudo completar la migración. Revisa la consola.');
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
}