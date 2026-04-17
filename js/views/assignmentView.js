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
        this.init();
    }
    
    async init() {
        this.attachEvents();
        this.loadTxtList();
        this.loadUsersList();
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
    }
    
    clearForm() {
        const txtSelect = document.getElementById('assignmentTxtSelect');
        const userSelect = document.getElementById('assignmentUserSelect');
        const commentTextarea = document.getElementById('assignmentComment');
        
        if (txtSelect) txtSelect.value = '';
        if (userSelect) userSelect.value = '';
        if (commentTextarea) commentTextarea.value = '';
    }
    
    clearAllAssignments() {
        if (confirm('⚠️ ¿Estás seguro de que quieres eliminar TODAS las asignaciones? Esta acción no se puede deshacer.')) {
            supabase.from('assignments').delete().neq('id', 0);
            alert('✅ Todas las asignaciones han sido eliminadas.');
        }
    }
}