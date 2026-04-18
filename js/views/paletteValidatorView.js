// js/views/paletteValidatorView.js
import { escapeHtml } from '../core/utils.js';
import { EPSView } from './epsView.js';
import { supabase } from '../core/supabaseClient.js';
import { EQUIVALENCY_ROWS } from '../core/constants.js';

export class PaletteValidatorView {
    constructor(app) {
        this.app = app;
        this.colors = [];
        this.nextId = 1;
        this.historyLog = [];
        this.currentUser = 'usuario';
        this.globalPlotter = 14;
        this.userAssignments = [];
        this.currentAssignment = null;
        
        this.tableBody = null;
        this.downloadTxtBtn = null;
        this.exportEpsBtn = null;
        this.sendToInboxBtn = null;
        this.loadLibraryBtn = null;
        this.uploadToDbBtn = null;
        this.plotterSelect = null;
        this.assignmentsListDiv = null;
        
        this.epsHelper = new EPSView(app);
        
        this.init();
    }
    
    async init() {
        this.tableBody = document.getElementById('validatorTableBody');
        this.downloadTxtBtn = document.getElementById('downloadTxtBtn');
        this.exportEpsBtn = document.getElementById('exportEpsBtn');
        this.sendToInboxBtn = document.getElementById('sendToInboxBtn');
        this.loadLibraryBtn = document.getElementById('loadLibraryBtn');
        this.uploadToDbBtn = document.getElementById('uploadToDbBtn');
        this.plotterSelect = document.getElementById('globalPlotter');
        
        if (!this.tableBody) return;
        
        const currentUser = this.app?.auth?.getCurrentUser();
        this.currentUser = currentUser?.username || 'usuario';
        
        await this.loadUserAssignments();
        this.renderAssignmentsList();
        this.checkAndRecoverWork();
        
        if (this.plotterSelect) {
            this.plotterSelect.value = this.globalPlotter;
            this.plotterSelect.addEventListener('change', (e) => {
                this.globalPlotter = parseInt(e.target.value);
                this.updateLibrarySelect();
            });
        }
        
        if (this.loadLibraryBtn) {
            this.loadLibraryBtn.textContent = '📥 Cargar TXT asignado';
            this.loadLibraryBtn.onclick = () => this.loadAssignedTxt();
        }
        
        if (this.uploadToDbBtn) {
            this.uploadToDbBtn.remove();
            this.uploadToDbBtn = null;
        }
        
        if (this.downloadTxtBtn) {
            this.downloadTxtBtn.onclick = () => this.downloadTXT();
        }
        
        if (this.exportEpsBtn) {
            this.exportEpsBtn.onclick = () => this.exportEPS();
        }
        
        if (this.sendToInboxBtn) {
            this.sendToInboxBtn.onclick = () => this.showSendToInboxModal();
        }
        
        this.resetTable();
    }

    async loadAssignedTxt() {
        await this.loadUserAssignments();
        this.renderAssignmentsList();

        if (this.currentAssignment) {
            const confirmReload = confirm(`⚠️ Ya tienes una asignación activa (${this.currentAssignment.txt_nombre || this.currentAssignment.txt_id}).\n\n¿Deseas cargar una nueva y descartar el trabajo actual sin guardar?`);
            if (!confirmReload) return;
        }

        if (!this.userAssignments || this.userAssignments.length === 0) {
            alert('⚠️ No tienes TXTs asignados pendientes.');
            return;
        }

        if (this.userAssignments.length === 1) {
            this.loadAssignmentContent(this.userAssignments[0]);
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 620px;">
                <div class="modal-header" style="background: #2d4ed6;">
                    <h3 style="color: white;">📥 Cargar TXT asignado</h3>
                    <button class="modal-close" style="color: white;">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="margin-bottom: 0.75rem;">Selecciona una asignación pendiente:</p>
                    <div style="display:flex; flex-direction:column; gap:0.5rem; max-height:360px; overflow:auto;">
                        ${this.userAssignments.map(item => `
                            <button class="assignment-picker" data-id="${item.id}" style="text-align:left; background:#1f1f2a; border:1px solid #374151; border-radius:8px; padding:0.7rem; color:#e5e7eb; cursor:pointer;">
                                <strong style="color:#00e5ff;">${this.escapeHtml(item.txt_nombre || item.txt_id)}</strong><br>
                                <span style="font-size:0.72rem; color:#9ca3af;">🖨️ Plotter ${item.plotter} · 📅 ${new Date(item.fecha_asignacion).toLocaleString()}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
                <div class="modal-buttons">
                    <button class="btn-secondary close-picker">Cerrar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);

        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 250);
        };
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.close-picker').onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };

        modal.querySelectorAll('.assignment-picker').forEach(btn => {
            btn.onclick = () => {
                const id = parseInt(btn.dataset.id);
                const assignment = this.userAssignments.find(a => a.id === id);
                if (assignment) {
                    closeModal();
                    this.loadAssignmentContent(assignment);
                }
            };
        });
    }
    
    async loadUserAssignments() {
        try {
            const { data, error } = await supabase
                .from('assignments')
                .select('*')
                .eq('usuario_asignado', this.currentUser)
                .eq('estado', 'pendiente')
                .order('fecha_asignacion', { ascending: false });
            
            if (error) throw error;
            
            this.userAssignments = data || [];
            console.log(`📋 Asignaciones cargadas para ${this.currentUser}:`, this.userAssignments.length);
            
        } catch (error) {
            console.error('Error cargando asignaciones:', error);
            this.userAssignments = [];
        }
    }
    
    async updateAssignmentProgress(assignmentId, progress) {
        try {
            const newEstado = progress === 100 ? 'completado' : 'pendiente';
            const { error } = await supabase
                .from('assignments')
                .update({ 
                    progreso: progress,
                    estado: newEstado
                })
                .eq('id', assignmentId);
            
            if (error) throw error;
            
            const assignment = this.userAssignments.find(a => a.id === assignmentId);
            if (assignment) {
                assignment.progreso = progress;
                assignment.estado = newEstado;
            }
            
            this.renderAssignmentsList();
            
        } catch (error) {
            console.error('Error actualizando progreso:', error);
        }
    }
    
    async saveLockedColor(assignmentId, colorName, nk, colorIndex, cmyk) {
        try {
            const { error } = await supabase
                .from('validation_progress')
                .upsert({
                    assignment_id: assignmentId,
                    usuario: this.currentUser,
                    nk: nk,
                    color_name: colorName,
                    color_index: colorIndex,
                    status: 'locked',
                    modified_cmyk: cmyk,
                    modified_at: new Date().toISOString()
                }, {
                    onConflict: 'assignment_id,color_name,usuario'
                });
            
            if (error) throw error;
            console.log(`✅ Color guardado: ${colorName}`);
            
        } catch (error) {
            console.error('Error guardando color:', error);
        }
    }
    
    async loadLockedColors(assignmentId) {
        try {
            const { data, error } = await supabase
                .from('validation_progress')
                .select('*')
                .eq('assignment_id', assignmentId)
                .eq('usuario', this.currentUser)
                .eq('status', 'locked');
            
            if (error) throw error;
            
            console.log(`📥 Colores bloqueados cargados: ${data?.length || 0}`);
            return data || [];
            
        } catch (error) {
            console.error('Error cargando colores bloqueados:', error);
            return [];
        }
    }
    
    renderAssignmentsList() {
        const container = document.querySelector('.palette-validator-container');
        if (!container) return;
        
        const existingList = document.getElementById('assignmentsList');
        if (existingList) existingList.remove();
        
        const activeId = localStorage.getItem('activeAssignmentId');
        const assignmentsToShow = activeId 
            ? this.userAssignments.filter(a => a.id !== parseInt(activeId))
            : this.userAssignments;

        if (assignmentsToShow.length === 0 && !activeId) {
            return;
        }
        
        const listDiv = document.createElement('div');
        listDiv.id = 'assignmentsList';
        listDiv.style.cssText = 'background: #0c0c12; border: 1px solid #2d3748; border-radius: 10px; padding: 1rem; margin-bottom: 1.5rem;';
        listDiv.innerHTML = `
            <h4 style="color: #eab308; margin-bottom: 0.75rem; font-size: 0.9rem;">
                <i class="fas fa-tasks"></i> Otras Asignaciones Pendientes (${assignmentsToShow.length})
            </h4>
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                ${assignmentsToShow.length === 0 ? '<div style="color:#6b7280; font-size:0.8rem; text-align:center; padding:0.5rem;">No hay más asignaciones pendientes</div>' : ''}
                ${assignmentsToShow.map(assignment => {
                    const progress = assignment.progreso || 0;
                    return `
                        <div class="assignment-item-select" data-id="${assignment.id}" style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #1f1f2a; border: 1px solid #2d3748; border-radius: 8px; cursor: pointer;">
                            <div style="flex: 1;">
                                <strong style="color: #00e5ff;">${assignment.txt_nombre || assignment.txt_id}</strong>
                                <div style="font-size: 0.7rem; color: #9ca3af;">📅 ${new Date(assignment.fecha_asignacion).toLocaleString()}</div>
                                <div style="margin-top: 0.5rem;">
                                    <div style="background: #2d3748; border-radius: 10px; height: 6px; width: 100%; overflow: hidden;">
                                        <div style="background: linear-gradient(90deg, #00e5ff, #0099cc); width: ${progress}%; height: 100%; border-radius: 10px;"></div>
                                    </div>
                                    <div style="font-size: 0.65rem; color: #9ca3af; margin-top: 0.2rem;">Progreso: ${progress}%</div>
                                </div>
                            </div>
                            <button class="btn-load-assignment" data-id="${assignment.id}" style="background: transparent; border: 1.5px solid #4ade80; color: #4ade80; padding: 0.3rem 0.8rem; border-radius: 6px; cursor: pointer; margin-left: 1rem;">
                                <i class="fas fa-folder-open"></i> Cargar
                            </button>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        container.insertBefore(listDiv, container.firstChild);
        
        document.querySelectorAll('.btn-load-assignment').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                const assignment = this.userAssignments.find(a => a.id === id);
                if (assignment) {
                    this.loadAssignmentContent(assignment);
                }
            };
        });
        
        document.querySelectorAll('.assignment-item-select').forEach(item => {
            item.onclick = (e) => {
                if (e.target.classList.contains('btn-load-assignment')) return;
                const id = parseInt(item.dataset.id);
                const assignment = this.userAssignments.find(a => a.id === id);
                if (assignment) {
                    this.loadAssignmentContent(assignment);
                }
            };
        });
    }
    
    async loadAssignmentContent(assignment) {
        if (!assignment || !assignment.contenido) {
            alert('❌ No se pudo obtener el contenido del archivo.');
            return;
        }
        
        this.currentAssignment = assignment;
        localStorage.setItem('activeAssignmentId', assignment.id);
        
        const lockedColors = await this.loadLockedColors(assignment.id);
        
        // Cargar primero del localStorage si existe trabajo más reciente
        const localData = this.loadLocalProgress(assignment.id);
        
        this.parseAndLoadContentWithLocked(assignment.contenido, assignment.txt_nombre || assignment.txt_id, lockedColors, localData);
        
        setTimeout(async () => {
            const totalColors = this.colors.length;
            const lockedColorsCount = this.colors.filter(c => c.isLocked).length;
            const progress = totalColors > 0 ? Math.round((lockedColorsCount / totalColors) * 100) : 0;
            
            const progressBarFill = document.getElementById('progressBarFill');
            const progressPercent = document.getElementById('progressPercent');
            if (progressBarFill) progressBarFill.style.width = `${progress}%`;
            if (progressPercent) progressPercent.textContent = progress;
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'assignment-info';
            infoDiv.id = 'currentAssignmentInfo';
            infoDiv.style.cssText = 'background: rgba(0, 229, 255, 0.1); border: 1px solid #00e5ff; border-radius: 8px; padding: 0.75rem; margin-bottom: 1rem; font-size: 0.75rem;';
            infoDiv.innerHTML = `
                <strong><i class="fas fa-tasks"></i> Asignación actual:</strong><br>
                📄 Archivo: ${assignment.txt_nombre || assignment.txt_id}<br>
                🖨️ Plotter: ${assignment.plotter}<br>
                💬 Comentario: ${assignment.comentario || 'Sin comentario'}<br>
                📅 Fecha: ${new Date(assignment.fecha_asignacion).toLocaleString()}
                <div style="margin-top: 0.5rem;">
                    <div style="background: #2d3748; border-radius: 10px; height: 6px; width: 100%; overflow: hidden;">
                        <div id="progressBarFill" style="background: linear-gradient(90deg, #00e5ff, #0099cc); width: ${progress}%; height: 100%; border-radius: 10px;"></div>
                    </div>
                    <div style="font-size: 0.65rem; color: #9ca3af; margin-top: 0.2rem;">Progreso: <span id="progressPercent">${progress}</span>%</div>
                </div>
            `;
            
            const container = document.querySelector('.palette-validator-container');
            const existingInfo = document.getElementById('currentAssignmentInfo');
            if (existingInfo) existingInfo.remove();
            if (container) {
                container.insertBefore(infoDiv, container.firstChild);
            }
        }, 100);
    }
    
    isValidColorName(colorName) {
        const upperName = colorName.toUpperCase().trim();
        for (const row of EQUIVALENCY_ROWS) {
            for (let i = 1; i < row.length; i++) {
                if (row[i].toUpperCase() === upperName) {
                    return true;
                }
            }
        }
        return false;
    }
    
    getCorrectedColorName(colorName) {
        const upperName = colorName.toUpperCase().trim();
        for (const row of EQUIVALENCY_ROWS) {
            for (let i = 1; i < row.length; i++) {
                if (row[i].toUpperCase() === upperName) {
                    return row[i];
                }
            }
        }
        return colorName;
    }
    
    parseAndLoadContentWithLocked(content, fileName, lockedColors, localData = null) {
        const lines = content.split(/\r?\n/);
        let dataStarted = false;
        const loadedColors = [];
        let invalidCount = 0;
        
        console.log('Aplicando bloqueos a:', lockedColors.length, 'colores');
        
        for (let line of lines) {
            if (line.trim() === '') continue;
            if (line.trim() === 'BEGIN_DATA') { dataStarted = true; continue; }
            if (dataStarted && line.trim() === 'END_DATA') break;
            if (!dataStarted) continue;
            
            const match = line.match(/^(\d+)\.?\s+(?:"([^"]+)"|([^\s]+(?:\s+[^\s]+)*?))\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)(?:\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+))?/);
            if (match) {
                let fullName = match[2] || match[3];
                if (fullName) {
                    let nk = '';
                    if (this.app && this.app.extractNK) {
                        nk = this.app.extractNK(fullName) || 'NK001';
                    } else {
                        const nkMatch = fullName.match(/(NK\d+|T\d+)/i);
                        nk = nkMatch ? nkMatch[1] : 'NK001';
                    }
                    
                    let name = fullName.replace(/\s+(NK\d+|T\d+)$/i, '').trim();
                    
                    const isValid = this.isValidColorName(name);
                    if (!isValid) {
                        invalidCount++;
                        console.warn(`⚠️ Color no válido: "${name}"`);
                    }
                    
                    const correctedName = this.getCorrectedColorName(name);
                    
                    let lVal = 100, aVal = 0, bVal = 0;
                    if (match[8] && match[9] && match[10]) {
                        lVal = parseFloat(match[8]);
                        aVal = parseFloat(match[9]);
                        bVal = parseFloat(match[10]);
                    }
                    
                    // Prioridad 1: LocalStorage, Prioridad 2: Supabase, Prioridad 3: Archivo original
                    const locked = lockedColors.find(l => l.color_name === correctedName && l.nk === nk);
                    const localColor = localData ? localData.find(c => c.name === correctedName && c.nk === nk) : null;
                    
                    const isLocked = (localColor && localColor.isLocked) || (locked ? true : false);
                    
                    let cmyk = {
                        c: parseFloat(match[4]),
                        m: parseFloat(match[5]),
                        y: parseFloat(match[6]),
                        k: parseFloat(match[7])
                    };

                    if (localColor) {
                        cmyk = { ...localColor.cmyk };
                    } else if (locked && locked.modified_cmyk) {
                        cmyk = { ...locked.modified_cmyk };
                    }
                    
                    loadedColors.push({
                        name: correctedName,
                        originalName: name,
                        nk: nk,
                        isValid: isValid,
                        cmyk: cmyk,
                        lab: { l: lVal, a: aVal, b: bVal },
                        channels: localColor ? { ...localColor.channels } : { tq: 0, o: 0, fy: 0, fp: 0 },
                        isLocked: isLocked
                    });
                    
                    if (isLocked) {
                        console.log(`🔒 Color bloqueado restaurado: ${correctedName}`);
                    }
                }
            }
        }
        
        if (loadedColors.length > 0) {
            this.colors = [];
            this.nextId = 1;
            for (let i = 0; i < loadedColors.length; i++) {
                this.addColor(loadedColors[i], i);
            }
            this.renderTable();
            this.checkButtonsState();
            
            const lockedCount = this.colors.filter(c => c.isLocked).length;
            console.log(`📊 Progreso restaurado: ${lockedCount}/${loadedColors.length} colores bloqueados`);
            
            let message = `✅ Cargados ${loadedColors.length} colores desde "${fileName}".`;
            if (invalidCount > 0) {
                message += `\n⚠️ Se encontraron ${invalidCount} nombres de color no válidos.`;
            }
            if (lockedCount > 0) {
                message += `\n🔒 Se restauraron ${lockedCount} colores previamente validados.`;
            }
            alert(message);
        } else {
            alert('⚠️ No se encontraron colores en el archivo.');
        }
    }
    
    updateLibrarySelect() {
        if (!this.librarySelect) return;
        const plotter = this.globalPlotter;
        const txts = this.app ? this.app.getTxtsByPlotter(plotter) : [];
        this.librarySelect.innerHTML = '<option value="">-- Seleccionar archivo --</option>';
        if (txts.length === 0) {
            this.librarySelect.innerHTML = '<option value="">-- No hay archivos para este plotter --</option>';
            return;
        }
        txts.forEach(txt => {
            const option = document.createElement('option');
            option.value = txt.name;
            option.textContent = `${txt.name} (${new Date(txt.uploadDate).toLocaleDateString()})`;
            this.librarySelect.appendChild(option);
        });
    }
    
    loadFromLibrary() {
        if (!this.librarySelect || !this.librarySelect.value) {
            alert('⚠️ Seleccione un archivo de la lista.');
            return;
        }
        const plotter = this.globalPlotter;
        const fileName = this.librarySelect.value;
        const txts = this.app.getTxtsByPlotter(plotter);
        const selected = txts.find(t => t.name === fileName);
        if (!selected) {
            alert('❌ No se encontró el archivo seleccionado.');
            return;
        }
        this.currentAssignment = null;
        this.parseAndLoadContent(selected.content, fileName);
        
        const existingInfo = document.getElementById('currentAssignmentInfo');
        if (existingInfo) existingInfo.remove();
    }
    
    parseAndLoadContent(content, fileName) {
        const lines = content.split(/\r?\n/);
        let dataStarted = false;
        const loadedColors = [];
        let invalidCount = 0;
        
        for (let line of lines) {
            if (line.trim() === '') continue;
            if (line.trim() === 'BEGIN_DATA') { dataStarted = true; continue; }
            if (dataStarted && line.trim() === 'END_DATA') break;
            if (!dataStarted) continue;
            
            const match = line.match(/^(\d+)\.?\s+(?:"([^"]+)"|([^\s]+(?:\s+[^\s]+)*?))\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)(?:\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+))?/);
            if (match) {
                let fullName = match[2] || match[3];
                if (fullName) {
                    let nk = '';
                    if (this.app && this.app.extractNK) {
                        nk = this.app.extractNK(fullName) || 'NK001';
                    } else {
                        const nkMatch = fullName.match(/(NK\d+|T\d+)/i);
                        nk = nkMatch ? nkMatch[1] : 'NK001';
                    }
                    
                    let name = fullName.replace(/\s+(NK\d+|T\d+)$/i, '').trim();
                    
                    const isValid = this.isValidColorName(name);
                    if (!isValid) {
                        invalidCount++;
                        console.warn(`⚠️ Color no válido: "${name}"`);
                    }
                    
                    const correctedName = this.getCorrectedColorName(name);
                    
                    let lVal = 100, aVal = 0, bVal = 0;
                    if (match[8] && match[9] && match[10]) {
                        lVal = parseFloat(match[8]);
                        aVal = parseFloat(match[9]);
                        bVal = parseFloat(match[10]);
                    }
                    
                    loadedColors.push({
                        name: correctedName,
                        originalName: name,
                        nk: nk,
                        isValid: isValid,
                        cmyk: {
                            c: parseFloat(match[4]),
                            m: parseFloat(match[5]),
                            y: parseFloat(match[6]),
                            k: parseFloat(match[7])
                        },
                        lab: { l: lVal, a: aVal, b: bVal },
                        channels: { tq: 0, o: 0, fy: 0, fp: 0 },
                        isLocked: false
                    });
                }
            }
        }
        
        if (loadedColors.length > 0) {
            this.colors = [];
            this.nextId = 1;
            for (let i = 0; i < loadedColors.length; i++) {
                this.addColor(loadedColors[i], i);
            }
            this.renderTable();
            this.checkButtonsState();
            
            let message = `✅ Cargados ${loadedColors.length} colores desde "${fileName}".`;
            if (invalidCount > 0) {
                message += `\n⚠️ Se encontraron ${invalidCount} nombres de color no válidos en la tabla de equivalencias.`;
            }
            alert(message);
        } else {
            alert('⚠️ No se encontraron colores en el archivo.');
        }
    }
    
    showUploadModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header" style="background: #2d4ed6;">
                    <h3 style="color: white;">💾 Cargar TXT a Base de Datos</h3>
                    <button class="modal-close" style="color: white;">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>🖨️ Plotter:</label>
                        <select id="modalPlotterSelect" class="assignment-select" style="width:100%;">
                            <option value="">-- Seleccionar plotter --</option>
                            ${Array.from({length: 17}, (_, i) => `<option value="${i+1}" ${i+1 === this.globalPlotter ? 'selected' : ''}>Plotter ${i+1}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>📝 Motivo:</label>
                        <textarea id="modalReason" rows="3" placeholder="Ej: Nueva versión de la paleta..." style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></textarea>
                    </div>
                    <div class="form-group">
                        <label>📁 Archivo TXT:</label>
                        <input type="file" id="modalFileInput" accept=".txt" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;">
                    </div>
                    <div id="modalInfo" class="info-message" style="margin-top: 0.5rem; font-size: 0.75rem; color: #6b7280;"></div>
                </div>
                <div class="modal-buttons">
                    <button class="btn-secondary cancel-modal">Cancelar</button>
                    <button class="btn-primary confirm-modal" style="background: #4ade80; border: none;">💾 CARGAR</button>
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
        
        modal.querySelector('.confirm-modal').onclick = async () => {
            const plotter = modal.querySelector('#modalPlotterSelect')?.value;
            const reason = modal.querySelector('#modalReason')?.value.trim() || '';
            const file = modal.querySelector('#modalFileInput')?.files[0];
            const currentUser = this.app?.auth?.getCurrentUser()?.username || 'usuario';
            
            if (!plotter) {
                alert('⚠️ Seleccione un Plotter');
                return;
            }
            
            if (!file) {
                alert('⚠️ Seleccione un archivo TXT');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = async (e) => {
                const contenido = e.target.result;
                const nombreArchivo = file.name;
                const nkMatch = nombreArchivo.match(/(NK\d+)/i);
                const nk = nkMatch ? nkMatch[1] : 'NK000001';
                
                const { createNewTxt } = await import('../core/supabaseClient.js');
                const result = await createNewTxt(nk, parseInt(plotter), contenido, nombreArchivo, currentUser, reason);
                
                if (result.success) {
                    alert(`✅ TXT guardado en BD\n📁 Archivo: ${nombreArchivo}\n🖨️ Plotter: ${plotter}\n🔑 NK: ${nk}`);
                    closeModal();
                    this.parseAndLoadContent(contenido, nombreArchivo);
                } else {
                    alert(`❌ Error: ${result.error}`);
                }
            };
            reader.readAsText(file, 'UTF-8');
        };
        
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    }
    
    getGlobalPlotter() {
        return this.globalPlotter;
    }
    
    getPendingColors() {
        return this.colors.filter(color => !color.isLocked);
    }
    
    addColor(colorData, index = null) {
        const newId = this.nextId++;
        const newColor = {
            id: newId,
            name: colorData.name,
            originalName: colorData.originalName,
            nk: colorData.nk,
            isValid: colorData.isValid,
            cmyk: { ...colorData.cmyk },
            lab: { ...colorData.lab },
            channels: colorData.channels || { tq: 0, o: 0, fy: 0, fp: 0 },
            isLocked: colorData.isLocked || false,
            modificationHistory: []
        };
        this.colors.push(newColor);
        return newColor;
    }
    
    async lockColor(colorId) {
        const color = this.colors.find(c => c.id === colorId);
        if (!color || color.isLocked) return;
        
        color.isLocked = true;
        this.addToHistory(colorId, 'LOCK', 'Color marcado como bueno');
        
        const index = this.colors.findIndex(c => c.id === colorId);
        await this.saveLockedColor(
            this.currentAssignment.id, 
            color.name, 
            color.nk, 
            index, 
            color.cmyk
        );
        
        this.renderTable();
        this.checkButtonsState();
        
        // Calcular progreso actual
        const totalColors = this.colors.length;
        const lockedColors = this.colors.filter(c => c.isLocked).length;
        const progress = Math.round((lockedColors / totalColors) * 100);
        
        // Actualizar UI inmediatamente
        const progressBarFill = document.getElementById('progressBarFill');
        const progressPercent = document.getElementById('progressPercent');
        if (progressBarFill) progressBarFill.style.width = `${progress}%`;
        if (progressPercent) progressPercent.textContent = progress;
        
        // Guardar en BD
        await this.updateAssignmentProgress(this.currentAssignment.id, progress);
        
        // Guardar en Local
        this.saveLocalProgress();
        
        // ACTUALIZAR DASHBOARD EN TIEMPO REAL
        if (this.app?.dashboardView) {
            this.app.dashboardView.render().catch(err => console.error('Error actualizando dashboard:', err));
        }
        
        if (progress === 100) {
            this.checkButtonsState();
            alert('✅ Validación al 100%. Ahora puede enviar a bandeja.');
        }
    }
    
    async unlockColor(colorId, reason) {
        if (!reason || reason.trim() === '') {
            alert('⚠️ El motivo es obligatorio para desbloquear el color.');
            return false;
        }
        const color = this.colors.find(c => c.id === colorId);
        if (!color) return false;
        
        color.isLocked = false;
        this.addToHistory(colorId, 'UNLOCK', reason);
        
        await supabase
            .from('validation_progress')
            .delete()
            .eq('assignment_id', this.currentAssignment.id)
            .eq('color_name', color.name)
            .eq('usuario', this.currentUser);
        
        this.renderTable();
        this.checkButtonsState();
        
        // Calcular progreso actual
        const totalColors = this.colors.length;
        const lockedColors = this.colors.filter(c => c.isLocked).length;
        const progress = Math.round((lockedColors / totalColors) * 100);
        
        // Actualizar UI inmediatamente
        const progressBarFill = document.getElementById('progressBarFill');
        const progressPercent = document.getElementById('progressPercent');
        if (progressBarFill) progressBarFill.style.width = `${progress}%`;
        if (progressPercent) progressPercent.textContent = progress;
        
        // Guardar en BD
        await this.updateAssignmentProgress(this.currentAssignment.id, progress);
        
        // Guardar en Local
        this.saveLocalProgress();
        
        // ACTUALIZAR DASHBOARD EN TIEMPO REAL
        if (this.app?.dashboardView) {
            this.app.dashboardView.render().catch(err => console.error('Error actualizando dashboard:', err));
        }
        
        return true;
    }
    
    async updateColor(colorId, updates) {
        const color = this.colors.find(c => c.id === colorId);
        if (!color || color.isLocked) return;
        
        if (updates.name !== undefined) color.name = updates.name;
        if (updates.cmyk) {
            if (updates.cmyk.c !== undefined) color.cmyk.c = updates.cmyk.c;
            if (updates.cmyk.m !== undefined) color.cmyk.m = updates.cmyk.m;
            if (updates.cmyk.y !== undefined) color.cmyk.y = updates.cmyk.y;
            if (updates.cmyk.k !== undefined) color.cmyk.k = updates.cmyk.k;
        }
        if (updates.channels) {
            if (updates.channels.tq !== undefined) color.channels.tq = updates.channels.tq;
            if (updates.channels.o !== undefined) color.channels.o = updates.channels.o;
            if (updates.channels.fy !== undefined) color.channels.fy = updates.channels.fy;
            if (updates.channels.fp !== undefined) color.channels.fp = updates.channels.fp;
        }
        
        this.addToHistory(colorId, 'EDIT', `Modificado: ${color.name}`);
        this.renderTable();
        
        if (color.isLocked && this.currentAssignment) {
            const index = this.colors.findIndex(c => c.id === colorId);
            await this.saveLockedColor(
                this.currentAssignment.id, 
                color.name, 
                color.nk, 
                index, 
                color.cmyk
            );
            
            // Actualizar progreso
            const totalColors = this.colors.length;
            const lockedColors = this.colors.filter(c => c.isLocked).length;
            const progress = Math.round((lockedColors / totalColors) * 100);
            
            const progressBarFill = document.getElementById('progressBarFill');
            const progressPercent = document.getElementById('progressPercent');
            if (progressBarFill) progressBarFill.style.width = `${progress}%`;
            if (progressPercent) progressPercent.textContent = progress;
            
            await this.updateAssignmentProgress(this.currentAssignment.id, progress);
        }
        
        // Siempre guardar localmente tras una edición
        this.saveLocalProgress();
    }
    
    addToHistory(colorId, action, reason) {
        const entry = { id: Date.now(), colorId, action, reason, user: this.currentUser, timestamp: new Date().toISOString() };
        this.historyLog.push(entry);
        const color = this.colors.find(c => c.id === colorId);
        if (color) {
            if (!color.modificationHistory) color.modificationHistory = [];
            color.modificationHistory.push(entry);
        }
        if (this.historyLog.length > 100) this.historyLog.shift();
    }
    
    renderTable() {
        if (!this.tableBody) return;
        if (this.colors.length === 0) {
            this.tableBody.innerHTML = '<tr><td colspan="13" class="empty-state">Seleccione un archivo TXT o una asignación para comenzar<\/td><\/tr>';
            this.checkButtonsState();
            return;
        }
        
        this.tableBody.innerHTML = this.colors.map((color, index) => {
            const isLocked = color.isLocked;
            const disabledAttr = isLocked ? 'disabled' : '';
            const statusBadge = isLocked ? '<span class="status-badge locked">✅ Bueno (🔒)</span>' : '<span class="status-badge pending">⏳ Pendiente</span>';
            const actionButton = isLocked 
                ? `<button class="small-btn btn-modify" data-id="${color.id}" title="Modificar"><i class="fas fa-edit"></i></button>`
                : `<button class="small-btn btn-lock" data-id="${color.id}" title="Marcar como bueno"><i class="fas fa-check-circle"></i></button>`;
            const nameStyle = !color.isValid ? 'color: #f87171; text-decoration: line-through;' : '';
            const nameTitle = !color.isValid ? `Original: ${color.originalName}` : '';
            
            return `
                <tr class="${isLocked ? 'locked-row' : ''}" data-id="${color.id}">
                    <td class="row-number">${index + 1}${isLocked ? ' 🔒' : ''}<\/td>
                    <td><input type="text" class="color-name-input" value="${this.escapeHtml(color.name)}" style="${nameStyle}" title="${nameTitle}" disabled><\/td>
                    <td><input type="text" class="nk-input" value="${this.escapeHtml(color.nk)}" disabled><\/td>
                    <td><input type="number" step="0.000001" min="0" max="100" value="${color.cmyk.c.toFixed(6)}" ${disabledAttr} data-field="cmyk_c" data-id="${color.id}" class="cmyk-input"><\/td>
                    <td><input type="number" step="0.000001" min="0" max="100" value="${color.cmyk.m.toFixed(6)}" ${disabledAttr} data-field="cmyk_m" data-id="${color.id}" class="cmyk-input"><\/td>
                    <td><input type="number" step="0.000001" min="0" max="100" value="${color.cmyk.y.toFixed(6)}" ${disabledAttr} data-field="cmyk_y" data-id="${color.id}" class="cmyk-input"><\/td>
                    <td><input type="number" step="0.000001" min="0" max="100" value="${color.cmyk.k.toFixed(6)}" ${disabledAttr} data-field="cmyk_k" data-id="${color.id}" class="cmyk-input"><\/td>
                    <td><input type="number" step="0.000001" min="0" max="100" value="${color.channels.tq.toFixed(6)}" ${disabledAttr} data-field="channel_tq" data-id="${color.id}" class="channel-input"><\/td>
                    <td><input type="number" step="0.000001" min="0" max="100" value="${color.channels.o.toFixed(6)}" ${disabledAttr} data-field="channel_o" data-id="${color.id}" class="channel-input"><\/td>
                    <td><input type="number" step="0.000001" min="0" max="100" value="${color.channels.fy.toFixed(6)}" ${disabledAttr} data-field="channel_fy" data-id="${color.id}" class="channel-input"><\/td>
                    <td><input type="number" step="0.000001" min="0" max="100" value="${color.channels.fp.toFixed(6)}" ${disabledAttr} data-field="channel_fp" data-id="${color.id}" class="channel-input"><\/td>
                    <td class="status-cell">${statusBadge}<\/td>
                    <td class="actions-cell">${actionButton}<\/td>
                </tr>
            `;
        }).join('');
        
        const hasValidData = this.colors.some(c => c.name.trim() !== '');
        if (this.downloadTxtBtn) this.downloadTxtBtn.disabled = !hasValidData;
        if (this.exportEpsBtn) this.exportEpsBtn.disabled = !hasValidData;
        if (this.sendToInboxBtn) this.sendToInboxBtn.disabled = !hasValidData;
        
        this.attachInputEvents();
        this.attachActionEvents();
    }
    
    attachInputEvents() {
        const inputs = this.tableBody.querySelectorAll('input:not([disabled])');
        inputs.forEach(input => {
            input.removeEventListener('change', this.handleInputChange);
            input.addEventListener('change', (e) => this.handleInputChange(e));
        });
    }
    
    handleInputChange(e) {
        const input = e.target;
        const colorId = parseInt(input.dataset.id);
        const field = input.dataset.field;
        const color = this.colors.find(c => c.id === colorId);
        if (!color || color.isLocked) return;
        let num = parseFloat(input.value);
        if (isNaN(num)) num = 0;
        num = Math.min(100, Math.max(0, num));
        const updates = {};
        
        if (field === 'cmyk_c') updates.cmyk = { ...color.cmyk, c: num };
        else if (field === 'cmyk_m') updates.cmyk = { ...color.cmyk, m: num };
        else if (field === 'cmyk_y') updates.cmyk = { ...color.cmyk, y: num };
        else if (field === 'cmyk_k') updates.cmyk = { ...color.cmyk, k: num };
        else if (field === 'channel_tq') updates.channels = { ...color.channels, tq: num };
        else if (field === 'channel_o') updates.channels = { ...color.channels, o: num };
        else if (field === 'channel_fy') updates.channels = { ...color.channels, fy: num };
        else if (field === 'channel_fp') updates.channels = { ...color.channels, fp: num };
        
        if (Object.keys(updates).length > 0) this.updateColor(colorId, updates);
    }
    
    attachActionEvents() {
        const lockBtns = this.tableBody.querySelectorAll('.btn-lock');
        lockBtns.forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                this.lockColor(parseInt(btn.dataset.id));
            };
        });
        const modifyBtns = this.tableBody.querySelectorAll('.btn-modify');
        modifyBtns.forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                this.showUnlockModal(parseInt(btn.dataset.id));
            };
        });
    }
    
    showUnlockModal(colorId) {
        const color = this.colors.find(c => c.id === colorId);
        if (!color) return;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 450px;">
                <div class="modal-header" style="background: #b45309;">
                    <h3 style="color: white;">✏️ Modificar color</h3>
                    <button class="modal-close" style="color: white;">&times;</button>
                </div>
                <div class="modal-body">
                    <p><strong>Color:</strong> ${this.escapeHtml(color.name)} (${color.nk})</p>
                    <div class="form-group">
                        <label for="unlockReason">Motivo de la modificación:</label>
                        <textarea id="unlockReason" class="undo-reason-input" rows="3" placeholder="Ej: Se detectó un error en el valor CMYK..."></textarea>
                    </div>
                    <p style="color: #fbbf24; font-size: 0.75rem;">⚠️ El motivo es obligatorio para desbloquear el color.</p>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-secondary cancel-unlock">Cancelar</button>
                    <button class="btn btn-primary confirm-unlock">Desbloquear</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        const reasonTextarea = modal.querySelector('#unlockReason');
        const confirmBtn = modal.querySelector('.confirm-unlock');
        
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.cancel-unlock').onclick = closeModal;
        
        confirmBtn.onclick = () => {
            const reason = reasonTextarea.value.trim();
            if (!reason) {
                alert('⚠️ Debe ingresar un motivo para desbloquear el color.');
                return;
            }
            this.unlockColor(colorId, reason);
            closeModal();
        };
    }
    
    resetTable() {
        this.colors = [];
        this.nextId = 1;
        this.historyLog = [];
        this.renderTable();
        this.checkButtonsState();
    }
    
    checkButtonsState() {
        const hasValidData = this.colors.length > 0 && this.colors.some(c => c.name.trim() !== '');
        const allLocked = this.colors.length > 0 && this.colors.every(c => c.isLocked);
        if (this.downloadTxtBtn) this.downloadTxtBtn.disabled = !hasValidData;
        if (this.exportEpsBtn) this.exportEpsBtn.disabled = !hasValidData;
        if (this.sendToInboxBtn) this.sendToInboxBtn.disabled = !allLocked;
    }
    
    getExportData() {
        const exportItems = [];
        const processedColors = new Set();
        for (const color of this.colors) {
            const key = `${color.name}|${color.nk}`;
            if (processedColors.has(key)) continue;
            processedColors.add(key);
            exportItems.push({
                name: `${color.name} ${color.nk}`,
                cmyk: [color.cmyk.c, color.cmyk.m, color.cmyk.y, color.cmyk.k],
                lab: [color.lab.l, color.lab.a, color.lab.b]
            });
        }
        return exportItems;
    }
    
    generateCGATSContent(exportItems) {
        const today = new Date();
        const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
        let content = 'CGATS.17\nORIGINATOR\t"ALPHA COLOR MATCH"\nFILE_DESCRIPTOR\t""\n';
        content += `CREATED\t"${dateStr}"\nNUMBER_OF_FIELDS\t9\nBEGIN_DATA_FORMAT\nSAMPLE_ID SAMPLE_NAME CMYK_C CMYK_M CMYK_Y CMYK_K LAB_L LAB_A LAB_B\nEND_DATA_FORMAT\n`;
        content += `NUMBER_OF_SETS\t${exportItems.length}\nBEGIN_DATA\n\n`;
        exportItems.forEach((item, index) => {
            const counter = index + 1;
            content += `${counter} "${item.name}" ${item.cmyk[0].toFixed(6)} ${item.cmyk[1].toFixed(6)} ${item.cmyk[2].toFixed(6)} ${item.cmyk[3].toFixed(6)} ${item.lab[0].toFixed(6)} ${item.lab[1].toFixed(6)} ${item.lab[2].toFixed(6)}\n`;
        });
        content += '\nEND_DATA\n';
        return content;
    }
    
    downloadTXT() {
        const exportItems = this.getExportData();
        if (exportItems.length === 0) { alert('No hay datos para exportar'); return; }
        const invalidColors = this.colors.filter(c => !c.name.trim() || !c.nk.trim());
        if (invalidColors.length > 0) { alert('⚠️ Todos los colores deben tener nombre y NK antes de exportar'); return; }
        const content = this.generateCGATSContent(exportItems);
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const fileName = `palette_${timestamp}.txt`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        alert(`✅ Archivo TXT exportado con ${exportItems.length} registros`);
    }
    
    exportEPS() {
        const pendingColors = this.getPendingColors();
        if (pendingColors.length === 0) {
            alert('⚠️ No hay colores pendientes para exportar a EPS.');
            return;
        }
        if (this.epsHelper) {
            this.epsHelper.app = this.app;
            this.epsHelper.exportEPSFromColors(pendingColors, this.globalPlotter);
        } else {
            alert('❌ Error al generar EPS');
        }
    }
    
    showSendToInboxModal() {
        const exportItems = this.getExportData();
        if (exportItems.length === 0) {
            alert('No hay datos para enviar a la bandeja.');
            return;
        }
        const content = this.generateCGATSContent(exportItems);
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const fileName = `palette_${timestamp}.txt`;
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 450px;">
                <div class="modal-header" style="background: #2d4ed6;">
                    <h3 style="color: white;">📤 Enviar a Bandeja de Entrada</h3>
                    <button class="modal-close" style="color: white;">&times;</button>
                </div>
                <div class="modal-body">
                    <p><strong>Archivo:</strong> ${fileName}</p>
                    <p><strong>Colores:</strong> ${exportItems.length}</p>
                    <p><strong>Plotter:</strong> ${this.globalPlotter}</p>
                    <div class="form-group" style="margin-top: 1rem;">
                        <label for="sendReason">Motivo del envío:</label>
                        <textarea id="sendReason" rows="3" placeholder="Ej: Envío de paleta para producción..." style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></textarea>
                    </div>
                    <p style="color: #fbbf24; font-size: 0.75rem;">⚠️ El motivo es obligatorio para enviar a la bandeja.</p>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-secondary cancel-send">Cancelar</button>
                    <button class="btn btn-primary confirm-send">✅ Enviar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        const reasonTextarea = modal.querySelector('#sendReason');
        
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.cancel-send').onclick = closeModal;
        
        modal.querySelector('.confirm-send').onclick = () => {
            const reason = reasonTextarea.value.trim();
            if (!reason) {
                alert('⚠️ Debe ingresar un motivo para enviar a la bandeja.');
                return;
            }
            if (this.app) {
                this.app.addToInbox(fileName, content, reason, this.globalPlotter, exportItems.length, {
                    assignmentId: this.currentAssignment?.id || null
                });
                alert(`✅ Archivo enviado a la bandeja de entrada.\nMotivo: ${reason}`);
                if (this.currentAssignment) {
                    this.currentAssignment.estado = 'completado';
                    this.currentAssignment.progreso = 100;
                }
                this.currentAssignment = null;
                localStorage.removeItem('activeAssignmentId');
                this.resetTable();
                const existingInfo = document.getElementById('currentAssignmentInfo');
                if (existingInfo) existingInfo.remove();
                this.loadUserAssignments().then(() => this.renderAssignmentsList());
                closeModal();
            } else {
                alert('❌ Error al enviar a la bandeja.');
                closeModal();
            }
        };
    }
    
    saveLocalProgress() {
        if (!this.currentAssignment || this.colors.length === 0) return;
        const key = `palette_work_${this.currentAssignment.id}`;
        localStorage.setItem(key, JSON.stringify(this.colors));
    }

    loadLocalProgress(assignmentId) {
        const key = `palette_work_${assignmentId}`;
        const data = localStorage.getItem(key);
        try {
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    }

    checkAndRecoverWork() {
        const savedId = localStorage.getItem('activeAssignmentId');
        if (!savedId) return;

        const assignment = this.userAssignments.find(a => a.id === parseInt(savedId));
        if (!assignment) {
            localStorage.removeItem('activeAssignmentId');
            return;
        }

        const container = document.querySelector('.palette-validator-container');
        if (!container) return;

        const recoverDiv = document.createElement('div');
        recoverDiv.id = 'recoverWorkAlert';
        recoverDiv.style.cssText = 'background: linear-gradient(90deg, #b45309, #78350f); color: white; padding: 1.2rem; border-radius: 12px; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; border: 1px solid #f59e0b; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);';
        recoverDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="background: rgba(255,255,255,0.2); width: 45px; height: 45px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                    <i class="fas fa-history"></i>
                </div>
                <div>
                    <strong style="display: block; font-size: 1.1rem; margin-bottom: 0.2rem;">¡Tienes un trabajo en curso!</strong>
                    <span style="font-size: 0.85rem; opacity: 0.9;">Archivo: <strong>${assignment.txt_nombre || assignment.txt_id}</strong> · Progreso: ${assignment.progreso || 0}%</span>
                </div>
            </div>
            <div style="display: flex; gap: 0.8rem;">
                <button id="btnContinueWork" class="btn-primary" style="background: white !important; color: #b45309 !important; border: none; padding: 0.6rem 1.2rem; font-weight: bold; cursor: pointer; border-radius: 8px; font-size: 0.9rem;">
                    CONTINUAR TRABAJO
                </button>
                <button id="btnDiscardWork" style="background: transparent; border: 1.5px solid rgba(255,255,255,0.5); color: white; padding: 0.4rem 0.8rem; border-radius: 8px; cursor: pointer; font-size: 0.8rem;">
                    Cerrar
                </button>
            </div>
        `;

        container.insertBefore(recoverDiv, container.firstChild);

        document.getElementById('btnContinueWork').onclick = () => {
            recoverDiv.remove();
            this.loadAssignmentContent(assignment);
        };

        document.getElementById('btnDiscardWork').onclick = () => {
            recoverDiv.remove();
            // No borramos de localStorage por si acaso solo quiere ocultar el aviso
        };
    }

    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
}