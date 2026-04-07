// ============================================================
// EPS VIEW - Exportar colores pendientes a EPS
// Versión CORREGIDA - Usa la estructura que funciona
// Basado en el código de prueba que SÍ generaba el rectángulo
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
    
    // ============================================================
    // ESTRUCTURA EPS CORREGIDA - Basada en el código que FUNCIONA
    // ============================================================
    generateEPSContent() {
        const colors = this.getPendingColorsSorted();
        const plotterValue = this.app && this.app.creatorView ? this.app.creatorView.getGlobalPlotter() : 14;
        
        if (colors.length === 0) {
            return null;
        }
        
        // Tamaño en puntos (1 punto = 1/72 pulgada)
        // 10cm = 283.464566929 puntos
        const cmToPoints = 28.3464566929;
        const boxSize = 10 * cmToPoints; // 283.464566929 puntos
        const margin = 0.5 * cmToPoints; // 5mm = 14.1732283465 puntos
        const cols = Math.min(colors.length, 5);
        const rows = Math.ceil(colors.length / cols);
        
        const pageWidth = (boxSize + margin) * cols + margin;
        const pageHeight = (boxSize + margin) * rows + margin;
        
        let eps = `%!PS-Adobe-3.0 EPSF-3.0
%%BoundingBox: 0 0 ${Math.round(pageWidth)} ${Math.round(pageHeight)}
%%HiResBoundingBox: 0 0 ${pageWidth} ${pageHeight}
%%Title: Alpha Color Match EPS Export
%%Creator: Alpha Color Match
%%LanguageLevel: 2
%%Pages: 1
%%DocumentProcessColors: Cyan Magenta Yellow Black
`;
        
        // Agregar cada spot color al encabezado
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

%%BeginProlog
/boxSize ${boxSize} def
/margin ${margin} def
/cols ${cols} def
/rows ${rows} def
/pageWidth ${pageWidth} def
/pageHeight ${pageHeight} def

/Helvetica findfont 10 scalefont setfont
%%EndProlog

%%Page: 1 1
%%BeginPageSetup
<< /PageSize [pageWidth pageHeight] >> setpagedevice
0 0 translate
%%EndPageSetup

gsave
1 1 1 setrgbcolor
0 0 pageWidth pageHeight rectfill

`;
        
        // Dibujar cada rectángulo con su spot color
        for (let i = 0; i < colors.length; i++) {
            const color = colors[i];
            const spotName = `${color.name} ${color.nk}`.toUpperCase();
            const col = i % 5;
            const row = Math.floor(i / 5);
            
            const x = margin + col * (boxSize + margin);
            const y = pageHeight - margin - (row + 1) * (boxSize + margin);
            
            const cDec = (color.cmyk.c / 100).toFixed(6);
            const mDec = (color.cmyk.m / 100).toFixed(6);
            const yDec = (color.cmyk.y / 100).toFixed(6);
            const kDec = (color.cmyk.k / 100).toFixed(6);
            
            const cInt = Math.round(color.cmyk.c);
            const mInt = Math.round(color.cmyk.m);
            const yInt = Math.round(color.cmyk.y);
            const kInt = Math.round(color.cmyk.k);
            
            // Posiciones para texto
            const textX = x + 10;
            const plotterY = y + boxSize - 15;
            const cmykY = y + boxSize - 35;
            const nameY = y + 20;
            
            eps += `% ============================================
% Color ${i + 1}: ${this.escapePS(spotName)}
% ============================================

% SPOT COLOR - ESTRUCTURA QUE FUNCIONA
[/Separation (${this.escapePS(spotName)}) /DeviceCMYK { ${cDec} ${mDec} ${yDec} ${kDec} }] setcolorspace
newpath
${x} ${y} moveto
${x + boxSize} ${y} lineto
${x + boxSize} ${y + boxSize} lineto
${x} ${y + boxSize} lineto
closepath
fill

% TEXTO PLOTTER
0 0 0 setrgbcolor
/Helvetica findfont 12 scalefont setfont
${textX} ${plotterY} moveto (Plotter: ${plotterValue}) show

% TEXTO CMYK
/Helvetica findfont 10 scalefont setfont
${textX} ${cmykY} moveto (C:${cInt}  M:${mInt}  Y:${yInt}  K:${kInt}) show

% TEXTO NOMBRE DEL SPOT
/Helvetica findfont 8 scalefont setfont
${textX} ${nameY} moveto (${this.escapePS(spotName)}) show

`;
        }
        
        eps += `grestore
showpage
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