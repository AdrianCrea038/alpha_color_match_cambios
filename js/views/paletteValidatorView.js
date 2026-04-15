// js/views/paletteValidatorView.js
import { escapeHtml } from '../core/utils.js';
import { EPSView } from './epsView.js';

export class PaletteValidatorView {
    constructor(app) {
        this.app = app;
        this.colors = [];
        this.nextId = 1;
        this.historyLog = [];
        this.currentUser = 'usuario';
        this.globalPlotter = 14;
        
        this.tableBody = null;
        this.downloadTxtBtn = null;
        this.exportEpsBtn = null;
        this.sendToInboxBtn = null;
        this.loadLibraryBtn = null;
        this.plotterSelect = null;
        this.librarySelect = null;
        
        // EPS view helper
        this.epsHelper = new EPSView(app);
        
        this.init();
    }
    
    init() {
        this.tableBody = document.getElementById('validatorTableBody');
        this.downloadTxtBtn = document.getElementById('downloadTxtBtn');
        this.exportEpsBtn = document.getElementById('exportEpsBtn');
        this.sendToInboxBtn = document.getElementById('sendToInboxBtn');
        this.loadLibraryBtn = document.getElementById('loadLibraryBtn');
        this.plotterSelect = document.getElementById('globalPlotter');
        this.librarySelect = document.getElementById('libraryFileSelect');
        
        if (!this.tableBody) return;
        
        if (this.plotterSelect) {
            this.plotterSelect.value = this.globalPlotter;
            this.plotterSelect.addEventListener('change', (e) => {
                this.globalPlotter = parseInt(e.target.value);
                this.updateLibrarySelect();
            });
        }
        
        if (this.loadLibraryBtn) {
            this.loadLibraryBtn.onclick = () => this.loadFromLibrary();
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
                    const name = fullName.replace(/\s+(NK\d+|T\d+)$/i, '').trim();
                    
                    // Extraer valores LAB si existen
                    let lVal = 100, aVal = 0, bVal = 0;
                    if (match[8] && match[9] && match[10]) {
                        lVal = parseFloat(match[8]);
                        aVal = parseFloat(match[9]);
                        bVal = parseFloat(match[10]);
                    }
                    
                    loadedColors.push({
                        name: name,
                        nk: nk,
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
            for (const color of loadedColors) {
                this.addColor(color);
            }
            this.renderTable();
            this.checkButtonsState();
            alert(`✅ Cargados ${loadedColors.length} colores desde "${fileName}".`);
        } else {
            alert('⚠️ No se encontraron colores en el archivo.');
        }
    }
    
    getGlobalPlotter() {
        return this.globalPlotter;
    }
    
    getPendingColors() {
        return this.colors.filter(color => !color.isLocked);
    }
    
    addColor(colorData = null) {
        const newId = this.nextId++;
        const newColor = {
            id: newId,
            name: colorData ? colorData.name : '',
            nk: colorData ? colorData.nk : 'NK001',
            cmyk: colorData ? { ...colorData.cmyk } : { c: 0, m: 0, y: 0, k: 0 },
            lab: colorData ? { ...colorData.lab } : { l: 100, a: 0, b: 0 },
            channels: colorData?.channels || { tq: 0, o: 0, fy: 0, fp: 0 },
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
        this.checkButtonsState();
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
        this.checkButtonsState();
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
        if (updates.channels) {
            if (updates.channels.tq !== undefined) color.channels.tq = updates.channels.tq;
            if (updates.channels.o !== undefined) color.channels.o = updates.channels.o;
            if (updates.channels.fy !== undefined) color.channels.fy = updates.channels.fy;
            if (updates.channels.fp !== undefined) color.channels.fp = updates.channels.fp;
        }
        this.addToHistory(colorId, 'EDIT', `Modificado: ${color.name}`);
        this.renderTable();
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
            this.tableBody.innerHTML = '<tr><td colspan="13" class="empty-state">Seleccione un archivo TXT de la lista para comenzar<\/td><\/tr>';
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
            
            return `
                <tr class="${isLocked ? 'locked-row' : ''}" data-id="${color.id}">
                    <td class="row-number">${index + 1}${isLocked ? ' 🔒' : ''}<\/td>
                    <td><input type="text" class="color-name-input" value="${this.escapeHtml(color.name)}" disabled><\/td>
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
        if (this.downloadTxtBtn) this.downloadTxtBtn.disabled = !hasValidData;
        if (this.exportEpsBtn) this.exportEpsBtn.disabled = !hasValidData;
        if (this.sendToInboxBtn) this.sendToInboxBtn.disabled = !hasValidData;
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
        // Usar la funcionalidad EPS del helper
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
                this.app.addToInbox(fileName, content, reason, this.globalPlotter, exportItems.length);
                alert(`✅ Archivo enviado a la bandeja de entrada.\nMotivo: ${reason}`);
                closeModal();
            } else {
                alert('❌ Error al enviar a la bandeja.');
                closeModal();
            }
        };
    }
    
    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
}