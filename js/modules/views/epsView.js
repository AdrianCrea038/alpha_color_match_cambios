// ============================================================
// EPS VIEW - Exportar colores a formato EPS
// Genera archivos .eps con recuadro único de 10cm x 10cm
// - Espacio de color CMYK (para Ergosoft e Illustrator)
// - Texto "Plotter:" arriba izquierda
// - Valores CMYK arriba derecha (descendente)
// - Nombre del color abajo izquierda
// - Tipografía Sans Serif (Helvetica)
// ============================================================

export class EPSView {
    constructor(app) {
        this.app = app;
        this.colors = [];
        this.init();
    }
    
    init() {
        this.render();
        this.attachEvents();
    }
    
    render() {
        const container = document.getElementById('epsView');
        if (!container) return;
        
        container.innerHTML = `
            <div class="eps-container">
                <div class="eps-header">
                    <h3>📄 Exportar a EPS</h3>
                    <p>Selecciona los colores para generar archivos .eps en modo CMYK (10cm x 10cm)</p>
                </div>
                
                <div class="eps-options">
                    <div class="option-group">
                        <label for="epsSize">Tamaño del recuadro:</label>
                        <select id="epsSize" class="eps-select">
                            <option value="10">10 cm x 10 cm</option>
                            <option value="15">15 cm x 15 cm</option>
                            <option value="20">20 cm x 20 cm</option>
                        </select>
                    </div>
                    <div class="option-group">
                        <label for="epsFontSize">Tamaño de texto:</label>
                        <select id="epsFontSize" class="eps-select">
                            <option value="12">12 pt</option>
                            <option value="14">14 pt</option>
                            <option value="17" selected>17 pt</option>
                            <option value="20">20 pt</option>
                        </select>
                    </div>
                </div>
                
                <div class="eps-color-list">
                    <h4>Colores disponibles:</h4>
                    <div id="epsColorList" class="color-list">
                        <div class="empty-state">Cargando colores...</div>
                    </div>
                </div>
                
                <div class="eps-actions">
                    <button id="exportSelectedEpsBtn" class="btn-primary" disabled>📥 Exportar seleccionados (.eps)</button>
                    <button id="refreshColorsBtn" class="btn-secondary">🔄 Actualizar colores</button>
                </div>
            </div>
        `;
        
        this.attachEvents();
    }
    
    attachEvents() {
        const exportBtn = document.getElementById('exportSelectedEpsBtn');
        const refreshBtn = document.getElementById('refreshColorsBtn');
        
        if (exportBtn) {
            exportBtn.onclick = () => this.exportSelected();
        }
        
        if (refreshBtn) {
            refreshBtn.onclick = () => this.loadColors();
        }
        
        this.loadColors();
    }
    
    loadColors() {
        const colors = [];
        
        if (this.app && this.app.results && this.app.results.length > 0) {
            for (const result of this.app.results) {
                if (result.primaryData && result.primaryData.colorData) {
                    colors.push({
                        id: result.id,
                        name: result.primaryData.baseName || result.name,
                        nk: result.nk,
                        cmyk: result.cmykPrimary || result.cmykSecondary,
                        lab: result.labPrimary || result.labSecondary
                    });
                }
            }
        }
        
        if (colors.length === 0 && this.app && this.app.creatorView && this.app.creatorView.colors) {
            for (const color of this.app.creatorView.colors) {
                colors.push({
                    id: color.id,
                    name: color.name,
                    nk: color.nk,
                    cmyk: [color.cmyk.c, color.cmyk.m, color.cmyk.y, color.cmyk.k],
                    lab: [color.lab.l, color.lab.a, color.lab.b]
                });
            }
        }
        
        this.colors = colors;
        this.renderColorList();
    }
    
    renderColorList() {
        const container = document.getElementById('epsColorList');
        const exportBtn = document.getElementById('exportSelectedEpsBtn');
        
        if (!container) return;
        
        if (this.colors.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay colores disponibles. Carga un archivo TXT o agrega colores en "Crear TXT".</div>';
            if (exportBtn) exportBtn.disabled = true;
            return;
        }
        
        container.innerHTML = `
            <div class="color-list-header">
                <label class="select-all">
                    <input type="checkbox" id="selectAllColors"> Seleccionar todos (${this.colors.length})
                </label>
            </div>
            <div class="color-items">
                ${this.colors.map(color => `
                    <div class="color-item" data-id="${color.id}">
                        <input type="checkbox" class="color-checkbox" data-id="${color.id}" data-name="${color.name}" data-cmyk="${color.cmyk.join(',')}">
                        <div class="color-swatch" style="background: ${this.cmykToRgb(color.cmyk[0], color.cmyk[1], color.cmyk[2], color.cmyk[3])};"></div>
                        <div class="color-info">
                            <span class="color-name">${this.escapeHtml(color.name)}</span>
                            <span class="color-nk">${color.nk || ''}</span>
                            <span class="color-cmyk">C:${color.cmyk[0].toFixed(1)} M:${color.cmyk[1].toFixed(1)} Y:${color.cmyk[2].toFixed(1)} K:${color.cmyk[3].toFixed(1)}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        if (exportBtn) exportBtn.disabled = false;
        
        const selectAll = document.getElementById('selectAllColors');
        if (selectAll) {
            selectAll.onclick = (e) => {
                const checkboxes = document.querySelectorAll('.color-checkbox');
                checkboxes.forEach(cb => cb.checked = e.target.checked);
            };
        }
    }
    
    calculateLuminance(c, m, y, k) {
        const r = 255 * (1 - c / 100) * (1 - k / 100);
        const g = 255 * (1 - m / 100) * (1 - k / 100);
        const b = 255 * (1 - y / 100) * (1 - k / 100);
        return (0.299 * r + 0.587 * g + 0.114 * b);
    }
    
    getTextColor(c, m, y, k) {
        const luminance = this.calculateLuminance(c, m, y, k);
        return luminance > 128 ? [0, 0, 0] : [1, 1, 1];
    }
    
    cmToPoints(cm) {
        return cm * 28.3464567;
    }
    
    generateEPS(color, sizeCm = 10, fontSizePt = 17) {
        const name = color.name || 'Color';
        const c = color.cmyk[0];
        const m = color.cmyk[1];
        const y = color.cmyk[2];
        const k = color.cmyk[3];
        
        const boxSize = this.cmToPoints(sizeCm);
        const margin = boxSize * 0.05;
        const textColor = this.getTextColor(c, m, y, k);
        
        const cleanName = name.replace(/[^a-zA-Z0-9áéíóúñÑ]/g, '_');
        
        const topY = boxSize - margin - fontSizePt;
        const bottomY = margin + fontSizePt;
        const leftX = margin;
        const rightX = boxSize - margin;
        
        // Convertir CMYK a valores entre 0 y 1 para PostScript
        const cPs = (c / 100).toFixed(6);
        const mPs = (m / 100).toFixed(6);
        const yPs = (y / 100).toFixed(6);
        const kPs = (k / 100).toFixed(6);
        
        return `%!PS-Adobe-3.0 EPSF-3.0
%%BoundingBox: 0 0 ${boxSize} ${boxSize}
%%Title: ${cleanName}
%%Creator: Alpha Color Match
%%CreationDate: ${new Date().toLocaleDateString()}
%%LanguageLevel: 2
%%DocumentProcessColors: Cyan Magenta Yellow Black
%%EndComments

% Configurar página
0 0 ${boxSize} ${boxSize} rectclip

% Dibujar fondo blanco exterior
1 1 1 setrgbcolor
0 0 ${boxSize} ${boxSize} rectfill

% Configurar color CMYK para el recuadro
${cPs} ${mPs} ${yPs} ${kPs} setcmykcolor

% Dibujar recuadro principal
0 0 ${boxSize} ${boxSize} rectfill

% Configurar color para texto (negro)
0 0 0 setrgbcolor

% Seleccionar fuente SANS SERIF
/Helvetica findfont
${fontSizePt} scalefont
setfont

% Texto "Plotter:" en esquina superior izquierda
${leftX} ${topY} moveto
(Plotter:) show

% Valores CMYK en esquina superior derecha
(C: ${Math.round(c)}) dup stringwidth pop
${rightX} exch sub ${topY} moveto
show

(M: ${Math.round(m)}) dup stringwidth pop
${rightX} exch sub ${topY - fontSizePt * 1.2} moveto
show

(Y: ${Math.round(y)}) dup stringwidth pop
${rightX} exch sub ${topY - fontSizePt * 2.4} moveto
show

(K: ${Math.round(k)}) dup stringwidth pop
${rightX} exch sub ${topY - fontSizePt * 3.6} moveto
show

% Nombre del color en esquina inferior izquierda
${leftX} ${bottomY} moveto
(${name}) show

% Finalizar
showpage
%%EOF`;
    }
    
    cmykToRgb(c, m, y, k) {
        const r = 255 * (1 - c / 100) * (1 - k / 100);
        const g = 255 * (1 - m / 100) * (1 - k / 100);
        const b = 255 * (1 - y / 100) * (1 - k / 100);
        return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    }
    
    exportSelected() {
        const selectedCheckboxes = document.querySelectorAll('.color-checkbox:checked');
        const sizeSelect = document.getElementById('epsSize');
        const fontSizeSelect = document.getElementById('epsFontSize');
        
        const sizeCm = sizeSelect ? parseInt(sizeSelect.value) : 10;
        const fontSizePt = fontSizeSelect ? parseInt(fontSizeSelect.value) : 17;
        
        if (selectedCheckboxes.length === 0) {
            alert('⚠️ Seleccione al menos un color para exportar.');
            return;
        }
        
        if (selectedCheckboxes.length === 1) {
            const cb = selectedCheckboxes[0];
            const cmyk = cb.dataset.cmyk.split(',').map(Number);
            const color = {
                name: cb.dataset.name,
                cmyk: cmyk
            };
            const epsContent = this.generateEPS(color, sizeCm, fontSizePt);
            const fileName = `${color.name.replace(/[^a-zA-Z0-9áéíóúñÑ]/g, '_')}.eps`;
            this.downloadFile(epsContent, fileName);
        } else {
            alert(`Se exportarán ${selectedCheckboxes.length} archivos .eps. Cada uno se descargará por separado.`);
            
            selectedCheckboxes.forEach((cb, index) => {
                setTimeout(() => {
                    const cmyk = cb.dataset.cmyk.split(',').map(Number);
                    const color = {
                        name: cb.dataset.name,
                        cmyk: cmyk
                    };
                    const epsContent = this.generateEPS(color, sizeCm, fontSizePt);
                    const fileName = `${color.name.replace(/[^a-zA-Z0-9áéíóúñÑ]/g, '_')}.eps`;
                    this.downloadFile(epsContent, fileName);
                }, index * 500);
            });
        }
    }
    
    downloadFile(content, fileName) {
        const blob = new Blob([content], { type: 'application/postscript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
}