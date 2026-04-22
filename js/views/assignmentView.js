// js/views/assignmentView.js
import { 
    supabase,
    getActiveTxt,
    createNewTxt, 
    replaceTxt,
    extractNKFromContent
} from '../core/supabaseClient.js';

export class AssignmentView {
    constructor(app) {
        this.app = app;
        this.assignments = [];
        this.init();
    }
    
    async init() {
        this.attachEvents();
        this.loadTxtList();
        this.loadUsersList();
        this.loadAssignmentsFromSupabase();
        
        // Actualizar automáticamente cada 10 segundos
        setInterval(() => {
            this.loadAssignmentsFromSupabase();
        }, 10000);
    }
    
    async loadAssignmentsFromSupabase() {
        try {
            const { data, error } = await supabase
                .from('assignments')
                .select('*')
                .order('fecha_asignacion', { ascending: false });
            
            if (error) throw error;
            
            this.assignments = data || [];
            this.renderHistory();
            this.renderAlerts();
            
        } catch (error) {
            console.error('Error cargando asignaciones:', error);
            this.assignments = [];
        }
    }
    
    async loadUsersList() {
        const userSelect = document.getElementById('assignmentUserSelect');
        if (!userSelect) return;
        
        userSelect.innerHTML = '<option value="">-- Seleccionar usuario --</option>';
        
        try {
            const { data, error } = await supabase
                .from('usuarios')
                .select('id, username, is_master')
                .order('username');
            
            if (error) throw error;
            
            if (!data || data.length === 0) {
                userSelect.innerHTML = '<option value="">-- No hay usuarios registrados --</option>';
                return;
            }
            
            data.forEach(user => {
                const option = document.createElement('option');
                option.value = user.username;
                const masterTag = user.is_master ? ' 👑' : '';
                option.textContent = `👤 ${user.username}${masterTag}`;
                userSelect.appendChild(option);
            });
            
        } catch (error) {
            console.error('Error cargando usuarios:', error);
            userSelect.innerHTML = '<option value="">-- Error al cargar usuarios --</option>';
        }
    }
    
    attachEvents() {
        const plotterSelect = document.getElementById('assignmentPlotterSelect');
        if (plotterSelect) {
            plotterSelect.addEventListener('change', () => this.loadTxtList());
        }
        
        const plotterSelectGestion = document.getElementById('plotterSelect');
        const txtFileInput = document.getElementById('txtFileInput');
        
        if (plotterSelectGestion) {
            plotterSelectGestion.addEventListener('change', () => this.checkExistingTxt());
        }
        if (txtFileInput) {
            txtFileInput.addEventListener('change', () => this.checkExistingTxt());
        }
        
        const uploadNewBtn = document.getElementById('uploadNewBtn');
        if (uploadNewBtn) {
            uploadNewBtn.onclick = () => this.uploadNewTxt();
        }
        
        const replaceBtn = document.getElementById('replaceBtn');
        if (replaceBtn) {
            replaceBtn.onclick = () => this.replaceTxt();
        }
        
        const assignBtn = document.getElementById('assignWorkBtn');
        if (assignBtn) {
            assignBtn.onclick = () => this.assignWork();
        }
        
        const clearBtn = document.getElementById('clearAssignmentBtn');
        if (clearBtn) {
            clearBtn.onclick = () => this.clearForm();
        }
        
        const clearAllBtn = document.getElementById('clearAllAssignmentsBtn');
        if (clearAllBtn) {
            clearAllBtn.onclick = () => this.clearAllAssignments();
        }
    }
    
    async checkExistingTxt() {
        const plotter = document.getElementById('plotterSelect')?.value;
        const txtInfo = document.getElementById('txtInfo');
        const replaceBtn = document.getElementById('replaceBtn');
        const uploadNewBtn = document.getElementById('uploadNewBtn');
        const txtFileInput = document.getElementById('txtFileInput');
        
        if (!plotter || !txtFileInput?.files?.length) {
            if (txtInfo) txtInfo.innerHTML = '';
            if (replaceBtn) replaceBtn.disabled = true;
            if (uploadNewBtn) uploadNewBtn.disabled = !txtFileInput?.files?.length;
            return;
        }
        
        const file = txtFileInput.files[0];
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            const contenido = e.target.result;
            const nk = extractNKFromContent(contenido);
            
            if (!nk) {
                if (txtInfo) txtInfo.innerHTML = '<span style="color: #f87171;">❌ No se pudo extraer NK del archivo</span>';
                if (replaceBtn) replaceBtn.disabled = true;
                if (uploadNewBtn) uploadNewBtn.disabled = false;
                return;
            }
            
            const existing = await getActiveTxt(nk, parseInt(plotter));
            
            if (existing) {
                if (txtInfo) {
                    txtInfo.innerHTML = `
                        <span style="color: #eab308;">⚠️ Ya existe un TXT para ${nk} en Plotter ${plotter}</span><br>
                        <span>📄 Versión: v${existing.version} | 📅 Carga: ${new Date(existing.fecha_carga).toLocaleString()} | 👤 Usuario: ${existing.usuario_carga}</span>
                        <span style="color: #4ade80; margin-left: 1rem;">✅ Activo</span>
                    `;
                }
                if (replaceBtn) replaceBtn.disabled = false;
                if (uploadNewBtn) uploadNewBtn.disabled = false;
            } else {
                if (txtInfo) {
                    txtInfo.innerHTML = `<span style="color: #4ade80;">✅ No existe TXT para ${nk} en Plotter ${plotter}. Puede cargar uno nuevo.</span>`;
                }
                if (replaceBtn) replaceBtn.disabled = true;
                if (uploadNewBtn) uploadNewBtn.disabled = false;
            }
        };
        
        reader.readAsText(file, 'UTF-8');
    }
    
    async loadTxtList() {
        const plotter = document.getElementById('assignmentPlotterSelect')?.value;
        const txtSelect = document.getElementById('assignmentTxtSelect');
        
        if (!txtSelect) return;
        
        txtSelect.innerHTML = '<option value="">-- Seleccionar archivo --</option>';
        
        if (!plotter) return;
        
        try {
            const { data, error } = await supabase
                .from('library_txt')
                .select('*')
                .eq('plotter', parseInt(plotter))
                .eq('activo', true)
                .order('nk');
            
            if (error) throw error;
            
            if (!data || data.length === 0) {
                txtSelect.innerHTML = '<option value="">-- No hay archivos para este plotter --</option>';
                return;
            }
            
            data.forEach(txt => {
                const option = document.createElement('option');
                option.value = txt.id;
                option.textContent = `${txt.nk} - v${txt.version} - ${txt.colores_count || 0} colores - ${new Date(txt.fecha_carga).toLocaleDateString()}`;
                option.dataset.nk = txt.nk;
                option.dataset.plotter = txt.plotter;
                option.dataset.version = txt.version;
                option.dataset.contenido = txt.contenido;
                option.dataset.nombreArchivo = txt.nombre_archivo;
                txtSelect.appendChild(option);
            });
            
        } catch (error) {
            console.error('Error cargando TXTs:', error);
            txtSelect.innerHTML = '<option value="">-- Error al cargar archivos --</option>';
        }
    }
    
    async uploadNewTxt() {
        const plotter = document.getElementById('plotterSelect')?.value;
        const fileInput = document.getElementById('txtFileInput');
        const reason = document.getElementById('txtReason')?.value.trim() || '';
        const currentUser = this.app?.auth?.getCurrentUser()?.username || 'usuario';
        
        if (!plotter) {
            alert('⚠️ Seleccione un Plotter');
            return;
        }
        
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            alert('⚠️ Seleccione un archivo TXT');
            return;
        }
        
        const file = fileInput.files[0];
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            const contenido = e.target.result;
            const nombreArchivo = file.name;
            const nk = extractNKFromContent(contenido);
            
            if (!nk) {
                alert('❌ No se pudo extraer el NK del archivo. Asegúrese que el archivo contenga un NK (ej: NK711075)');
                return;
            }
            
            const result = await createNewTxt(nk, parseInt(plotter), contenido, nombreArchivo, currentUser, reason);
            
            if (result.success) {
                if (result.isNewVersion) {
                    alert(`✅ Nueva versión (v${result.data.version}) creada para ${nk} en Plotter ${plotter}`);
                } else {
                    alert(`✅ TXT creado para ${nk} en Plotter ${plotter}`);
                }
                
                fileInput.value = '';
                document.getElementById('txtReason').value = '';
                document.getElementById('txtInfo').innerHTML = '';
                this.loadTxtList();
            } else {
                alert(`❌ Error: ${result.error}`);
            }
        };
        reader.readAsText(file, 'UTF-8');
    }
    
    async replaceTxt() {
        const plotter = document.getElementById('plotterSelect')?.value;
        const fileInput = document.getElementById('txtFileInput');
        const reason = document.getElementById('txtReason')?.value.trim() || '';
        const currentUser = this.app?.auth?.getCurrentUser()?.username || 'usuario';
        
        if (!plotter) {
            alert('⚠️ Seleccione un Plotter');
            return;
        }
        
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            alert('⚠️ Seleccione un archivo TXT');
            return;
        }
        
        const file = fileInput.files[0];
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            const contenido = e.target.result;
            const nombreArchivo = file.name;
            const nk = extractNKFromContent(contenido);
            
            if (!nk) {
                alert('❌ No se pudo extraer el NK del archivo');
                return;
            }
            
            const confirmReplace = confirm(`¿Está seguro de reemplazar ${nk} en Plotter ${plotter}? Se creará una nueva versión.`);
            if (!confirmReplace) return;
            
            const result = await replaceTxt(nk, parseInt(plotter), contenido, nombreArchivo, currentUser, reason);
            
            if (result.success) {
                alert(`✅ TXT reemplazado. Nueva versión: v${result.data.version}`);
                fileInput.value = '';
                document.getElementById('txtReason').value = '';
                document.getElementById('txtInfo').innerHTML = '';
                this.loadTxtList();
            } else {
                alert(`❌ Error: ${result.error}`);
            }
        };
        reader.readAsText(file, 'UTF-8');
    }
    
    async assignWork() {
        const txtSelect = document.getElementById('assignmentTxtSelect');
        const plotterSelect = document.getElementById('assignmentPlotterSelect');
        const userSelect = document.getElementById('assignmentUserSelect');
        const commentTextarea = document.getElementById('assignmentComment');
        
        const selectedOption = txtSelect?.options[txtSelect.selectedIndex];
        const txtId = txtSelect?.value;
        const plotter = plotterSelect?.value;
        const assignedUser = userSelect?.value;
        const comment = commentTextarea?.value.trim() || '';
        
        if (!txtId) {
            alert('⚠️ Seleccione un archivo TXT.');
            return;
        }
        
        if (!plotter) {
            alert('⚠️ Seleccione un plotter.');
            return;
        }
        
        if (!assignedUser) {
            alert('⚠️ Seleccione un usuario.');
            return;
        }
        
        const txtName = selectedOption?.dataset.nombreArchivo || txtSelect.options[txtSelect.selectedIndex]?.text;
        const contenido = selectedOption?.dataset.contenido;
        
        if (!contenido) {
            alert('❌ No se pudo obtener el contenido del archivo.');
            return;
        }
        
        const { data, error } = await supabase
            .from('assignments')
            .insert({
                txt_id: txtId,
                txt_nombre: txtName,
                plotter: parseInt(plotter),
                usuario_asignado: assignedUser,
                comentario: comment,
                progreso: 0,
                estado: 'pendiente',
                contenido: contenido,
                fecha_asignacion: new Date().toISOString()
            })
            .select();
        
        if (error) {
            console.error('Error al guardar asignación:', error);
            alert(`❌ Error al asignar: ${error.message}`);
            return;
        }
        
        alert(`✅ Trabajo asignado a "${assignedUser}" para el archivo "${txtName}"`);
        this.clearForm();
        this.loadAssignmentsFromSupabase();
    }
    
    clearForm() {
        const txtSelect = document.getElementById('assignmentTxtSelect');
        const userSelect = document.getElementById('assignmentUserSelect');
        const commentTextarea = document.getElementById('assignmentComment');
        
        if (txtSelect) txtSelect.value = '';
        if (userSelect) userSelect.value = '';
        if (commentTextarea) commentTextarea.value = '';
    }
    
    async clearAllAssignments() {
        if (confirm('⚠️ ¿Estás seguro de que quieres eliminar TODAS las asignaciones? Esta acción no se puede deshacer.')) {
            try {
                const { error } = await supabase.from('assignments').delete().neq('id', 0);
                if (error) throw error;
                await this.loadAssignmentsFromSupabase();
                alert('✅ Todas las asignaciones han sido eliminadas.');
            } catch (error) {
                console.error('Error eliminando asignaciones:', error);
                alert(`❌ No se pudieron limpiar las asignaciones: ${error.message || error}`);
            }
        }
    }
    
    renderHistory() {
        const container = document.getElementById('assignmentHistoryList');
        if (!container) return;
        
        if (this.assignments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <p>No hay asignaciones registradas</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.assignments.map(assignment => {
            const progress = assignment.progreso || 0;
            const statusClass = progress === 100 ? 'completed-badge' : '';
            const statusText = progress === 100 ? '✅ Completado' : '⏳ En progreso';
            
            return `
                <div class="assignment-item" data-id="${assignment.id}">
                    <div class="assignment-item-header">
                        <div>
                            <span class="assignment-badge plotter">🖨️ Plotter ${assignment.plotter}</span>
                            <span class="assignment-badge user">👤 ${assignment.usuario_asignado}</span>
                        </div>
                        <div class="assignment-date">${new Date(assignment.fecha_asignacion).toLocaleString()}</div>
                    </div>
                    <div class="assignment-details">
                        <p><strong>📄 Archivo:</strong> <span class="assignment-filename">${assignment.txt_nombre || assignment.txt_id}</span></p>
                        ${assignment.comentario ? `<p><strong>💬 Comentario:</strong> ${assignment.comentario}</p>` : ''}
                    </div>
                    <div class="assignment-progress">
                        <div class="progress-container">
                            <div class="progress-bar" style="width: ${progress}%"></div>
                        </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderAlerts() {
        const container = document.getElementById('assignmentAlertsList');
        if (!container) return;

        // Filtrar archivos completados (100% de progreso)
        const completed = this.assignments.filter(a => a.progreso === 100 || a.estado === 'completado');

        if (completed.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">✅</div>
                    <p>No hay archivos completados para gestionar re-validación</p>
                </div>
            `;
            return;
        }

        container.innerHTML = completed.map(a => {
            const validez = a.validez_dias || 0;
            let statusBadge = '';
            let statusStyle = '';
            
            if (validez > 0) {
                const fechaFin = new Date(a.updated_at || a.fecha_asignacion);
                const diasPasados = Math.floor((new Date() - fechaFin) / (1000 * 60 * 60 * 24));
                const esVencido = diasPasados >= validez;
                
                if (esVencido) {
                    const vencimiento = new Date(fechaFin);
                    vencimiento.setDate(vencimiento.getDate() + validez);
                    const diasVencido = Math.floor((new Date() - vencimiento) / (1000 * 60 * 60 * 24));
                    statusBadge = `<span class="assignment-badge" style="background: #ef4444; color: white;">🔴 VENCIDO (hace ${diasVencido} d)</span>`;
                    statusStyle = 'border-left: 4px solid #f87171; background: rgba(248, 113, 113, 0.05);';
                } else {
                    statusBadge = `<span class="assignment-badge" style="background: #10b981; color: white;">🟢 VIGENTE (${validez - diasPasados} d restantes)</span>`;
                    statusStyle = 'border-left: 4px solid #10b981; background: rgba(16, 185, 129, 0.05);';
                }
            } else {
                statusBadge = `<span class="assignment-badge" style="background: #6b7280; color: white;">⚪ SIN TIMER</span>`;
                statusStyle = 'border-left: 4px solid #6b7280;';
            }

            return `
                <div class="assignment-item" style="${statusStyle} margin-bottom: 1rem; padding: 1rem;">
                    <div class="assignment-item-header">
                        <div>
                            ${statusBadge}
                            <span class="assignment-badge plotter">🖨️ Plotter ${a.plotter}</span>
                            <span class="assignment-badge user">👤 ${a.usuario_asignado}</span>
                        </div>
                        <div class="assignment-date">Finalizado: ${new Date(a.updated_at || a.fecha_asignacion).toLocaleDateString()}</div>
                    </div>
                    <div class="assignment-details">
                        <p><strong>📄 Archivo:</strong> <span class="assignment-filename">${a.txt_nombre || a.txt_id}</span></p>
                    </div>
                    
                    <div style="margin-top: 1rem; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; background: #1e1e2c; padding: 0.4rem 0.8rem; border-radius: 0.4rem; border: 1px solid #4b5563;">
                            <label style="font-size: 0.75rem; color: #9ca3af; margin: 0;">Validez (días):</label>
                            <input type="number" id="days-${a.id}" value="${validez || 30}" min="1" style="width: 60px; background: transparent; border: none; color: white; outline: none; font-weight: bold;">
                        </div>
                        <button class="btn-primary set-timer-btn" data-id="${a.id}" style="padding: 0.5rem 1rem; font-size: 0.8rem;">
                            <i class="fas fa-stopwatch"></i> ESTABLECER TIMER
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Agregar eventos a los botones
        container.querySelectorAll('.set-timer-btn').forEach(btn => {
            btn.onclick = () => {
                const id = btn.dataset.id;
                const daysInput = document.getElementById(`days-${id}`);
                const days = parseInt(daysInput?.value);
                if (days > 0) {
                    this.updateAssignmentTimer(id, days);
                } else {
                    alert('⚠️ Por favor ingrese un número de días válido.');
                }
            };
        });
    }

    async updateAssignmentTimer(assignmentId, days) {
        try {
            const { error } = await supabase
                .from('assignments')
                .update({ 
                    validez_dias: days
                })
                .eq('id', assignmentId);
            
            if (error) throw error;
            
            alert(`✅ Timer de re-validación establecido a ${days} días.`);
            await this.loadAssignmentsFromSupabase();
            
        } catch (error) {
            console.error('Error actualizando timer:', error);
            alert(`❌ Error al actualizar el timer: ${error.message}`);
        }
    }
}