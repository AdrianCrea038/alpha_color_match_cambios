// ============================================================
// EPS VIEW - Exportar colores pendientes a EPS
// Versión con textos (Plotter, CMYK, nombre) y tipografía Arial
// Estructura de spot color que ya funciona
// ============================================================

export class EPSView {
    constructor(app) {
        this.app = app;
        this.previewContainer = null;
        this.exportBtn = null;
        this.refreshBtn = null;
        
        this.init();
    }
    
    init() {
        this.previewContainer = document.getElementById('epsPreviewContainer');
        this.exportBtn = document.getElementById('exportEpsBtn');
        this.refreshBtn = document.getElementById('refreshEpsPreviewBtn');
        
        if (this.exportBtn) {
            this.exportBtn.onclick = () => this.exportEPS();
        }
        
        if (this.refreshBtn) {
            this.refreshBtn.onclick = () => this.renderPreview();
        }
        
        document.addEventListener('colorStatusChanged', () => {
            this.renderPreview();
        });
        
        this.renderPreview();
    }
    
    getPendingColorsFromCreator() {
        if (this.app && this.app.creatorView && this.app.creatorView.getPendingColors) {
            return this.app.creatorView.getPendingColors();
        }
        return [];
    }
    
    getPendingColorsSorted() {
        const pendingColors = this.getPendingColorsFromCreator();
        return [...pendingColors].sort((a, b) => a.lab.l - b.lab.l);
    }
    
    cmykToRgb(c, m, y, k) {
        const r = 255 * (1 - c / 100) * (1 - k / 100);
        const g = 255 * (1 - m / 100) * (1 - k / 100);
        const b = 255 * (1 - y / 100) * (1 - k / 100);
        return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    }
    
    renderPreview() {
        if (!this.previewContainer) return;
        
        const colors = this.getPendingColorsSorted();
        const plotterValue = this.app && this.app.creatorView ? this.app.creatorView.getGlobalPlotter() : 14;
        
        if (colors.length === 0) {
            this.previewContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎨</div>
                    <p>No hay colores pendientes para mostrar</p>
                    <p style="font-size: 0.7rem;">Los colores aprobados (✅ Bueno) no aparecen en el EPS</p>
                </div>
            `;
            return;
        }
        
        const boxSize = 100;
        const margin = 5;
        const maxCols = 5;
        
        this.previewContainer.style.display = 'flex';
        this.previewContainer.style.flexDirection = 'column';
        this.previewContainer.style.gap = `${margin}px`;
        
        const rows = [];
        for (let i = 0; i < colors.length; i += maxCols) {
            rows.push(colors.slice(i, i + maxCols));
        }
        
        this.previewContainer.innerHTML = rows.map(row => {
            return `
                <div style="display: flex; gap: ${margin}px; justify-content: flex-start;">
                    ${row.map(color => {
                        const rgb = this.cmykToRgb(color.cmyk.c, color.cmyk.m, color.cmyk.y, color.cmyk.k);
                        const spotName = `${color.name} ${color.nk}`.toUpperCase();
                        
                        return `
                            <div class="eps-preview-box" style="
                                width: ${boxSize}px;
                                height: ${boxSize}px;
                                background: ${rgb};
                                border: 1px solid #4b5563;
                                border-radius: 4px;
                                font-family: Arial, Helvetica, sans-serif;
                                font-size: 9px;
                                color: white;
                                text-shadow: 0 0 2px black;
                                overflow: hidden;
                                display: flex;
                                flex-direction: column;
                                justify-content: space-between;
                                padding: 4px;
                                flex-shrink: 0;
                            ">
                                <div style="text-align: left; font-weight: bold;">Plotter: ${plotterValue}</div>
                                <div style="text-align: right;">
                                    C:${color.cmyk.c.toFixed(0)}<br>
                                    M:${color.cmyk.m.toFixed(0)}<br>
                                    Y:${color.cmyk.y.toFixed(0)}<br>
                                    K:${color.cmyk.k.toFixed(0)}
                                </div>
                                <div style="text-align: left; font-size: 8px; word-break: break-word;">${this.escapeHtml(spotName)}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }).join('');
        
        const statsDiv = document.getElementById('epsStats');
        if (statsDiv) {
            statsDiv.innerHTML = `
                <strong>📊 Resumen EPS:</strong> ${colors.length} colores pendientes | Plotter: ${plotterValue} | Orden: Oscuros → Claros | Máx 5 colores por fila
            `;
        }
    }
    
    generateEPSContent() {
        const colors = this.getPendingColorsSorted();
        const plotterValue = this.app && this.app.creatorView ? this.app.creatorView.getGlobalPlotter() : 14;
        
        if (colors.length === 0) {
            return null;
        }
        
        const cmToPoints = 28.3465;
        const boxSize = Math.round(10 * cmToPoints); // 10cm en puntos
        const margin = Math.round(0.5 * cmToPoints); // 5mm en puntos
        const cols = Math.min(colors.length, 5);
        const rows = Math.ceil(colors.length / cols);
        
        const pageWidth = (boxSize + margin) * cols + margin;
        const pageHeight = (boxSize + margin) * rows + margin;
        
        let eps = `%!PS-Adobe-3.0 EPSF-3.0
%%BoundingBox: 0 0 ${pageWidth} ${pageHeight}
%%Title: Alpha Color Match EPS Export
%%Creator: Alpha Color Match
%%CreationDate: ${new Date().toLocaleString()}
%%LanguageLevel: 2
%%EndComments

`;
        
        // Agregar cada spot color en el encabezado
        for (let i = 0; i < colors.length; i++) {
            const color = colors[i];
            const spotName = `${color.name} ${color.nk}`.toUpperCase();
            const c = (color.cmyk.c / 100).toFixed(6);
            const m = (color.cmyk.m / 100).toFixed(6);
            const yVal = (color.cmyk.y / 100).toFixed(6);
            const k = (color.cmyk.k / 100).toFixed(6);
            
            eps += `%%DocumentCustomColors: (${this.escapePS(spotName)})
%%CMYKCustomColor: ${c} ${m} ${yVal} ${k} (${this.escapePS(spotName)})
`;
        }
        
        eps += `%%EndComments

% Definir tipografía Arial (Helvetica en PostScript)
/Helvetica findfont 12 scalefont setfont

% Definir función para dibujar rectángulo
/drawRect {
    newpath
    4 2 roll
    moveto
    1 index 0 rlineto
    0 exch rlineto
    neg 0 rlineto
    closepath
    fill
} def

% Definir función para dibujar texto
/drawText {
    /txt exch def
    /y exch def
    /x exch def
    newpath
    x y moveto
    txt show
} def

`;
        
        // Definir cada spot color
        for (let i = 0; i < colors.length; i++) {
            const color = colors[i];
            const spotName = `${color.name} ${color.nk}`.toUpperCase();
            const c = (color.cmyk.c / 100).toFixed(6);
            const m = (color.cmyk.m / 100).toFixed(6);
            const yVal = (color.cmyk.y / 100).toFixed(6);
            const k = (color.cmyk.k / 100).toFixed(6);
            
            eps += `/SpotColor${i} {
    [/Separation (${this.escapePS(spotName)}) /DeviceCMYK {
        ${c} ${m} ${yVal} ${k}
    } ] setcolorspace
} def

`;
        }
        
        // Dibujar cada rectángulo con su texto
        for (let i = 0; i < colors.length; i++) {
            const color = colors[i];
            const col = i % 5;
            const row = Math.floor(i / 5);
            
            const x = margin + col * (boxSize + margin);
            const y = pageHeight - margin - (row + 1) * (boxSize + margin);
            const spotName = `${color.name} ${color.nk}`.toUpperCase();
            const cInt = Math.round(color.cmyk.c);
            const mInt = Math.round(color.cmyk.m);
            const yInt = Math.round(color.cmyk.y);
            const kInt = Math.round(color.cmyk.k);
            
            // Posiciones para el texto
            const textX = x + 8;
            const plotterY = y + boxSize - 12;
            const cmykY = y + boxSize - 28;
            const nameY = y + 18;
            
            eps += `% Color ${i + 1}: ${spotName}
SpotColor${i}

% Dibujar rectángulo
${x} ${y} ${boxSize} ${boxSize} drawRect

% Dibujar texto (Plotter)
0 0 0 setrgbcolor
/Helvetica findfont 12 scalefont setfont
${textX} ${plotterY} moveto (Plotter: ${plotterValue}) show

% Dibujar valores CMYK
/Helvetica findfont 10 scalefont setfont
${textX} ${cmykY} moveto (C:${cInt}  M:${mInt}  Y:${yInt}  K:${kInt}) show

% Dibujar nombre del spot
/Helvetica findfont 10 scalefont setfont
${textX} ${nameY} moveto (${this.escapePS(spotName)}) show

`;
        }
        
        eps += `showpage
%%EOF`;
        
        return eps;
    }
    
    exportEPS() {
        const epsContent = this.generateEPSContent();
        
        if (!epsContent) {
            alert('⚠️ No hay colores pendientes para exportar a EPS.');
            return;
        }
        
        console.log('📄 EPS generado con', this.getPendingColorsSorted().length, 'colores');
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const fileName = `alpha_colors_${timestamp}.eps`;
        
        const blob = new Blob([epsContent], { type: 'application/postscript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        
        alert(`✅ Archivo EPS exportado con ${this.getPendingColorsSorted().length} colores.`);
    }
    
    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    
    escapePS(str) {
        if (!str) return '';
        return str.replace(/[()\\]/g, '\\$&');
    }
    
    refreshPreview() {
        this.renderPreview();
    }
}