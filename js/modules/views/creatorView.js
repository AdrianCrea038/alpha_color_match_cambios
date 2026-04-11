// ============================================================
// CREATOR VIEW - Crear Nuevo Archivo TXT
// - Ahora carga desde librería interna (no desde archivo local)
// - Selección de plotter y archivo TXT de la librería
// - Plotter global (1-17) para todos los colores del archivo
// - Botón "Enviar a Bandeja" (solo cuando todos los colores están aprobados)
// ============================================================

export class CreatorView {
    constructor(app, equivalencyTable) {
        this.app = app;
        this.equivalencyTable = equivalencyTable;
        this.colors = [];
        this.nextId = 1;
        this.historyLog = [];
        this.currentUser = 'usuario';
        this.globalPlotter = 14;
        
        this.tableBody = null;
        this.downloadBtn = null;
        this.plotterSelect = null;
        this.librarySelect = null;
        this.loadLibraryBtn = null;
        this.sendToInboxBtn = null;
        
        this.init();
    }
    
    init() {
        this.tableBody = document.getElementById('creatorTableBody');
        this.downloadBtn = document.getElementById('downloadTxtBtn');
        this.plotterSelect = document.getElementById('globalPlotter');
        this.librarySelect = document.getElementById('libraryFileSelect');
        this.loadLibraryBtn = document.getElementById('loadLibraryBtn');
        this.sendToInboxBtn = document.getElementById('sendToInboxBtn');
        
        if (!this.tableBody) return;
        
        if (this.plotterSelect) {
            this.plotterSelect.value = this.globalPlotter;
            this.plotterSelect.addEventListener('change', (e) => {
                this.globalPlotter = parseInt(e.target.value);
                console.log(`🎨 Plotter global cambiado a: ${this.globalPlotter}`);
                this.updateLibrarySelect();
            });
        }
        
        if (this.loadLibraryBtn) {
            this.loadLibraryBtn.onclick = () => this.loadFromLibrary();
        }
        
        if (this.downloadBtn) {
            this.downloadBtn.onclick = () => this.download();
        }
        
        if (this.sendToInboxBtn) {
            this.sendToInboxBtn.onclick = () => this.showSendToInboxModal();
        }
        
        this.updateLibrarySelect();
        this.resetTable();
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
        this.parseAndLoadContent(selected.content, fileName);
    }
    
    parseAndLoadContent(content, fileName) {
        const lines = content.split(/\r?\n/);
        let dataStarted = false;
        const loadedColors = [];
        
        for (let line of lines) {
            if (line.trim() === '') continue;
            if (line.trim() === 'BEGIN_DATA') { dataStarted = true; continue; }
            if (dataStarted && line.trim() === 'END_DATA') break;
            if (!dataStarted) continue;
            
            const match = line.match(/^(\d+)\.?\s+(?:"([^"]+)"|([^\s]+))\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)/);
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
                    const name = fullName.replace(/\s+(NK\d+|T\d+)$/i, '').trim();
                    loadedColors.push({
                        name: name,
                        nk: nk,
                        cmyk: {
                            c: parseFloat(match[4]),
                            m: parseFloat(match[5]),
                            y: parseFloat(match[6]),
                            k: parseFloat(match[7])
                        },
                        lab: {
                            l: parseFloat(match[8]),
                            a: parseFloat(match[9]),
                            b: parseFloat(match[10])
                        },
                        isLocked: false
                    });
                }
            }
        }
        
        if (loadedColors.length > 0) {
            this.colors = [];
            this.nextId = 1;
            for (const color of loadedColors) {
                this.addColor(color);
            }
            this.renderTable();
            alert(`✅ Cargados ${loadedColors.length} colores desde "${fileName}".`);
        } else {
            alert('⚠️ No se encontraron colores en el archivo.');
        }
        this.checkAndUpdateSendButton();
    }
    
    getGlobalPlotter() {
        return this.globalPlotter;
    }
    
    getPendingColors() {
        return this.colors.filter(color => !color.isLocked);
    }
    
    getComplementaryName(name) {
        const normalizedName = this.normalizeName(name);
        for (let [key, value] of this.equivalencyTable) {
            if (this.normalizeName(key) === normalizedName) return value;
            if (this.normalizeName(value) === normalizedName) return key;
        }
        return null;
    }
    
    normalizeName(name) {
        if (!name) return '';
        return name.toUpperCase().replace(/\s+/g, ' ').trim();
    }
    
    addColor(colorData = null) {
        const newId = this.nextId++;
        const newColor = {
            id: newId,
            name: colorData ? colorData.name : '',
            nk: colorData ? colorData.nk : 'NK001',
            cmyk: colorData ? { ...colorData.cmyk } : { c: 0, m: 0, y: 0, k: 0 },
            lab: colorData ? { ...colorData.lab } : { l: 100, a: 0, b: 0 },
            isLocked: false,
            modificationHistory: []
        };
        this.colors.push(newColor);
        this.renderTable();
        return newColor;
    }
    
    lockColor(colorId) {
        const color = this.colors.find(c => c.id === colorId);
        if (!color || color.isLocked) return;
        color.isLocked = true;
        this.addToHistory(colorId, 'LOCK', 'Color marcado como bueno');
        this.renderTable();
        document.dispatchEvent(new CustomEvent('colorStatusChanged'));
        this.checkAndUpdateSendButton();
    }
    
    unlockColor(colorId, reason) {
        if (!reason || reason.trim() === '') {
            alert('⚠️ El motivo es obligatorio para desbloquear el color.');
            return false;
        }
        const color = this.colors.find(c => c.id === colorId);
        if (!color) return false;
        color.isLocked = false;
        this.addToHistory(colorId, 'UNLOCK', reason);
        this.renderTable();
        document.dispatchEvent(new CustomEvent('colorStatusChanged'));
        this.checkAndUpdateSendButton();
        return true;
    }
    
    updateColor(colorId, updates) {
        const color = this.colors.find(c => c.id === colorId);
        if (!color || color.isLocked) return;
        if (updates.name !== undefined) color.name = updates.name;
        if (updates.cmyk) {
            if (updates.cmyk.c !== undefined) color.cmyk.c = updates.cmyk.c;
            if (updates.cmyk.m !== undefined) color.cmyk.m = updates.cmyk.m;
            if (updates.cmyk.y !== undefined) color.cmyk.y = updates.cmyk.y;
            if (updates.cmyk.k !== undefined) color.cmyk.k = updates.cmyk.k;
        }
        this.addToHistory(colorId, 'EDIT', `Modificado: ${color.name}`);
        this.renderTable();
        document.dispatchEvent(new CustomEvent('colorStatusChanged'));
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
            this.tableBody.innerHTML = '<tr><td colspan="12" class="empty-state">Seleccione un archivo TXT de la lista para comenzar<\/td><\/tr>';
            if (this.downloadBtn) this.downloadBtn.disabled = true;
            this.checkAndUpdateSendButton();
            return;
        }
        
        this.tableBody.innerHTML = this.colors.map((color, index) => {
            const isLocked = color.isLocked;
            const disabledAttr = isLocked ? 'disabled' : '';
            const statusBadge = isLocked ? '<span class="status-badge locked">✅ Bueno (🔒)</span>' : '';
            const actionButton = isLocked 
                ? `<button class="small-btn btn-modify" data-id="${color.id}" title="Modificar"><i class="fas fa-edit"></i></button>`
                : `<button class="small-btn btn-lock" data-id="${color.id}" title="Marcar como bueno"><i class="fas fa-check-circle"></i></button>`;
            
            return `
                <tr class="${isLocked ? 'locked-row' : ''}" data-id="${color.id}">
                    <td class="row-number">${index + 1}${isLocked ? ' 🔒' : ''}<\/td>
                    <td><input type="text" class="color-name-input" value="${this.escapeHtml(color.name)}" disabled><\/td>
                    <td><input type="text" class="nk-input" value="${this.escapeHtml(color.nk)}" disabled><\/td>
                    <td><input type="number" step="0.000001" min="0" max="100" value="${color.cmyk.c.toFixed(6)}" ${disabledAttr} data-field="cmyk_c" data-id="${color.id}"><\/td>
                    <td><input type="number" step="0.000001" min="0" max="100" value="${color.cmyk.m.toFixed(6)}" ${disabledAttr} data-field="cmyk_m" data-id="${color.id}"><\/td>
                    <td><input type="number" step="0.000001" min="0" max="100" value="${color.cmyk.y.toFixed(6)}" ${disabledAttr} data-field="cmyk_y" data-id="${color.id}"><\/td>
                    <td><input type="number" step="0.000001" min="0" max="100" value="${color.cmyk.k.toFixed(6)}" ${disabledAttr} data-field="cmyk_k" data-id="${color.id}"><\/td>
                    <td><input type="number" step="0.000001" value="${color.lab.l.toFixed(6)}" disabled><\/td>
                    <td><input type="number" step="0.000001" value="${color.lab.a.toFixed(6)}" disabled><\/td>
                    <td><input type="number" step="0.000001" value="${color.lab.b.toFixed(6)}" disabled><\/td>
                    <td class="status-cell">${statusBadge}<\/td>
                    <td class="actions-cell">${actionButton}<\/td>
                </tr>
            `;
        }).join('');
        
        const hasValidData = this.colors.some(c => c.name.trim() !== '');
        if (this.downloadBtn) this.downloadBtn.disabled = !hasValidData;
        this.attachInputEvents();
        this.attachActionEvents();
        this.checkAndUpdateSendButton();
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
        
        // ELIMINADO: modal.onclick para que NO se cierre al hacer clic fuera
    }
    
    resetTable() {
        this.colors = [];
        this.nextId = 1;
        this.historyLog = [];
        this.renderTable();
        this.checkAndUpdateSendButton();
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
            const complementaryName = this.getComplementaryName(color.name);
            if (complementaryName && complementaryName !== color.name) {
                const compKey = `${complementaryName}|${color.nk}`;
                if (!processedColors.has(compKey)) {
                    exportItems.push({
                        name: `${complementaryName} ${color.nk}`,
                        cmyk: [color.cmyk.c, color.cmyk.m, color.cmyk.y, color.cmyk.k],
                        lab: [color.lab.l, color.lab.a, color.lab.b]
                    });
                    processedColors.add(compKey);
                }
            }
        }
        return exportItems;
    }
    
    generateCGATSContent(exportItems) {
        const today = new Date();
        const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
        let content = 'CGATS.17\nORIGINATOR\t"ALPHA COLOR MATCH"\nFILE_DESCRIPTOR\t""\n';
        content += `CREATED\t"${dateStr}"\nNUMBER_OF_FIELDS\t9\nBEGIN_DATA_FORMAT\nSAMPLE_ID SAMPLE_NAME CMYK_C CMYK_M CMYK_Y CMYK_K LAB_L LAB_A LAB_B\nEND_DATA_FORMAT\nNUMBER_OF_SETS\t${exportItems.length}\nBEGIN_DATA\n\n`;
        exportItems.forEach((item, index) => {
            const counter = index + 1;
            content += `${counter}. "${item.name}" ${item.cmyk[0].toFixed(6)} ${item.cmyk[1].toFixed(6)} ${item.cmyk[2].toFixed(6)} ${item.cmyk[3].toFixed(6)} ${item.lab[0].toFixed(6)} ${item.lab[1].toFixed(6)} ${item.lab[2].toFixed(6)}\n`;
        });
        content += '\nEND_DATA\n';
        return content;
    }
    
    download() {
        const exportItems = this.getExportData();
        if (exportItems.length === 0) { alert('No hay datos para exportar'); return; }
        const invalidColors = this.colors.filter(c => !c.name.trim() || !c.nk.trim());
        if (invalidColors.length > 0) { alert('⚠️ Todos los colores deben tener nombre y NK antes de exportar'); return; }
        const content = this.generateCGATSContent(exportItems);
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const fileName = `color_creator_${timestamp}.txt`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        alert(`✅ Archivo exportado con ${exportItems.length} registros`);
    }
    
    showSendToInboxModal() {
        const exportItems = this.getExportData();
        if (exportItems.length === 0) {
            alert('No hay datos para enviar a la bandeja.');
            return;
        }
        
        const content = this.generateCGATSContent(exportItems);
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const fileName = `color_creator_${timestamp}.txt`;
        
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
                        <textarea id="sendReason" rows="3" placeholder="Ej: Envío de paleta para producción del plotter..." style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></textarea>
                    </div>
                    <p style="color: #fbbf24; font-size: 0.75rem; margin-top: 0.5rem;">⚠️ El motivo es obligatorio para enviar a la bandeja.</p>
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
                this.app.addToInbox(fileName, content, reason, this.globalPlotter, exportItems.length);
                alert(`✅ Archivo enviado a la bandeja de entrada.\nMotivo: ${reason}`);
                closeModal();
            } else {
                alert('❌ Error al enviar a la bandeja.');
                closeModal();
            }
        };
        
        // ELIMINADO: modal.onclick para que NO se cierre al hacer clic fuera
    }
    
    checkAndUpdateSendButton() {
        if (!this.sendToInboxBtn) return;
        
        const allLocked = this.colors.length > 0 && this.colors.every(color => color.isLocked === true);
        
        if (allLocked && this.colors.length > 0) {
            this.sendToInboxBtn.disabled = false;
            this.sendToInboxBtn.style.opacity = '1';
            this.sendToInboxBtn.title = "Enviar a bandeja de entrada";
        } else {
            this.sendToInboxBtn.disabled = true;
            this.sendToInboxBtn.style.opacity = '0.5';
            const pendingCount = this.colors.filter(c => !c.isLocked).length;
            this.sendToInboxBtn.title = `Faltan ${pendingCount} colores por aprobar para enviar`;
        }
    }
    
    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
}