// ============================================================
// ASSIGNMENT VIEW - Asignación de trabajo
// ============================================================

export class AssignmentView {
    constructor(app) {
        this.app = app;
        this.assignments = [];
        this.updateInterval = null;
        
        this.container = null;
        this.txtSelect = null;
        this.plotterSelect = null;
        this.userSelect = null;
        this.commentTextarea = null;
        this.assignBtn = null;
        this.clearBtn = null;
        this.clearAllBtn = null;
        this.historyList = null;
        
        // Elementos de carga TXT
        this.uploadFileInput = null;
        this.uploadReasonTextarea = null;
        this.uploadBtn = null;
        
        this.loadFromLocalStorage();
        this.init();
        this.startAutoUpdate();
    }
    
    init() {
        this.container = document.getElementById('assignmentView');
        if (!this.container) return;
        
        this.txtSelect = this.container.querySelector('#assignmentTxtSelect');
        this.plotterSelect = this.container.querySelector('#assignmentPlotterSelect');
        this.userSelect = this.container.querySelector('#assignmentUserSelect');
        this.commentTextarea = this.container.querySelector('#assignmentComment');
        this.assignBtn = this.container.querySelector('#assignWorkBtn');
        this.clearBtn = this.container.querySelector('#clearAssignmentBtn');
        this.clearAllBtn = this.container.querySelector('#clearAllAssignmentsBtn');
        this.historyList = this.container.querySelector('#assignmentHistoryList');
        
        // Elementos de carga TXT (sin plotter)
        this.uploadFileInput = this.container.querySelector('#assignmentUploadFile');
        this.uploadReasonTextarea = this.container.querySelector('#assignmentUploadReason');
        this.uploadBtn = this.container.querySelector('#assignmentUploadBtn');
        
        if (this.assignBtn) {
            this.assignBtn.onclick = () => this.assignWork();
        }
        
        if (this.clearBtn) {
            this.clearBtn.onclick = () => this.clearForm();
        }
        
        if (this.clearAllBtn) {
            this.clearAllBtn.onclick = () => this.clearAllAssignments();
        }
        
        if (this.uploadBtn) {
            this.uploadBtn.onclick = () => this.uploadTxtToLibrary();
        }
        
        document.addEventListener('colorStatusChanged', () => {
            this.updateAllProgress();
        });
        
        this.updateTxtList();
        this.renderHistory();
        
        console.log('✅ AssignmentView inicializado');
    }
    
    // ============================================================
    // CARGAR TXT A LIBRERÍA (sin plotter)
    // ============================================================
    uploadTxtToLibrary() {
        if (!this.uploadFileInput) {
            alert('❌ Error: No se encontraron los elementos de carga.');
            return;
        }
        
        const file = this.uploadFileInput.files[0];
        const reason = this.uploadReasonTextarea ? this.uploadReasonTextarea.value.trim() : '';
        
        if (!file) {
            alert('⚠️ Debe seleccionar un archivo TXT.');
            return;
        }
        
        if (!reason) {
            alert('⚠️ Debe ingresar un motivo para cargar el archivo.');
            return;
        }
        
        if (file.type !== 'text/plain' && !file.name.endsWith('.txt')) {
            alert('❌ Solo se permiten archivos TXT.');
            return;
        }
        
        // Verificar si el archivo ya existe en la librería (por nombre)
        const existingTxt = this.app.libraryTxts.find(t => t.name === file.name);
        
        if (existingTxt) {
            const confirmOverwrite = confirm(`⚠️ El archivo "${file.name}" ya existe en la librería.\n\n¿Desea sobrescribirlo?\n\nFecha existente: ${new Date(existingTxt.uploadDate).toLocaleString()}\nPlotter: ${existingTxt.plotter}`);
            if (!confirmOverwrite) {
                this.uploadFileInput.value = '';
                if (this.uploadReasonTextarea) this.uploadReasonTextarea.value = '';
                return;
            }
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            
            if (this.app) {
                // Si existe y confirmó sobrescritura, actualizar; si no, agregar nuevo
                if (existingTxt) {
                    // Actualizar el existente manteniendo el plotter original
                    const index = this.app.libraryTxts.findIndex(t => t.name === file.name);
                    if (index !== -1) {
                        this.app.libraryTxts[index] = {
                            ...this.app.libraryTxts[index],
                            content: content,
                            uploadDate: new Date().toISOString()
                        };
                        this.app.saveLibraryTxtsToLocalStorage();
                        console.log(`📚 TXT "${file.name}" actualizado en librería`);
                    }
                } else {
                    // Plotter se asignará al momento de asignar trabajo, por ahora usar 0 como temporal
                    this.app.addTxtToLibrary(0, file.name, content);
                }
                
                this.addUploadHistory(file.name, reason);
                alert(`✅ Archivo "${file.name}" cargado a librería correctamente.`);
                
                // Limpiar campos
                this.uploadFileInput.value = '';
                if (this.uploadReasonTextarea) this.uploadReasonTextarea.value = '';
                
                // Actualizar lista de TXTs en el selector
                this.updateTxtList();
                
                // Actualizar también el selector de reportes
                if (this.app.reportsView) {
                    this.app.reportsView.updateFilters();
                }
            }
        };
        reader.onerror = () => {
            alert('❌ Error al leer el archivo.');
        };
        reader.readAsText(file);
    }
    
    addUploadHistory(fileName, reason) {
        const history = localStorage.getItem('txtUploadHistory');
        let uploads = [];
        if (history) {
            try {
                uploads = JSON.parse(history);
            } catch(e) {}
        }
        uploads.unshift({
            id: Date.now(),
            fileName: fileName,
            reason: reason,
            user: this.app?.currentUser || 'usuario',
            date: new Date().toISOString()
        });
        if (uploads.length > 100) uploads = uploads.slice(0, 100);
        localStorage.setItem('txtUploadHistory', JSON.stringify(uploads));
    }
    
    clearAllAssignments() {
        if (confirm('⚠️ ¿Estás seguro de que quieres ELIMINAR TODAS las asignaciones?\n\nEsta acción no se puede deshacer.')) {
            this.assignments = [];
            this.saveToLocalStorage();
            this.renderHistory();
            alert('✅ Todas las asignaciones han sido eliminadas.');
        }
    }
    
    startAutoUpdate() {
        if (this.updateInterval) clearInterval(this.updateInterval);
        this.updateInterval = setInterval(() => {
            this.updateAllProgress();
        }, 5000);
    }
    
    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    loadFromLocalStorage() {
        const saved = localStorage.getItem('alphaColorMatchAssignments');
        if (saved) {
            try {
                this.assignments = JSON.parse(saved);
                console.log('📂 Asignaciones cargadas:', this.assignments.length);
            } catch(e) {
                console.error(e);
                this.assignments = [];
            }
        }
    }
    
    saveToLocalStorage() {
        localStorage.setItem('alphaColorMatchAssignments', JSON.stringify(this.assignments));
        console.log('💾 Asignaciones guardadas');
    }
    
    updateTxtList() {
        if (!this.txtSelect) return;
        
        const txts = this.app ? this.app.libraryTxts : [];
        
        this.txtSelect.innerHTML = '<option value="">-- Seleccionar archivo --</option>';
        
        if (txts.length === 0) {
            this.txtSelect.innerHTML = '<option value="">-- No hay archivos TXT disponibles --</option>';
            return;
        }
        
        // Filtrar solo TXT que tienen plotter asignado (plotter > 0)
        const validTxts = txts.filter(txt => txt.plotter > 0);
        
        if (validTxts.length === 0) {
            this.txtSelect.innerHTML = '<option value="">-- No hay archivos TXT con plotter asignado --</option>';
            return;
        }
        
        const groupedByPlotter = new Map();
        
        for (const txt of validTxts) {
            const plotter = txt.plotter;
            if (!groupedByPlotter.has(plotter)) {
                groupedByPlotter.set(plotter, []);
            }
            groupedByPlotter.get(plotter).push(txt);
        }
        
        const sortedPlotters = Array.from(groupedByPlotter.keys()).sort((a, b) => a - b);
        
        for (const plotter of sortedPlotters) {
            const group = groupedByPlotter.get(plotter);
            const optgroup = document.createElement('optgroup');
            optgroup.label = `📁 Plotter ${plotter}`;
            
            for (const txt of group) {
                const option = document.createElement('option');
                option.value = JSON.stringify({ name: txt.name, plotter: txt.plotter, content: txt.content });
                const date = new Date(txt.uploadDate);
                option.textContent = `${txt.name} (${date.toLocaleDateString()})`;
                optgroup.appendChild(option);
            }
            
            this.txtSelect.appendChild(optgroup);
        }
    }
    
    getColorsFromTxtContent(content) {
        if (!this.app) return [];
        
        const result = this.app.parseTxtContent(content);
        
        if (result && result.records && Array.isArray(result.records)) {
            return result.records;
        }
        
        if (Array.isArray(result)) {
            return result;
        }
        
        return [];
    }
    
    calculateProgress(txtContent) {
        if (!this.app || !this.app.creatorView) return { percentage: 0, approved: 0, total: 0 };
        
        const colors = this.getColorsFromTxtContent(txtContent);
        if (!colors || colors.length === 0) return { percentage: 0, approved: 0, total: 0 };
        
        const creatorColors = this.app.creatorView.colors;
        if (!creatorColors || creatorColors.length === 0) {
            return { percentage: 0, approved: 0, total: colors.length };
        }
        
        let approvedCount = 0;
        for (const color of colors) {
            const found = creatorColors.find(c => c.name === color.name && c.nk === color.nk);
            if (found && found.isLocked === true) {
                approvedCount++;
            }
        }
        
        const percentage = Math.round((approvedCount / colors.length) * 100);
        
        return {
            percentage: percentage,
            approved: approvedCount,
            total: colors.length
        };
    }
    
    updateAllProgress() {
        let changed = false;
        
        for (const assignment of this.assignments) {
            const oldPercentage = assignment.progressPercentage || 0;
            const progress = this.calculateProgress(assignment.content);
            
            if (progress.percentage !== oldPercentage) {
                assignment.progressPercentage = progress.percentage;
                assignment.progressApproved = progress.approved;
                assignment.progressTotal = progress.total;
                assignment.lastUpdated = new Date().toISOString();
                changed = true;
            }
        }
        
        if (changed) {
            this.saveToLocalStorage();
            this.renderHistory();
            if (this.app && this.app.reportsView) {
                this.app.reportsView.updateFilters();
                this.app.reportsView.render();
            }
        }
    }
    
    assignWork() {
        if (!this.txtSelect || !this.plotterSelect || !this.userSelect) return;
        
        const txtValue = this.txtSelect.value;
        const plotter = parseInt(this.plotterSelect.value);
        const user = this.userSelect.value;
        const comment = this.commentTextarea ? this.commentTextarea.value.trim() : '';
        
        if (!txtValue) {
            alert('⚠️ Debe seleccionar un archivo TXT.');
            return;
        }
        
        if (!plotter || isNaN(plotter)) {
            alert('⚠️ Debe seleccionar un plotter válido.');
            return;
        }
        
        if (!user) {
            alert('⚠️ Debe seleccionar un usuario.');
            return;
        }
        
        let txtData;
        try {
            txtData = JSON.parse(txtValue);
        } catch(e) {
            alert('❌ Error al procesar el archivo seleccionado.');
            return;
        }
        
        // Validar si el archivo ya tiene asignado un plotter diferente
        if (txtData.plotter !== plotter) {
            const confirmChange = confirm(`⚠️ El archivo "${txtData.name}" está actualmente asignado al Plotter ${txtData.plotter}.\n\n¿Desea reasignarlo al Plotter ${plotter}?\n\nEsto actualizará el plotter del archivo en la librería.`);
            if (!confirmChange) {
                return;
            }
            
            // Actualizar el plotter del archivo en la librería
            const txtIndex = this.app.libraryTxts.findIndex(t => t.name === txtData.name);
            if (txtIndex !== -1) {
                this.app.libraryTxts[txtIndex].plotter = plotter;
                this.app.saveLibraryTxtsToLocalStorage();
                console.log(`📚 Plotter del archivo "${txtData.name}" actualizado a ${plotter}`);
                
                // Actualizar txtData para la asignación
                txtData.plotter = plotter;
            }
        }
        
        // Validar si el usuario ya tiene una asignación pendiente con el mismo archivo
        const existingAssignment = this.assignments.find(a => 
            a.fileName === txtData.name && 
            a.user === user && 
            a.progressPercentage < 100
        );
        
        if (existingAssignment) {
            const confirmReassign = confirm(`⚠️ El usuario ya tiene una asignación pendiente del archivo "${txtData.name}" (${existingAssignment.progressPercentage}% completado).\n\n¿Desea crear una nueva asignación de todos modos?`);
            if (!confirmReassign) {
                return;
            }
        }
        
        // Validar si el archivo ya está asignado a otro usuario (con progreso < 100%)
        const otherUserAssignment = this.assignments.find(a => 
            a.fileName === txtData.name && 
            a.user !== user && 
            a.progressPercentage < 100
        );
        
        if (otherUserAssignment) {
            const confirmOther = confirm(`⚠️ El archivo "${txtData.name}" ya está asignado a ${otherUserAssignment.user} (${otherUserAssignment.progressPercentage}% completado).\n\n¿Desea asignarlo también a ${user}?`);
            if (!confirmOther) {
                return;
            }
        }
        
        const progress = this.calculateProgress(txtData.content);
        
        const newAssignment = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            fileName: txtData.name,
            plotter: plotter,
            user: user,
            comment: comment,
            content: txtData.content,
            progressPercentage: progress.percentage,
            progressApproved: progress.approved,
            progressTotal: progress.total,
            lastUpdated: new Date().toISOString()
        };
        
        this.assignments.unshift(newAssignment);
        
        if (this.assignments.length > 500) {
            this.assignments = this.assignments.slice(0, 500);
        }
        
        this.saveToLocalStorage();
        this.renderHistory();
        this.clearForm();
        
        if (this.app && this.app.addToInbox) {
            this.app.addToInbox(
                txtData.name,
                txtData.content,
                `Asignado a ${user} para plotter ${plotter}. ${comment ? 'Motivo: ' + comment : ''}`,
                plotter,
                progress.total
            );
        }
        
        if (this.app && this.app.reportsView) {
            this.app.reportsView.updateFilters();
            this.app.reportsView.render();
        }
        
        alert(`✅ Trabajo asignado correctamente:\n📁 Archivo: ${txtData.name}\n🖨️ Plotter: ${plotter}\n👤 Usuario: ${user}\n📊 Progreso inicial: ${progress.percentage}% (${progress.approved}/${progress.total})`);
    }
    
    clearForm() {
        if (this.txtSelect) this.txtSelect.value = '';
        if (this.plotterSelect) this.plotterSelect.value = '';
        if (this.userSelect) this.userSelect.value = '';
        if (this.commentTextarea) this.commentTextarea.value = '';
    }
    
    renderHistory() {
        if (!this.historyList) return;
        
        if (this.assignments.length === 0) {
            this.historyList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <p>No hay asignaciones registradas</p>
                </div>
            `;
            return;
        }
        
        this.historyList.innerHTML = this.assignments.map(assignment => {
            const date = new Date(assignment.timestamp);
            const dateStr = date.toLocaleString();
            
            let userName = assignment.user;
            switch(assignment.user) {
                case 'usuario_admin': userName = '👤 Usuario Admin'; break;
                case 'produccion_1': userName = '🏭 Producción 1'; break;
                case 'produccion_2': userName = '🏭 Producción 2'; break;
                case 'calidad': userName = '✅ Calidad'; break;
                case 'desarrollo': userName = '🎨 Desarrollo'; break;
                case 'supervisor': userName = '👔 Supervisor'; break;
                default: userName = assignment.user;
            }
            
            const percentage = assignment.progressPercentage || 0;
            const approved = assignment.progressApproved || 0;
            const total = assignment.progressTotal || 0;
            
            const progressBarHtml = `
                <div class="progress-container">
                    <div class="progress-bar" style="width: ${percentage}%;"></div>
                </div>
                <div class="progress-text">
                    ${percentage}% (${approved} de ${total} colores aprobados)
                    ${percentage === 100 ? '<span class="completed-badge">✅ COMPLETADO</span>' : ''}
                </div>
            `;
            
            return `
                <div class="assignment-item" data-id="${assignment.id}">
                    <div class="assignment-item-header">
                        <span class="assignment-date">📅 ${dateStr}</span>
                        <div>
                            <span class="assignment-badge plotter">🖨️ Plotter ${assignment.plotter}</span>
                            <span class="assignment-badge user">👤 ${userName}</span>
                        </div>
                    </div>
                    <div class="assignment-details">
                        <p><i class="fas fa-file-alt"></i> <span class="assignment-filename">${this.escapeHtml(assignment.fileName)}</span></p>
                        ${assignment.comment ? `<div class="assignment-comment"><i class="fas fa-comment"></i> ${this.escapeHtml(assignment.comment)}</div>` : ''}
                        <div class="assignment-progress">
                            ${progressBarHtml}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
}