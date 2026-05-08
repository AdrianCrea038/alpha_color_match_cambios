// js/views/catalogManagementView.js
import { 
    supabase, 
    replaceEquivalenciesTable, 
    replaceMasterNksTable, 
    addColorNameToGroup, 
    createNewEquivalencyGroup, 
    addMasterNk 
} from '../core/supabaseClient.js';

export class CatalogManagementView {
    constructor(app) {
        this.app = app;
        this.container = null;
        this.statusDiv = null;
        this.init();
    }

    init() {
        this.container = document.getElementById('catalogManagementView');
        if (!this.container) {
            console.error('❌ [CatalogManagement] No se encontró el contenedor #catalogManagementView');
            return;
        }

        this.statusDiv = document.getElementById('catalogStatus');
        this.bindEvents();
        console.log('✅ [CatalogManagement] Inicialización profesional completada');
    }

    render() {
        console.log('📊 Renderizando CatalogManagementView');
        if (this.app.loadMasterData) this.app.loadMasterData();
    }

    bindEvents() {
        console.log('🔗 [CatalogManagement] Vinculando eventos...');
        
        const bind = (id, fn, label) => {
            const el = document.getElementById(id);
            if (el) {
                // Eliminar cualquier listener previo clonando el nodo (limpieza total)
                const newEl = el.cloneNode(true);
                el.parentNode.replaceChild(newEl, el);

                newEl.addEventListener('click', async (e) => {
                    console.log(`🖱️ Acción: ${label}`);
                    
                    // Feedback visual inmediato
                    const originalBg = newEl.style.background;
                    const originalBorder = newEl.style.borderColor;
                    newEl.style.background = 'rgba(0, 229, 255, 0.3)';
                    newEl.style.borderColor = '#00e5ff';
                    newEl.style.transform = 'scale(0.97)';
                    
                    try {
                        await fn(e);
                    } catch (err) {
                        console.error(`Error en ${label}:`, err);
                        alert(`Error: ${err.message}`);
                    } finally {
                        setTimeout(() => {
                            newEl.style.background = originalBg;
                            newEl.style.borderColor = originalBorder;
                            newEl.style.transform = '';
                        }, 150);
                    }
                });
            }
        };

        // Descargas
        bind('downloadEquivalenciasBtn', () => this.downloadExcel('equivalencias'), 'Descarga Equivalencias');
        bind('downloadMasterNksBtn', () => this.downloadExcel('master_nks'), 'Descarga NKs');

        // Cargas (File Inputs)
        const upEqInput = document.getElementById('uploadEquivalenciasInput');
        bind('triggerUploadEquivalenciasBtn', () => upEqInput?.click(), 'Abrir Carga Equivalencias');
        if (upEqInput) {
            upEqInput.onchange = (e) => this.handleFileUpload('equivalencias', e.target.files[0]);
        }

        const upNkInput = document.getElementById('uploadMasterNksInput');
        bind('triggerUploadMasterNksBtn', () => upNkInput?.click(), 'Abrir Carga NKs');
        if (upNkInput) {
            upNkInput.onchange = (e) => this.handleFileUpload('master_nks', e.target.files[0]);
        }

        // Creación Individual
        bind('addIndividualColorBtn', () => this.showAddIndividualColorModal(), 'Modal Agregar Color');
        bind('addIndividualNkBtn', () => this.showAddIndividualNkModal(), 'Modal Agregar NK');
    }

    async showAddIndividualColorModal() {
        const btn = document.getElementById('addIndividualColorBtn');
        const originalText = btn?.innerHTML;
        
        if (btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> CARGANDO GRUPOS...';
            btn.disabled = true;
        }

        let groupIds = [];
        let idCol = 'nk';
        let groups = [];

        try {
            // Consulta segura (evita error 400)
            const { data, error } = await supabase.from('equivalencias').select('*');
            if (error) throw error;
            groups = data || [];

            const firstRow = groups[0] || {};
            idCol = ['nk', 'grupo_id', 'nk_code', 'group_id', 'code'].find(c => c in firstRow) || 'nk';
            groupIds = [...new Set(groups.map(g => g[idCol]))].filter(id => id).sort();
        } catch (err) {
            alert('No se pudieron cargar los grupos: ' + err.message);
            return;
        } finally {
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); display:flex; align-items:center; justify-content:center; z-index:10000; backdrop-filter:blur(4px);';
        
        modal.innerHTML = `
            <div class="modal-content" style="background:#0f172a; border:2px solid #334155; border-radius:20px; padding:2rem; width:95%; max-width:500px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.7);">
                <h3 style="color:#00e5ff; margin-top:0; margin-bottom:1.5rem; display:flex; align-items:center; gap:12px; font-size:1.4rem;">
                    <i class="fas fa-search-plus"></i> Buscador y Registro de Colores
                </h3>
                
                <div style="margin-bottom:1.5rem;">
                    <label style="display:block; color:#94a3b8; font-size:0.85rem; margin-bottom:8px; font-weight:600;">BUSCAR O SELECCIONAR GRUPO</label>
                    <div style="position:relative;">
                        <input type="text" id="groupSearchInput" placeholder="Escribe ID o nombre del color..." 
                               style="width:100%; background:#1e293b; border:1px solid #334155; color:white; padding:12px; border-radius:10px; font-size:1rem; outline:none; box-sizing:border-box;">
                        <div id="groupSearchResults" style="display:none; position:absolute; top:100%; left:0; width:100%; background:#1e293b; border:1px solid #334155; border-radius:0 0 10px 10px; max-height:200px; overflow-y:auto; z-index:10001; box-shadow:0 10px 15px rgba(0,0,0,0.5);">
                        </div>
                    </div>
                    <input type="hidden" id="selectedGroupId" value="">
                </div>

                <div id="selectedGroupDisplay" style="display:none; margin-bottom:1.5rem; padding:1rem; background:rgba(16,185,129,0.1); border:1px solid #10b981; border-radius:12px; color:#10b981; font-weight:600; font-size:0.9rem;">
                </div>

                <div id="newGroupSection" style="display:none; margin-bottom:1.5rem; padding:1rem; background:rgba(0,229,255,0.05); border-radius:12px; border:1px dashed #00e5ff;">
                    <label style="display:block; color:#00e5ff; font-size:0.85rem; margin-bottom:8px; font-weight:600;">ID DEL NUEVO GRUPO</label>
                    <input type="text" id="newGroupId" placeholder="Ej: NK711075" style="width:100%; background:#0f172a; border:1px solid #00e5ff; color:white; padding:10px; border-radius:8px; text-transform:uppercase; box-sizing:border-box;">
                </div>

                <div style="margin-bottom:2rem;">
                    <label style="display:block; color:#94a3b8; font-size:0.85rem; margin-bottom:8px; font-weight:600;">NOMBRE DEL COLOR A AGREGAR</label>
                    <input type="text" id="newColorName" placeholder="Ej: ROYAL BLUE" list="existingColorsList" 
                           style="width:100%; background:#1e293b; border:1px solid #334155; color:white; padding:12px; border-radius:10px; text-transform:uppercase; box-sizing:border-box;">
                    <datalist id="existingColorsList">
                        ${[...new Set(groups.flatMap(g => g.colores || []))].map(c => `<option value="${c}">`).join('')}
                    </datalist>
                </div>

                <div style="display:flex; gap:1rem; justify-content:flex-end;">
                    <button id="cancelColorBtn" style="background:transparent; border:1px solid #475569; color:#94a3b8; padding:12px 20px; border-radius:10px; cursor:pointer; font-weight:600;">CANCELAR</button>
                    <button id="saveColorBtn" style="background:#00e5ff; border:none; color:#0f172a; padding:12px 25px; border-radius:10px; cursor:pointer; font-weight:800;">GUARDAR CAMBIOS</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const searchInput = modal.querySelector('#groupSearchInput');
        const resultsDiv = modal.querySelector('#groupSearchResults');
        const selectedIdInput = modal.querySelector('#selectedGroupId');
        const selectedDisplay = modal.querySelector('#selectedGroupDisplay');
        const newGroupSection = modal.querySelector('#newGroupSection');

        const filterGroups = (query) => {
            const q = query.toUpperCase();
            const filtered = groups.filter(g => {
                const id = String(g[idCol] || '').toUpperCase();
                const colors = (g.colores || []).join(' ').toUpperCase();
                return id.includes(q) || colors.includes(q);
            }).slice(0, 10);

            if (filtered.length > 0 || q === '') {
                resultsDiv.innerHTML = `
                    <div class="search-item" data-id="NEW" style="padding:10px; cursor:pointer; color:#00e5ff; font-weight:bold; border-bottom:1px solid #334155;">+ CREAR NUEVO GRUPO</div>
                    ${filtered.map(g => `
                        <div class="search-item" data-id="${g[idCol]}" style="padding:10px; cursor:pointer; border-bottom:1px solid #334155; color:white;">
                            <strong style="color:#00e5ff;">${g[idCol]}</strong><br>
                            <span style="font-size:0.75rem; color:#94a3b8;">${(g.colores || []).join(', ')}</span>
                        </div>
                    `).join('')}
                `;
                resultsDiv.style.display = 'block';
            } else {
                resultsDiv.innerHTML = '<div style="padding:10px; color:#94a3b8;">No se encontraron coincidencias</div>';
                resultsDiv.style.display = 'block';
            }
        };

        searchInput.addEventListener('input', (e) => filterGroups(e.target.value));
        searchInput.addEventListener('focus', () => filterGroups(searchInput.value));

        modal.addEventListener('click', (e) => {
            const item = e.target.closest('.search-item');
            if (item) {
                const id = item.dataset.id;
                selectedIdInput.value = id;
                if (id === 'NEW') {
                    searchInput.value = '';
                    selectedDisplay.style.display = 'none';
                    newGroupSection.style.display = 'block';
                } else {
                    searchInput.value = id;
                    selectedDisplay.innerHTML = `Grupo seleccionado: <strong>${id}</strong>`;
                    selectedDisplay.style.display = 'block';
                    newGroupSection.style.display = 'none';
                }
                resultsDiv.style.display = 'none';
            } else if (!e.target.closest('#groupSearchInput')) {
                resultsDiv.style.display = 'none';
            }
        });

        modal.querySelector('#cancelColorBtn').onclick = () => modal.remove();
        
        modal.querySelector('#saveColorBtn').onclick = async () => {
            const groupValue = selectedIdInput.value;
            const newId = modal.querySelector('#newGroupId').value.trim().toUpperCase();
            const colorName = modal.querySelector('#newColorName').value.trim().toUpperCase();
            const saveBtn = modal.querySelector('#saveColorBtn');

            if (!groupValue) return alert('Por favor, selecciona un grupo del buscador');
            if (groupValue === 'NEW' && !newId) return alert('Escribe el ID para el nuevo grupo');
            if (!colorName) return alert('Escribe el nombre del color');

            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> GUARDANDO...';

            try {
                const finalGroupId = groupValue === 'NEW' ? newId : groupValue;
                let result;

                if (groupValue === 'NEW') {
                    result = await createNewEquivalencyGroup(finalGroupId, colorName);
                } else {
                    result = await addColorNameToGroup(finalGroupId, colorName);
                }

                if (result.success) {
                    alert('✅ Color agregado con éxito.');
                    modal.remove();
                    this.render();
                } else {
                    throw new Error(result.error);
                }
            } catch (err) {
                alert('Error al guardar: ' + err.message);
                saveBtn.disabled = false;
                saveBtn.innerHTML = 'GUARDAR COLOR';
            }
        };
    }

    async showAddIndividualNkModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); display:flex; align-items:center; justify-content:center; z-index:10000; backdrop-filter:blur(4px);';
        
        modal.innerHTML = `
            <div class="modal-content" style="background:#0f172a; border:2px solid #334155; border-radius:20px; padding:2rem; width:95%; max-width:400px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.7);">
                <h3 style="color:#10b981; margin-top:0; margin-bottom:1.5rem; display:flex; align-items:center; gap:12px; font-size:1.4rem;">
                    <i class="fas fa-barcode"></i> Nuevo Código NK Maestro
                </h3>
                
                <div style="margin-bottom:2rem;">
                    <label style="display:block; color:#94a3b8; font-size:0.85rem; margin-bottom:8px; font-weight:600;">CÓDIGO NK</label>
                    <input type="text" id="nkCodeInput" placeholder="Ej: NK711075" style="width:100%; background:#1e293b; border:1px solid #334155; color:white; padding:12px; border-radius:10px; font-family:monospace; font-weight:800; font-size:1.2rem; text-align:center; text-transform:uppercase;">
                </div>

                <div style="display:flex; gap:1rem; justify-content:flex-end;">
                    <button id="cancelNkBtn" style="background:transparent; border:1px solid #475569; color:#94a3b8; padding:12px 20px; border-radius:10px; cursor:pointer;">CANCELAR</button>
                    <button id="saveNkBtn" style="background:#10b981; border:none; color:white; padding:12px 25px; border-radius:10px; cursor:pointer; font-weight:800;">GUARDAR NK</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.querySelector('#nkCodeInput').focus();

        modal.querySelector('#cancelNkBtn').onclick = () => modal.remove();
        modal.querySelector('#saveNkBtn').onclick = async () => {
            const code = modal.querySelector('#nkCodeInput').value.trim().toUpperCase();
            const saveBtn = modal.querySelector('#saveNkBtn');

            if (!code) return alert('Escribe el código NK');

            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> GUARDANDO...';

            try {
                const user = this.app.auth?.getCurrentUser()?.username || 'admin';
                const result = await addMasterNk(code, user);
                if (result.success) {
                    alert('✅ Código NK agregado correctamente.');
                    modal.remove();
                    this.render();
                } else {
                    throw new Error(result.error);
                }
            } catch (err) {
                alert('Error: ' + err.message);
                saveBtn.disabled = false;
                saveBtn.innerHTML = 'GUARDAR NK';
            }
        };
    }

    async downloadExcel(tableName) {
        window.showLoading?.(`Generando Excel de ${tableName}...`);
        try {
            const { data, error } = await supabase.from(tableName).select('*');
            if (error) throw error;

            if (!data || data.length === 0) {
                alert('La tabla está vacía.');
                return;
            }

            let exportData = [];
            let headers = [];
            
            if (tableName === 'equivalencias') {
                const firstRow = data[0] || {};
                const idCol = ['nk', 'grupo_id', 'nk_code', 'group_id', 'code'].find(c => c in firstRow) || 'nk';
                
                const isTonal = (item) => {
                    const id = String(item[idCol] || '').toUpperCase();
                    const colors = Array.isArray(item.colores) ? item.colores.join(' ').toUpperCase() : String(item.colores || '').toUpperCase();
                    return id.includes('TONAL') || id.includes('NEW_GRP') || colors.includes('TONAL');
                };

                const sortedData = [...data].sort((a, b) => {
                    const aTonal = isTonal(a);
                    const bTonal = isTonal(b);
                    if (aTonal === bTonal) return String(a[idCol]).localeCompare(String(b[idCol]));
                    return aTonal ? 1 : -1;
                });

                // Determinar el número máximo de colores para los encabezados
                let maxCols = 0;
                const rows = sortedData.map(item => {
                    const row = [item[idCol]];
                    let colors = [];
                    if (Array.isArray(item.colores)) colors = item.colores;
                    else if (typeof item.colores === 'string') {
                        try { colors = JSON.parse(item.colores); } catch { colors = [item.colores]; }
                    }
                    if (colors.length > maxCols) maxCols = colors.length;
                    return row.concat(colors);
                });

                headers = ['GRUPO_ID'];
                for (let i = 1; i <= maxCols; i++) headers.push(`COLORES ${i}`);
                exportData = rows;
            } else {
                headers = Object.keys(data[0]);
                exportData = data.map(obj => Object.values(obj));
            }

            // GENERAR HTML CON ESTILOS PARA EXCEL
            let html = `
                <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                <head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${tableName}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
                <body>
                <table border="1">
                    <thead>
                        <tr style="background-color: #002060; color: #ffffff; font-weight: bold; height: 30px; text-align: center;">
                            ${headers.map(h => `<th style="border: 1px solid #000000; padding: 5px;">${h}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${exportData.map(row => `
                            <tr>
                                ${row.map(cell => `<td style="border: 1px solid #000000; padding: 3px;">${cell || ''}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                </body>
                </html>
            `;

            const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `AlphaColor_${tableName}_${new Date().toISOString().split('T')[0]}.xls`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            window.showNotification('Descarga Exitosa', `✅ Archivo de ${tableName} con formato y bordes generado.`, 'success');
        } catch (err) {
            alert('Error al descargar: ' + err.message);
        } finally {
            window.hideLoading?.();
        }
    }

    async handleFileUpload(tableName, file) {
        if (!file) return;
        
        const confirmMsg = `⚠️ ADVERTENCIA CRÍTICA:\n\nVas a REEMPLAZAR TODA LA TABLA "${tableName.toUpperCase()}" con los datos de este archivo.\n\n¿Estás seguro? Esta acción borrará permanentemente los datos actuales.`;
        if (!confirm(confirmMsg)) {
            const input = document.getElementById(`upload${tableName.charAt(0).toUpperCase() + tableName.slice(1)}Input`);
            if (input) input.value = '';
            return;
        }

        window.showLoading?.(`Procesando archivo ${file.name}...`);
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                if (typeof XLSX === 'undefined') throw new Error('SheetJS no cargado.');
                const binaryData = new Uint8Array(e.target.result);
                const workbook = XLSX.read(binaryData, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

                if (jsonData.length < 2) throw new Error('El archivo no tiene datos válidos.');

                const rows = jsonData.slice(1);
                let result;

                if (tableName === 'equivalencias') {
                    const groups = rows.map(row => {
                        const groupId = row[0];
                        const colors = row.slice(1).filter(cell => cell && cell.toString().trim() !== '');
                        return { group_id: groupId, colores: colors };
                    }).filter(g => g.group_id);
                    result = await replaceEquivalenciesTable(groups);
                } else {
                    const nks = rows.map(row => row[0]).filter(nk => nk && nk.toString().trim() !== '');
                    result = await replaceMasterNksTable(nks, this.app.auth?.getCurrentUser()?.username || 'admin');
                }

                if (result?.success) {
                    window.showNotification('Sincronización Exitosa', `🚀 ¡Tabla ${tableName} actualizada con éxito!`, 'success');
                    if (this.app.loadMasterData) await this.app.loadMasterData();
                    this.render();
                } else {
                    throw new Error(result?.error || 'Error en la base de datos.');
                }
            } catch (err) {
                alert('Error al procesar: ' + err.message);
            } finally {
                window.hideLoading?.();
                const input = document.getElementById(`upload${tableName.charAt(0).toUpperCase() + tableName.slice(1)}Input`);
                if (input) input.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    }

    showStatus(message, type) {
        if (!this.statusDiv) return;
        this.statusDiv.textContent = message;
        this.statusDiv.style.display = 'block';
        this.statusDiv.style.cssText = `
            margin-top:1.5rem; 
            padding:1.2rem; 
            border-radius:12px; 
            font-weight:600;
            background:${type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; 
            color:${type === 'success' ? '#10b981' : '#ef4444'}; 
            border:1px solid ${type === 'success' ? '#10b981' : '#ef4444'};
            animation: fadeIn 0.3s ease;
        `;
        setTimeout(() => { this.statusDiv.style.display = 'none'; }, 6000);
    }
}
