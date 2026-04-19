import { escapeHtml } from '../core/utils.js';
import { supabase, getAllNks } from '../core/supabaseClient.js';
import { EQUIVALENCY_ROWS as CONST_EQUIVALENCY_ROWS } from '../core/constants.js';

export class DevelopmentView {
    constructor(app) {
        this.app = app;
        this.colors = [];
        this.nextId = 1;
        this.history = [];
        this.expandedGroups = new Set();
        this.isEquivalenceCollapsed = true;
        this.filterText = '';
        
        this.loadFromLocalStorage();
        this.loadHistoryFromLocalStorage();
        this.init();
    }
    
    async init() {
        await this.loadEquivalencyGroups();
        this.container = document.getElementById('developmentView');
        if (!this.container) return;
        this.render();
        console.log('✅ DevelopmentView inicializado');
    }
    
    async loadEquivalencyGroups() {
        try {
            console.log('📡 Intentando cargar grupos desde Supabase (tabla: equivalency_groups)...');
            const { data, error } = await supabase
                .from('equivalency_groups')
                .select('*')
                .order('group_id');
            
            if (!error && data && data.length > 0) {
                // Verificar estructura: ¿es un array de colores o una fila por color?
                if (data[0].colors && Array.isArray(data[0].colors)) {
                    // Formato: group_id, colors[]
                    window.EQUIVALENCY_ROWS = data.map(row => {
                        // Asegurar que el ID del grupo esté en la primera posición si no lo está
                        const colors = [...row.colors];
                        if (colors[0] !== row.group_id) {
                            return [row.group_id, ...colors];
                        }
                        return colors;
                    });
                } else {
                    // Formato: group_id, color_name (agrupar en JS)
                    const grouped = {};
                    data.forEach(row => {
                        const gid = row.group_id || 'SIN_GRUPO';
                        const cname = row.color_name || row.color || row.name;
                        if (!grouped[gid]) grouped[gid] = [gid];
                        if (cname && !grouped[gid].includes(cname)) grouped[gid].push(cname);
                    });
                    window.EQUIVALENCY_ROWS = Object.values(grouped);
                }
                console.log(`✅ ${window.EQUIVALENCY_ROWS.length} grupos cargados correctamente de Supabase.`);
            } else {
                if (error) console.error('❌ Error de Supabase:', error);
                window.EQUIVALENCY_ROWS = [...CONST_EQUIVALENCY_ROWS];
                console.log('⚠️ Usando constants.js como fallback.');
            }
        } catch (error) {
            console.error('❌ Error crítico cargando grupos:', error);
            window.EQUIVALENCY_ROWS = [...CONST_EQUIVALENCY_ROWS];
        }
        
        window.ALL_VALID_COLOR_NAMES = this.buildAllValidColorNames(window.EQUIVALENCY_ROWS);
        window.EQUIVALENCE_MAP = this.buildEquivalenceMap(window.EQUIVALENCY_ROWS);
    }
    
    buildAllValidColorNames(rows) {
        const names = [];
        for (const row of rows) {
            for (let i = 1; i < row.length; i++) {
                names.push(row[i].toUpperCase());
            }
        }
        return [...new Set(names)].sort();
    }
    
    buildEquivalenceMap(rows) {
        const map = new Map();
        for (const row of rows) {
            const groupId = row[0];
            const names = row.slice(1);
            for (const name of names) {
                const key = name.toUpperCase();
                if (!map.has(key)) {
                    map.set(key, { groupId, names: [...names] });
                }
            }
        }
        return map;
    }
    
    loadFromLocalStorage() {
        const saved = localStorage.getItem('developmentColors');
        if (saved) {
            try {
                this.colors = JSON.parse(saved);
                if (this.colors.length > 0) {
                    this.nextId = Math.max(...this.colors.map(c => c.id), 0) + 1;
                }
            } catch(e) {
                this.colors = [];
                this.nextId = 1;
            }
        }
    }
    
    saveToLocalStorage() {
        localStorage.setItem('developmentColors', JSON.stringify(this.colors));
    }
    
    loadHistoryFromLocalStorage() {
        const saved = localStorage.getItem('developmentHistory');
        if (saved) {
            try { this.history = JSON.parse(saved); } catch(e) { this.history = []; }
        }
    }
    
    saveHistoryToLocalStorage() {
        localStorage.setItem('developmentHistory', JSON.stringify(this.history));
    }
    
    addHistoryEntry(action, details, reason = '') {
        const currentUser = this.app?.auth?.getCurrentUser()?.username || 'usuario';
        this.history.unshift({
            id: Date.now(),
            timestamp: new Date().toISOString(),
            user: currentUser,
            action,
            details,
            reason
        });
        if (this.history.length > 500) this.history = this.history.slice(0, 500);
        this.saveHistoryToLocalStorage();
    }
    
    render() {
        if (!this.container) return;
        this.container.innerHTML = `
            <style>
                .dev-section {
                    background: #0c0c12;
                    border: 1px solid #2d3748;
                    border-radius: 10px;
                    margin-bottom: 2rem;
                    overflow: hidden;
                }
                .dev-section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem;
                    background: #111117;
                    border-bottom: 1px solid #2d3748;
                    flex-wrap: wrap;
                    gap: 1rem;
                }
                .dev-section-header h3 {
                    margin: 0;
                    font-size: 1rem;
                    color: #eab308;
                }
                .dev-section-header h3 i {
                    margin-right: 0.5rem;
                    color: #00e5ff;
                }
                .dev-actions {
                    display: flex;
                    gap: 0.75rem;
                    flex-wrap: wrap;
                }
                .dev-btn {
                    background: transparent;
                    border: 1px solid #4b5563;
                    color: #e2e8f0;
                    cursor: pointer;
                    padding: 0.4rem 0.8rem;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    transition: all 0.2s;
                }
                .dev-btn:hover {
                    background: rgba(0, 229, 255, 0.15);
                    border-color: #00e5ff;
                    transform: translateY(-1px);
                }
                .dev-btn.success {
                    border-color: #4ade80;
                    color: #4ade80;
                }
                .dev-btn.danger {
                    border-color: #f87171;
                    color: #f87171;
                }
                .dev-table-wrapper {
                    overflow-x: auto;
                    padding: 0.5rem;
                }
                .dev-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.7rem;
                }
                .dev-table th {
                    background: #1a1a2a;
                    padding: 0.5rem;
                    text-align: left;
                    color: #9ca3af;
                    border-bottom: 1px solid #2d3748;
                }
                .dev-table td {
                    padding: 0.5rem;
                    border-bottom: 1px solid #1e1e2c;
                    vertical-align: middle;
                }
                .dev-group-card {
                    background: #1a1a2a;
                    border: 1px solid #2d3748;
                    border-radius: 8px;
                    margin-bottom: 0.75rem;
                    overflow: hidden;
                }
                .dev-group-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.75rem 1rem;
                    background: #111117;
                    cursor: pointer;
                }
                .dev-group-header:hover {
                    background: #1f1f2a;
                }
                .dev-group-name {
                    font-weight: bold;
                    color: #00e5ff;
                    font-size: 0.85rem;
                }
                .dev-group-count {
                    color: #9ca3af;
                    font-size: 0.7rem;
                    margin-left: 0.5rem;
                }
                .dev-group-colors {
                    padding: 0.75rem;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                }
                .dev-color-tag {
                    background: #1f1f2a;
                    border: 1px solid #4b5563;
                    border-radius: 1rem;
                    padding: 0.25rem 0.75rem;
                    font-size: 0.7rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .status-badge {
                    display: inline-block;
                    padding: 0.2rem 0.5rem;
                    border-radius: 1rem;
                    font-size: 0.65rem;
                    font-weight: 600;
                }
                .status-badge.pending {
                    background: #b45309;
                    color: white;
                }
                .empty-state {
                    text-align: center;
                    padding: 2rem;
                    color: #6b7280;
                }
                .empty-icon {
                    font-size: 3rem;
                    margin-bottom: 0.5rem;
                    opacity: 0.5;
                }
                .dev-input-number {
                    width: 55px;
                    padding: 0.3rem;
                    background: #1e1e2c;
                    border: 1px solid #4b5563;
                    border-radius: 4px;
                    color: white;
                    text-align: center;
                }
                .channel-group {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 0.5rem;
                    margin-top: 0.75rem;
                }
                .channel-label {
                    font-size: 0.7rem;
                    color: #9ca3af;
                    margin-bottom: 0.2rem;
                }
                .observation-textarea {
                    width: 100%;
                    padding: 0.5rem;
                    background: #1e1e2c;
                    border: 1px solid #4b5563;
                    border-radius: 0.4rem;
                    color: white;
                    font-family: inherit;
                    resize: vertical;
                }
                .modal-buttons {
                    display: flex;
                    gap: 1rem;
                    justify-content: flex-end;
                    padding: 1rem;
                    border-top: 1px solid #2d3748;
                }
                .form-group {
                    margin-bottom: 0.75rem;
                    position: relative;
                }
                .form-group label {
                    display: block;
                    font-size: 0.75rem;
                    color: #9ca3af;
                    margin-bottom: 0.25rem;
                }
                .group-filter-input {
                    width: 100%;
                    padding: 0.5rem;
                    background: #1e1e2c;
                    border: 1px solid #4b5563;
                    border-radius: 0.4rem;
                    color: white;
                    margin-bottom: 0.75rem;
                }
                .groups-list-container {
                    max-height: 300px;
                    overflow-y: auto;
                    border: 1px solid #2d3748;
                    border-radius: 0.4rem;
                    background: #0c0c12;
                }
                .group-filter-item {
                    padding: 0.5rem 0.8rem;
                    cursor: pointer;
                    border-bottom: 1px solid #2d3748;
                    transition: background 0.1s;
                }
                .group-filter-item:hover {
                    background: rgba(0, 229, 255, 0.15);
                }
                .group-filter-item.selected {
                    background: rgba(0, 229, 255, 0.3);
                    border-left: 3px solid #00e5ff;
                }
                .highlight {
                    background: #eab308;
                    color: #1a1a2a;
                    padding: 0 0.2rem;
                    border-radius: 0.2rem;
                }
            </style>
            
            <div class="dev-container">
                <div class="dev-section">
                    <div class="dev-section-header">
                        <h3><i class="fas fa-clock"></i> 📝 Colores Pendientes de Aprobación</h3>
                        <div class="dev-actions">
                            <button id="devAddPendingBtn" class="dev-btn success"><i class="fas fa-plus"></i> Agregar color</button>
                            <button id="devRefreshBtn" class="dev-btn"><i class="fas fa-sync"></i> Refrescar</button>
                        </div>
                    </div>
                    <div class="dev-table-wrapper">
                        <table class="dev-table">
                            <thead>
                                <tr><th>ID</th><th>Nombre</th><th>NK</th><th>C</th><th>M</th><th>Y</th><th>K</th><th>TQ</th><th>O</th><th>FY</th><th>FP</th><th>Grupo</th><th>Estado</th><th>Acciones</th>
                            </thead>
                            <tbody id="devPendingTableBody"></tbody>
                        </table>
                    </div>
                </div>
                
                <div class="dev-section">
                    <div class="dev-section-header" id="equivalenceHeader" style="cursor: pointer;">
                        <h3>
                            <i class="fas fa-layer-group"></i> 
                            <span id="equivalenceToggleIcon" style="display:inline-block; transition:transform 0.2s; transform: ${this.isEquivalenceCollapsed ? 'rotate(0deg)' : 'rotate(90deg)'}">▶</span>
                            📁 Grupos de Equivalencia Existentes
                        </h3>
                        <div class="dev-actions">
                            <button id="devAddGroupBtn" class="dev-btn success"><i class="fas fa-plus"></i> Nuevo grupo</button>
                            <button id="devExportTableBtn" class="dev-btn"><i class="fas fa-download"></i> Exportar</button>
                            <button id="devImportTableBtn" class="dev-btn"><i class="fas fa-upload"></i> Importar</button>
                            <button id="devHistoryBtn" class="dev-btn"><i class="fas fa-history"></i> Historial</button>
                        </div>
                    </div>
                    <div id="devGroupsContainer" style="padding: 1rem; display: ${this.isEquivalenceCollapsed ? 'none' : 'block'};"></div>
                </div>
            </div>
        `;
        
        this.pendingTableBody = this.container.querySelector('#devPendingTableBody');
        this.groupsContainer = this.container.querySelector('#devGroupsContainer');
        
        this.renderPendingColors();
        this.renderGroups();
        this.attachEvents();
    }
    
    attachEvents() {
        const addPendingBtn = document.getElementById('devAddPendingBtn');
        const refreshBtn = document.getElementById('devRefreshBtn');
        const addGroupBtn = document.getElementById('devAddGroupBtn');
        const exportBtn = document.getElementById('devExportTableBtn');
        const importBtn = document.getElementById('devImportTableBtn');
        const historyBtn = document.getElementById('devHistoryBtn');
        
        if (addPendingBtn) addPendingBtn.onclick = () => this.showAddColorModal();
        if (refreshBtn) refreshBtn.onclick = () => { this.renderPendingColors(); this.renderGroups(); };
        if (addGroupBtn) addGroupBtn.onclick = () => this.showAddGroupModal();
        if (exportBtn) exportBtn.onclick = () => this.exportTable();
        if (importBtn) importBtn.onclick = () => this.importTable();
        if (historyBtn) historyBtn.onclick = () => this.showHistoryModal();
        
        const equivalenceHeader = document.getElementById('equivalenceHeader');
        if (equivalenceHeader) {
            equivalenceHeader.onclick = (e) => {
                if (e.target.closest('.dev-actions')) return;
                this.isEquivalenceCollapsed = !this.isEquivalenceCollapsed;
                const container = document.getElementById('devGroupsContainer');
                const icon = document.getElementById('equivalenceToggleIcon');
                if (container) container.style.display = this.isEquivalenceCollapsed ? 'none' : 'block';
                if (icon) icon.style.transform = this.isEquivalenceCollapsed ? 'rotate(0deg)' : 'rotate(90deg)';
                if (!this.isEquivalenceCollapsed) this.renderGroups();
            };
        }
        
        if (this.pendingTableBody) {
            this.pendingTableBody.onclick = (e) => {
                const btn = e.target.closest('.dev-edit-pending, .dev-approve-pending, .dev-delete-pending');
                if (!btn) return;
                const id = parseInt(btn.dataset.id);
                const color = this.colors.find(c => c.id === id);
                if (!color) return;
                if (btn.classList.contains('dev-edit-pending')) this.showEditColorModal(color);
                else if (btn.classList.contains('dev-approve-pending')) this.showApproveModal(color);
                else if (btn.classList.contains('dev-delete-pending')) this.showDeletePendingModal(color);
            };
        }
        
        if (this.groupsContainer) {
            this.groupsContainer.onclick = (e) => {
                const header = e.target.closest('.dev-group-header');
                if (header && !e.target.closest('.group-rename-btn') && !e.target.closest('.group-delete-btn') && !e.target.closest('.group-toggle-btn')) {
                    const group = header.dataset.group;
                    if (this.expandedGroups.has(group)) this.expandedGroups.delete(group);
                    else this.expandedGroups.add(group);
                    this.renderGroups();
                }
                const renameBtn = e.target.closest('.group-rename-btn');
                if (renameBtn) this.showRenameGroupModal(renameBtn.dataset.group);
                const deleteBtn = e.target.closest('.group-delete-btn');
                if (deleteBtn) this.showDeleteGroupModal(deleteBtn.dataset.group);
                const removeColorBtn = e.target.closest('.remove-color-btn');
                if (removeColorBtn) this.showRemoveColorModal(removeColorBtn.dataset.group, removeColorBtn.dataset.color);
            };
        }
    }
    
    getPendingColors() {
        return this.colors.filter(c => !c.approved);
    }
    
    renderPendingColors() {
        if (!this.pendingTableBody) return;
        const pendingColors = this.getPendingColors();
        if (pendingColors.length === 0) {
            this.pendingTableBody.innerHTML = '<tr><td colspan="14" class="empty-state">No hay colores pendientes. Agregue uno nuevo.    </tr></tr>';
            return;
        }
        this.pendingTableBody.innerHTML = pendingColors.map(color => `
            <tr>
                <td>${color.id}</td>
                <td><strong>${escapeHtml(color.name)}</strong></td>
                <td>${escapeHtml(color.nk)}</td>
                <td>${color.cmyk.c}%</td>
                <td>${color.cmyk.m}%</td>
                <td>${color.cmyk.y}%</td>
                <td>${color.cmyk.k}%</td>
                <td>${color.channels?.tq || 0}%</td>
                <td>${color.channels?.o || 0}%</td>
                <td>${color.channels?.fy || 0}%</td>
                <td>${color.channels?.fp || 0}%</td>
                <td>${escapeHtml(color.group)}</td>
                <td><span class="status-badge pending">⏳ Pendiente</span></td>
                <td>
                    <button class="dev-btn dev-edit-pending" data-id="${color.id}" style="border-color:#00e5ff; color:#00e5ff;"><i class="fas fa-edit"></i><\/button>
                    <button class="dev-btn dev-approve-pending" data-id="${color.id}" style="border-color:#4ade80; color:#4ade80;"><i class="fas fa-check-circle"></i><\/button>
                    <button class="dev-btn dev-delete-pending" data-id="${color.id}" style="border-color:#f87171; color:#f87171;"><i class="fas fa-trash"></i><\/button>
                  <\/td>
            <\/tr>
        `).join('');
    }
    
    getAllGroups() {
        const groups = new Map();
        const equivalencyRows = window.EQUIVALENCY_ROWS || [];
        
        for (const row of equivalencyRows) {
            if (row && row.length > 0) {
                const groupId = row[0];
                const colors = row.slice(1);
                groups.set(groupId, colors);
            }
        }
        return groups;
    }
    
    renderGroups() {
        if (!this.groupsContainer) return;
        
        const groups = this.getAllGroups();
        
        if (groups.size === 0) {
            this.groupsContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">📁</div><p>No hay grupos de equivalencia creados</p></div>';
            return;
        }
        
        this.groupsContainer.innerHTML = Array.from(groups.entries()).map(([groupId, colors]) => {
            const isExpanded = this.expandedGroups.has(groupId);
            return `
                <div class="dev-group-card">
                    <div class="dev-group-header" data-group="${escapeHtml(groupId)}">
                        <div><span class="dev-group-name">${escapeHtml(groupId)}</span><span class="dev-group-count">${colors.length} colores</span></div>
                        <div>
                            <button class="dev-btn group-rename-btn" data-group="${escapeHtml(groupId)}" style="border-color:#00e5ff; color:#00e5ff;"><i class="fas fa-edit"></i> Renombrar</button>
                            <button class="dev-btn group-delete-btn" data-group="${escapeHtml(groupId)}" style="border-color:#f87171; color:#f87171;"><i class="fas fa-trash"></i> Eliminar</button>
                            <button class="dev-btn group-toggle-btn" data-group="${escapeHtml(groupId)}"><i class="fas fa-chevron-${isExpanded ? 'down' : 'right'}"></i></button>
                        </div>
                    </div>
                    <div class="dev-group-colors" style="display: ${isExpanded ? 'flex' : 'none'}; padding: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
                        ${colors.map(color => `<div class="dev-color-tag">${escapeHtml(color)}<button class="remove-color-btn" data-group="${escapeHtml(groupId)}" data-color="${escapeHtml(color)}" title="Eliminar color"><i class="fas fa-times-circle"></i></button></div>`).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    async showAddColorModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '10001';
        
        // Cargar NKs existentes desde la librería (library_txt)
        let existingNks = [];
        try {
            const nks = await getAllNks();
            // Filtrar únicos
            existingNks = [...new Set(nks.map(item => item.nk))].sort();
        } catch (e) {
            console.error('Error cargando NKs de library_txt:', e);
        }

        const getFullGroups = () => {
            const groups = [];
            const equivalencyRows = window.EQUIVALENCY_ROWS || [];
            for (const row of equivalencyRows) {
                if (row && row.length > 0) {
                    groups.push({
                        id: row[0],
                        name: row[1] || row[0],
                        fullName: `${row[0]} - ${row[1] || row[0]}`
                    });
                }
            }
            return groups;
        };
        
        let selectedGroupId = '';
        
        const renderFilteredGroups = (filterText) => {
            const fullGroups = getFullGroups();
            const filteredGroups = fullGroups.filter(g => 
                g.id.toLowerCase().includes(filterText.toLowerCase()) || 
                g.name.toLowerCase().includes(filterText.toLowerCase())
            );
            const groupsContainer = modal.querySelector('#filteredGroupsContainer');
            if (!groupsContainer) return;
            if (filteredGroups.length === 0) {
                groupsContainer.innerHTML = '<div style="padding: 1rem; text-align: center; color: #6b7280;">No se encontraron grupos</div>';
                return;
            }
            const highlight = (text, search) => {
                if (!search) return escapeHtml(text);
                const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                return escapeHtml(text).replace(regex, '<span class="highlight">$1</span>');
            };
            groupsContainer.innerHTML = filteredGroups.map(g => `
                <div class="group-filter-item" data-group-id="${escapeHtml(g.id)}" data-group-name="${escapeHtml(g.name)}">
                    <strong>${highlight(g.id, filterText)}</strong> - ${highlight(g.name, filterText)}
                </div>
            `).join('');
            groupsContainer.querySelectorAll('.group-filter-item').forEach(item => {
                item.onclick = () => {
                    selectedGroupId = item.dataset.groupId;
                    const groupName = item.dataset.groupName;
                    modal.querySelector('#groupSearch').value = `${selectedGroupId} - ${groupName}`;
                    modal.querySelector('#selectedGroup').value = selectedGroupId;
                    groupsContainer.querySelectorAll('.group-filter-item').forEach(i => i.classList.remove('selected'));
                    item.classList.add('selected');
                };
            });
        };
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header" style="background: #15803d;">
                    <h3 style="color: white;">➕ Agregar nuevo color para Desarrollo</h3>
                    <button class="modal-close" style="color: white; background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Nombre del color:</label>
                        <input type="text" id="colorName" placeholder="Ej: NEON GREEN" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;">
                    </div>
                    
                    <div class="form-group">
                        <label>NK Maestro:</label>
                        <select id="nkSelect" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;">
                            <option value="">-- Seleccionar NK existente --</option>
                        </select>
                    </div>

                    <div id="newNkInputContainer" class="form-group" style="display: none; border-left: 3px solid #10b981; padding-left: 1rem;">
                        <label>Nuevo NK Code:</label>
                        <input type="text" id="newNkCode" placeholder="Ej: NK711075" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;">
                    </div>

                    <div class="channel-group">
                        <div><div class="channel-label">C (Cian)</div><input type="number" id="cmykC" value="0" min="0" max="100" step="1" class="dev-input-number" style="width:100%;"></div>
                        <div><div class="channel-label">M (Magenta)</div><input type="number" id="cmykM" value="0" min="0" max="100" step="1" class="dev-input-number" style="width:100%;"></div>
                        <div><div class="channel-label">Y (Yellow)</div><input type="number" id="cmykY" value="0" min="0" max="100" step="1" class="dev-input-number" style="width:100%;"></div>
                        <div><div class="channel-label">K (Black)</div><input type="number" id="cmykK" value="0" min="0" max="100" step="1" class="dev-input-number" style="width:100%;"></div>
                    </div>
                    <div class="channel-group">
                        <div><div class="channel-label">TQ (Turquoise)</div><input type="number" id="channelTQ" value="0" min="0" max="100" step="1" class="dev-input-number" style="width:100%;"></div>
                        <div><div class="channel-label">O (Orange)</div><input type="number" id="channelO" value="0" min="0" max="100" step="1" class="dev-input-number" style="width:100%;"></div>
                        <div><div class="channel-label">FY (Fl. Yellow)</div><input type="number" id="channelFY" value="0" min="0" max="100" step="1" class="dev-input-number" style="width:100%;"></div>
                        <div><div class="channel-label">FP (Fl. Pink)</div><input type="number" id="channelFP" value="0" min="0" max="100" step="1" class="dev-input-number" style="width:100%;"></div>
                    </div>
                    <div class="form-group">
                        <label>Buscar grupo (escribe para filtrar):</label>
                        <input type="text" id="groupSearch" placeholder="Escribe ID o nombre del color..." autocomplete="off" class="group-filter-input">
                        <div id="filteredGroupsContainer" class="groups-list-container"></div>
                        <input type="hidden" id="selectedGroup" value="">
                    </div>
                    <div class="form-group"><label>Observación:</label><textarea id="observation" rows="3" class="observation-textarea" placeholder="Ej: Nuevo color para la colección primavera..."></textarea></div>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-secondary cancel-modal" style="padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer;">Cancelar</button>
                    <button class="btn btn-primary confirm-modal" style="padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; background: #15803d; color: white; border: none;">➕ Agregar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        // CARGAR NKs EN SEGUNDO PLANO (Refresco opcional)
        getAllNks().then(nks => {
            const select = modal.querySelector('#nkSelect');
            if (select) {
                const uniqueNks = [...new Set(nks.map(n => n.nk))].sort();
                const options = uniqueNks.map(nk => `<option value="${escapeHtml(nk)}">${escapeHtml(nk)}</option>`).join('');
                select.innerHTML = '<option value="">-- Seleccionar NK de Librería --</option>' + options + 
                                  '<option value="NEW_NK" style="color: #10b981; font-weight: bold;">+ Agregar nuevo NK (Desarrollo)...</option>';
            }
        }).catch(() => {});

        const nkSelectEl = modal.querySelector('#nkSelect');
        const newNkInputContainer = modal.querySelector('#newNkInputContainer');
        nkSelectEl.onchange = (e) => {
            newNkInputContainer.style.display = e.target.value === 'NEW_NK' ? 'block' : 'none';
        };
        
        const closeModal = () => { modal.classList.remove('active'); setTimeout(() => modal.remove(), 300); };
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.cancel-modal').onclick = closeModal;
        
        const searchInput = modal.querySelector('#groupSearch');
        const hiddenInput = modal.querySelector('#selectedGroup');
        
        searchInput.addEventListener('input', (e) => renderFilteredGroups(e.target.value));
        renderFilteredGroups('');
        
        modal.querySelector('.confirm-modal').onclick = async () => {
            const name = modal.querySelector('#colorName').value.trim().toUpperCase();
            
            let nk = nkSelectEl.value;
            if (nk === 'NEW_NK') {
                nk = modal.querySelector('#newNkCode').value.trim().toUpperCase();
            }
            const selectedGroup = hiddenInput.value;
            const observation = modal.querySelector('#observation').value.trim();
            const c = parseInt(modal.querySelector('#cmykC').value) || 0;
            const m = parseInt(modal.querySelector('#cmykM').value) || 0;
            const y = parseInt(modal.querySelector('#cmykY').value) || 0;
            const k = parseInt(modal.querySelector('#cmykK').value) || 0;
            const tq = parseInt(modal.querySelector('#channelTQ').value) || 0;
            const o = parseInt(modal.querySelector('#channelO').value) || 0;
            const fy = parseInt(modal.querySelector('#channelFY').value) || 0;
            const fp = parseInt(modal.querySelector('#channelFP').value) || 0;
            
            if (!name) { alert('⚠️ Debe ingresar el nombre del color.'); return; }
            if (!nk) { alert('⚠️ Debe ingresar el NK.'); return; }
            if (!selectedGroup) { alert('⚠️ Debe seleccionar un grupo.'); return; }
            
            // Registrar NK si es nuevo (sin bloquear)
            try {
                const masterNks = await getAllMasterNks();
                if (nk && !masterNks.includes(nk)) {
                    await addMasterNk(nk, this.app?.auth?.getCurrentUser()?.username);
                }
            } catch (e) {}
            
            this.addPendingColor({ name, nk, group: selectedGroup, cmyk: { c, m, y, k }, channels: { tq, o, fy, fp }, observation });
            this.addHistoryEntry('ADD_PENDING', `Color "${name}" agregado a pendientes (Grupo: ${selectedGroup})`, observation);
            closeModal();
        };
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };
        setTimeout(() => modal.querySelector('#colorName').focus(), 100);
    }
    
    addPendingColor(colorData) {
        this.colors.push({
            id: this.nextId++,
            name: colorData.name,
            nk: colorData.nk,
            cmyk: colorData.cmyk,
            channels: colorData.channels || { tq: 0, o: 0, fy: 0, fp: 0 },
            group: colorData.group,
            observation: colorData.observation || '',
            approved: false,
            created_at: new Date().toISOString(),
            modified_at: new Date().toISOString()
        });
        this.saveToLocalStorage();
        this.renderPendingColors();
        alert(`✅ Color "${colorData.name}" agregado correctamente.`);
    }
    
    showEditColorModal(color) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '10001';
        
        const getFullGroups = () => {
            const groups = [];
            const equivalencyRows = window.EQUIVALENCY_ROWS || [];
            for (const row of equivalencyRows) {
                if (row && row.length > 0) {
                    groups.push({
                        id: row[0],
                        name: row[1] || row[0],
                        fullName: `${row[0]} - ${row[1] || row[0]}`
                    });
                }
            }
            return groups;
        };
        
        let selectedGroupId = color.group;
        
        const renderFilteredGroups = (filterText) => {
            const fullGroups = getFullGroups();
            const filteredGroups = fullGroups.filter(g => 
                g.id.toLowerCase().includes(filterText.toLowerCase()) || 
                g.name.toLowerCase().includes(filterText.toLowerCase())
            );
            const groupsContainer = modal.querySelector('#filteredGroupsContainer');
            if (!groupsContainer) return;
            if (filteredGroups.length === 0) {
                groupsContainer.innerHTML = '<div style="padding: 1rem; text-align: center; color: #6b7280;">No se encontraron grupos</div>';
                return;
            }
            const highlight = (text, search) => {
                if (!search) return escapeHtml(text);
                const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                return escapeHtml(text).replace(regex, '<span class="highlight">$1</span>');
            };
            groupsContainer.innerHTML = filteredGroups.map(g => `
                <div class="group-filter-item" data-group-id="${escapeHtml(g.id)}" data-group-name="${escapeHtml(g.name)}" ${g.id === selectedGroupId ? 'selected' : ''}>
                    <strong>${highlight(g.id, filterText)}</strong> - ${highlight(g.name, filterText)}
                </div>
            `).join('');
            groupsContainer.querySelectorAll('.group-filter-item').forEach(item => {
                if (item.dataset.groupId === selectedGroupId) item.classList.add('selected');
                item.onclick = () => {
                    selectedGroupId = item.dataset.groupId;
                    const groupName = item.dataset.groupName;
                    modal.querySelector('#groupSearch').value = `${selectedGroupId} - ${groupName}`;
                    modal.querySelector('#selectedGroup').value = selectedGroupId;
                    groupsContainer.querySelectorAll('.group-filter-item').forEach(i => i.classList.remove('selected'));
                    item.classList.add('selected');
                };
            });
        };
        
        const currentGroup = getFullGroups().find(g => g.id === color.group);
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header" style="background: #b45309;">
                    <h3 style="color: white;">✏️ Editar color: ${escapeHtml(color.name)}</h3>
                    <button class="modal-close" style="color: white; background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group"><label>Nombre del color:</label><input type="text" id="colorName" value="${escapeHtml(color.name)}" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></div>
                    <div class="form-group"><label>NK:</label><input type="text" id="colorNK" value="${escapeHtml(color.nk)}" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></div>
                    <div class="channel-group">
                        <div><div class="channel-label">C (Cian)</div><input type="number" id="cmykC" value="${color.cmyk.c}" min="0" max="100" step="1" class="dev-input-number" style="width:100%;"></div>
                        <div><div class="channel-label">M (Magenta)</div><input type="number" id="cmykM" value="${color.cmyk.m}" min="0" max="100" step="1" class="dev-input-number" style="width:100%;"></div>
                        <div><div class="channel-label">Y (Yellow)</div><input type="number" id="cmykY" value="${color.cmyk.y}" min="0" max="100" step="1" class="dev-input-number" style="width:100%;"></div>
                        <div><div class="channel-label">K (Black)</div><input type="number" id="cmykK" value="${color.cmyk.k}" min="0" max="100" step="1" class="dev-input-number" style="width:100%;"></div>
                    </div>
                    <div class="channel-group">
                        <div><div class="channel-label">TQ (Turquoise)</div><input type="number" id="channelTQ" value="${color.channels?.tq || 0}" min="0" max="100" step="1" class="dev-input-number" style="width:100%;"></div>
                        <div><div class="channel-label">O (Orange)</div><input type="number" id="channelO" value="${color.channels?.o || 0}" min="0" max="100" step="1" class="dev-input-number" style="width:100%;"></div>
                        <div><div class="channel-label">FY (Fl. Yellow)</div><input type="number" id="channelFY" value="${color.channels?.fy || 0}" min="0" max="100" step="1" class="dev-input-number" style="width:100%;"></div>
                        <div><div class="channel-label">FP (Fl. Pink)</div><input type="number" id="channelFP" value="${color.channels?.fp || 0}" min="0" max="100" step="1" class="dev-input-number" style="width:100%;"></div>
                    </div>
                    <div class="form-group">
                        <label>Buscar grupo (escribe para filtrar):</label>
                        <input type="text" id="groupSearch" value="${currentGroup ? `${currentGroup.id} - ${currentGroup.name}` : ''}" placeholder="Escribe ID o nombre del color..." autocomplete="off" class="group-filter-input">
                        <div id="filteredGroupsContainer" class="groups-list-container"></div>
                        <input type="hidden" id="selectedGroup" value="${escapeHtml(color.group)}">
                        <small style="color:#6b7280; display:block; margin-top:0.25rem;">💡 Escribe para filtrar. Haz clic en el grupo deseado para seleccionarlo.</small>
                    </div>
                    <div class="form-group"><label>Motivo del cambio:</label><textarea id="observation" rows="3" class="observation-textarea" placeholder="Motivo de la modificación..."></textarea></div>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-secondary cancel-modal" style="padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer;">Cancelar</button>
                    <button class="btn btn-primary confirm-modal" style="padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; background: #b45309; color: white; border: none;">💾 Guardar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => { modal.classList.remove('active'); setTimeout(() => modal.remove(), 300); };
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.cancel-modal').onclick = closeModal;
        
        const searchInput = modal.querySelector('#groupSearch');
        const hiddenInput = modal.querySelector('#selectedGroup');
        
        searchInput.addEventListener('input', (e) => renderFilteredGroups(e.target.value));
        renderFilteredGroups('');
        
        modal.querySelector('.confirm-modal').onclick = () => {
            const name = modal.querySelector('#colorName').value.trim();
            const nk = modal.querySelector('#colorNK').value.trim();
            const selectedGroup = hiddenInput.value;
            const observation = modal.querySelector('#observation').value.trim();
            const c = parseInt(modal.querySelector('#cmykC').value) || 0;
            const m = parseInt(modal.querySelector('#cmykM').value) || 0;
            const y = parseInt(modal.querySelector('#cmykY').value) || 0;
            const k = parseInt(modal.querySelector('#cmykK').value) || 0;
            const tq = parseInt(modal.querySelector('#channelTQ').value) || 0;
            const o = parseInt(modal.querySelector('#channelO').value) || 0;
            const fy = parseInt(modal.querySelector('#channelFY').value) || 0;
            const fp = parseInt(modal.querySelector('#channelFP').value) || 0;
            if (!name) { alert('⚠️ Debe ingresar el nombre del color.'); return; }
            if (!nk) { alert('⚠️ Debe ingresar el NK.'); return; }
            if (!selectedGroup) { alert('⚠️ Debe seleccionar un grupo.'); return; }
            if (!observation) { alert('⚠️ Debe ingresar un motivo para la modificación.'); return; }
            color.name = name;
            color.nk = nk;
            color.group = selectedGroup;
            color.cmyk = { c, m, y, k };
            color.channels = { tq, o, fy, fp };
            color.modified_at = new Date().toISOString();
            this.saveToLocalStorage();
            this.renderPendingColors();
            this.addHistoryEntry('EDIT_PENDING', `Color "${name}" modificado (Grupo: ${selectedGroup})`, observation);
            closeModal();
        };
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    }
    
    showApproveModal(color) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '10001';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 450px;">
                <div class="modal-header" style="background: #15803d;">
                    <h3 style="color: white;">✅ Aprobar color: ${escapeHtml(color.name)}</h3>
                    <button class="modal-close" style="color: white; background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                <div class="modal-body">
                    <p><strong>Color:</strong> ${escapeHtml(color.name)}</p>
                    <p><strong>NK:</strong> ${color.nk}</p>
                    <p><strong>Grupo:</strong> ${color.group}</p>
                    <p><strong>CMYK:</strong> C:${color.cmyk.c}% M:${color.cmyk.m}% Y:${color.cmyk.y}% K:${color.cmyk.k}%</p>
                    ${color.channels ? `<p><strong>Canales especiales:</strong> TQ:${color.channels.tq}% O:${color.channels.o}% FY:${color.channels.fy}% FP:${color.channels.fp}%</p>` : ''}
                    <div class="form-group" style="margin-top: 1rem;">
                        <label>Motivo de aprobación:</label>
                        <textarea id="approveReason" rows="2" class="observation-textarea" placeholder="Motivo para aprobar este color..."></textarea>
                    </div>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-secondary cancel-modal" style="padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer;">Cancelar</button>
                    <button class="btn btn-primary confirm-modal" style="padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; background: #15803d; color: white; border: none;">✅ Aprobar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.cancel-modal');
        const confirmBtn = modal.querySelector('.confirm-modal');
        const reasonTextarea = modal.querySelector('#approveReason');
        
        closeBtn.onclick = closeModal;
        cancelBtn.onclick = closeModal;
        
        confirmBtn.onclick = () => {
            const reason = reasonTextarea.value.trim();
            if (!reason) {
                alert('⚠️ El motivo es obligatorio.');
                return;
            }
            
            color.approved = true;
            this.saveToLocalStorage();
            this.syncToEquivalencyRows();
            this.renderPendingColors();
            this.renderGroups();
            
            this.addHistoryEntry('APPROVE_COLOR', `Color "${color.name}" aprobado al grupo "${color.group}"`, reason);
            alert(`✅ "${color.name}" aprobado correctamente.`);
            
            closeModal();
        };
        
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeModal();
            }
        };
    }
    
    showDeletePendingModal(color) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '10001';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 450px;">
                <div class="modal-header" style="background: #991b1b;">
                    <h3 style="color: white;">🗑️ Eliminar color: ${escapeHtml(color.name)}</h3>
                    <button class="modal-close" style="color: white; background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                <div class="modal-body">
                    <p><strong>Color:</strong> ${escapeHtml(color.name)}</p>
                    <p><strong>NK:</strong> ${color.nk}</p>
                    <p><strong>Grupo:</strong> ${color.group}</p>
                    <div class="form-group" style="margin-top: 1rem;"><label>Motivo de eliminación:</label><textarea id="deleteReason" rows="2" class="observation-textarea" placeholder="Motivo para eliminar este color..."></textarea></div>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-secondary cancel-modal" style="padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer;">Cancelar</button>
                    <button class="btn btn-primary confirm-modal" style="padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; background: #991b1b; color: white; border: none;">🗑️ Eliminar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };
        
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.cancel-modal');
        const confirmBtn = modal.querySelector('.confirm-modal');
        const reasonTextarea = modal.querySelector('#deleteReason');
        
        closeBtn.onclick = closeModal;
        cancelBtn.onclick = closeModal;
        
        confirmBtn.onclick = () => {
            const reason = reasonTextarea.value.trim();
            if (!reason) {
                alert('⚠️ El motivo es obligatorio.');
                return;
            }
            
            this.colors = this.colors.filter(c => c.id !== color.id);
            this.saveToLocalStorage();
            this.renderPendingColors();
            this.addHistoryEntry('DELETE_PENDING', `Color "${color.name}" eliminado`, reason);
            alert(`✅ "${color.name}" eliminado.`);
            
            closeModal();
        };
        
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeModal();
            }
        };
    }
    
    syncToEquivalencyRows() {
        const approvedGroups = new Map();
        for (const color of this.colors) {
            if (color.approved) {
                if (!approvedGroups.has(color.group)) {
                    approvedGroups.set(color.group, []);
                }
                if (!approvedGroups.get(color.group).includes(color.name)) {
                    approvedGroups.get(color.group).push(color.name);
                }
            }
        }
        
        const newEquivalencyRows = [];
        for (const [groupName, colors] of approvedGroups) {
            if (colors.length > 0) {
                newEquivalencyRows.push([groupName, ...colors]);
            }
        }
        
        if (window.EQUIVALENCY_ROWS) {
            window.EQUIVALENCY_ROWS.length = 0;
            for (const row of newEquivalencyRows) {
                window.EQUIVALENCY_ROWS.push(row);
            }
        }
        
        localStorage.setItem('alphaColorMatchEquivalencyRows', JSON.stringify(newEquivalencyRows));
        
        if (this.app) {
            if (typeof this.app.buildEquivalenceMap === 'function') {
                this.app.equivalenceMap = this.app.buildEquivalenceMap();
            }
            if (typeof this.app.buildAllValidColorNames === 'function') {
                this.app.buildAllValidColorNames();
            }
        }
        
        this.renderGroups();
        
        if (this.app && this.app.creatorView && typeof this.app.creatorView.renderTable === 'function') {
            this.app.creatorView.renderTable();
        }
        
        console.log('✅ Tabla de equivalencias actualizada:', newEquivalencyRows.length, 'grupos');
    }
    
    showAddGroupModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '10001';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 450px;">
                <div class="modal-header" style="background: #15803d;">
                    <h3 style="color: white;">➕ Crear nuevo grupo</h3>
                    <button class="modal-close" style="color: white; background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group"><label>ID del grupo:</label><input type="text" id="groupId" placeholder="Ej: NEON1" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"><small style="color:#6b7280;">ID único para identificar el grupo</small></div>
                    <div class="form-group"><label>Color principal:</label><input type="text" id="mainColor" placeholder="Ej: NEON GREEN" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></div>
                    <div class="form-group"><label>Colores equivalentes (uno por línea):</label><textarea id="equivalentColors" rows="4" placeholder="Ej: NEON YELLOW&#10;NEON PINK&#10;NEON ORANGE" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></textarea></div>
                    <div class="form-group"><label>Motivo:</label><textarea id="reason" rows="2" class="observation-textarea" placeholder="Motivo para crear este grupo..."></textarea></div>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-secondary cancel-modal" style="padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer;">Cancelar</button>
                    <button class="btn btn-primary confirm-modal" style="padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; background: #15803d; color: white; border: none;">➕ Crear</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => { modal.classList.remove('active'); setTimeout(() => modal.remove(), 300); };
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.cancel-modal').onclick = closeModal;
        
        modal.querySelector('.confirm-modal').onclick = () => {
            const groupId = modal.querySelector('#groupId').value.trim().toUpperCase();
            const mainColor = modal.querySelector('#mainColor').value.trim();
            const equivalentText = modal.querySelector('#equivalentColors').value;
            const reason = modal.querySelector('#reason').value.trim();
            if (!groupId) { alert('⚠️ Debe ingresar un ID para el grupo.'); return; }
            if (!mainColor) { alert('⚠️ Debe ingresar un color principal.'); return; }
            if (!reason) { alert('⚠️ El motivo es obligatorio.'); return; }
            const equivalents = equivalentText.split(/\r?\n/).filter(c => c.trim() !== '');
            
            if (!window.EQUIVALENCY_ROWS) window.EQUIVALENCY_ROWS = [];
            window.EQUIVALENCY_ROWS.push([groupId, mainColor, ...equivalents]);
            localStorage.setItem('alphaColorMatchEquivalencyRows', JSON.stringify(window.EQUIVALENCY_ROWS));
            
            if (this.app) {
                this.app.equivalencyRows = window.EQUIVALENCY_ROWS;
                if (typeof this.app.buildEquivalenceMap === 'function') {
                    this.app.equivalenceMap = this.app.buildEquivalenceMap();
                }
                if (typeof this.app.buildAllValidColorNames === 'function') {
                    this.app.buildAllValidColorNames();
                }
            }
            
            this.renderGroups();
            this.addHistoryEntry('CREATE_GROUP', `Grupo "${groupId}" creado con ${equivalents.length + 1} colores`, reason);
            alert(`✅ Grupo "${groupId}" creado correctamente.`);
            closeModal();
        };
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    }
    
    showRenameGroupModal(oldId) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '10001';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 450px;">
                <div class="modal-header" style="background: #b45309;">
                    <h3 style="color: white;">✏️ Renombrar grupo: ${escapeHtml(oldId)}</h3>
                    <button class="modal-close" style="color: white; background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group"><label>Nuevo ID del grupo:</label><input type="text" id="newGroupId" value="${escapeHtml(oldId)}" placeholder="Ej: NUEVO_ID" style="width:100%; padding:0.5rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;"></div>
                    <div class="form-group"><label>Motivo:</label><textarea id="reason" rows="2" class="observation-textarea" placeholder="Motivo para renombrar el grupo..."></textarea></div>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-secondary cancel-modal" style="padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer;">Cancelar</button>
                    <button class="btn btn-primary confirm-modal" style="padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; background: #b45309; color: white; border: none;">💾 Renombrar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => { modal.classList.remove('active'); setTimeout(() => modal.remove(), 300); };
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.cancel-modal').onclick = closeModal;
        
        modal.querySelector('.confirm-modal').onclick = () => {
            const newId = modal.querySelector('#newGroupId').value.trim().toUpperCase();
            const reason = modal.querySelector('#reason').value.trim();
            if (!newId) { alert('⚠️ Debe ingresar un nuevo ID.'); return; }
            if (!reason) { alert('⚠️ El motivo es obligatorio.'); return; }
            
            const equivalencyRows = window.EQUIVALENCY_ROWS || [];
            const rowIndex = equivalencyRows.findIndex(row => row[0] === oldId);
            if (rowIndex !== -1) {
                equivalencyRows[rowIndex][0] = newId;
                localStorage.setItem('alphaColorMatchEquivalencyRows', JSON.stringify(equivalencyRows));
            }
            
            if (this.app && this.app.equivalencyRows) {
                const appRowIndex = this.app.equivalencyRows.findIndex(row => row[0] === oldId);
                if (appRowIndex !== -1) {
                    this.app.equivalencyRows[appRowIndex][0] = newId;
                }
                if (typeof this.app.buildEquivalenceMap === 'function') {
                    this.app.equivalenceMap = this.app.buildEquivalenceMap();
                }
                if (typeof this.app.buildAllValidColorNames === 'function') {
                    this.app.buildAllValidColorNames();
                }
            }
            
            for (const color of this.colors) if (color.group === oldId) color.group = newId;
            this.saveToLocalStorage();
            this.renderGroups();
            this.renderPendingColors();
            this.addHistoryEntry('RENAME_GROUP', `Grupo "${oldId}" renombrado a "${newId}"`, reason);
            alert(`✅ Grupo renombrado a "${newId}".`);
            closeModal();
        };
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    }
    
    showDeleteGroupModal(groupId) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '10001';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 450px;">
                <div class="modal-header" style="background: #991b1b;">
                    <h3 style="color: white;">🗑️ Eliminar grupo: ${escapeHtml(groupId)}</h3>
                    <button class="modal-close" style="color: white; background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                <div class="modal-body">
                    <p><strong>Grupo:</strong> ${escapeHtml(groupId)}</p>
                    <p>Esta acción eliminará el grupo de la tabla de equivalencias.</p>
                    <div class="form-group" style="margin-top: 1rem;"><label>Motivo:</label><textarea id="reason" rows="2" class="observation-textarea" placeholder="Motivo para eliminar el grupo..."></textarea></div>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-secondary cancel-modal" style="padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer;">Cancelar</button>
                    <button class="btn btn-primary confirm-modal" style="padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; background: #991b1b; color: white; border: none;">🗑️ Eliminar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => { modal.classList.remove('active'); setTimeout(() => modal.remove(), 300); };
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.cancel-modal').onclick = closeModal;
        
        modal.querySelector('.confirm-modal').onclick = () => {
            const reason = modal.querySelector('#reason').value.trim();
            if (!reason) { alert('⚠️ El motivo es obligatorio.'); return; }
            
            const equivalencyRows = window.EQUIVALENCY_ROWS || [];
            const rowIndex = equivalencyRows.findIndex(row => row[0] === groupId);
            if (rowIndex !== -1) {
                equivalencyRows.splice(rowIndex, 1);
                localStorage.setItem('alphaColorMatchEquivalencyRows', JSON.stringify(equivalencyRows));
            }
            
            if (this.app && this.app.equivalencyRows) {
                const appRowIndex = this.app.equivalencyRows.findIndex(row => row[0] === groupId);
                if (appRowIndex !== -1) {
                    this.app.equivalencyRows.splice(appRowIndex, 1);
                }
                if (typeof this.app.buildEquivalenceMap === 'function') {
                    this.app.equivalenceMap = this.app.buildEquivalenceMap();
                }
                if (typeof this.app.buildAllValidColorNames === 'function') {
                    this.app.buildAllValidColorNames();
                }
            }
            
            this.renderGroups();
            this.addHistoryEntry('DELETE_GROUP', `Grupo "${groupId}" eliminado`, reason);
            alert(`✅ Grupo "${groupId}" eliminado.`);
            closeModal();
        };
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    }
    
    showRemoveColorModal(groupId, colorName) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '10001';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 450px;">
                <div class="modal-header" style="background: #991b1b;">
                    <h3 style="color: white;">🗑️ Eliminar color del grupo</h3>
                    <button class="modal-close" style="color: white; background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                <div class="modal-body">
                    <p><strong>Grupo:</strong> ${escapeHtml(groupId)}</p>
                    <p><strong>Color:</strong> ${escapeHtml(colorName)}</p>
                    <div class="form-group" style="margin-top: 1rem;"><label>Motivo:</label><textarea id="reason" rows="2" class="observation-textarea" placeholder="Motivo para eliminar este color..."></textarea></div>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-secondary cancel-modal" style="padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer;">Cancelar</button>
                    <button class="btn btn-primary confirm-modal" style="padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; background: #991b1b; color: white; border: none;">🗑️ Eliminar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const closeModal = () => { modal.classList.remove('active'); setTimeout(() => modal.remove(), 300); };
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.cancel-modal').onclick = closeModal;
        
        modal.querySelector('.confirm-modal').onclick = () => {
            const reason = modal.querySelector('#reason').value.trim();
            if (!reason) { alert('⚠️ El motivo es obligatorio.'); return; }
            
            const equivalencyRows = window.EQUIVALENCY_ROWS || [];
            const rowIndex = equivalencyRows.findIndex(row => row[0] === groupId);
            if (rowIndex !== -1) {
                const colorIndex = equivalencyRows[rowIndex].indexOf(colorName);
                if (colorIndex !== -1) {
                    equivalencyRows[rowIndex].splice(colorIndex, 1);
                    if (equivalencyRows[rowIndex].length === 1) {
                        equivalencyRows.splice(rowIndex, 1);
                    }
                    localStorage.setItem('alphaColorMatchEquivalencyRows', JSON.stringify(equivalencyRows));
                }
            }
            
            if (this.app && this.app.equivalencyRows) {
                const appRowIndex = this.app.equivalencyRows.findIndex(row => row[0] === groupId);
                if (appRowIndex !== -1) {
                    const appColorIndex = this.app.equivalencyRows[appRowIndex].indexOf(colorName);
                    if (appColorIndex !== -1) {
                        this.app.equivalencyRows[appRowIndex].splice(appColorIndex, 1);
                        if (this.app.equivalencyRows[appRowIndex].length === 1) {
                            this.app.equivalencyRows.splice(appRowIndex, 1);
                        }
                    }
                }
                if (typeof this.app.buildEquivalenceMap === 'function') {
                    this.app.equivalenceMap = this.app.buildEquivalenceMap();
                }
                if (typeof this.app.buildAllValidColorNames === 'function') {
                    this.app.buildAllValidColorNames();
                }
            }
            
            this.renderGroups();
            this.addHistoryEntry('REMOVE_FROM_GROUP', `Color "${colorName}" eliminado del grupo "${groupId}"`, reason);
            alert(`✅ Color eliminado.`);
            closeModal();
        };
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    }
    
    exportTable() {
        const groups = this.getAllGroups();
        if (groups.size === 0) { alert('No hay datos para exportar.'); return; }
        let csvContent = 'ID_Grupo,Colores_Equivalentes\n';
        for (const [groupId, colors] of groups) csvContent += `"${groupId}","${colors.join('|')}"\n`;
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `grupos_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        alert('✅ Tabla exportada correctamente.');
    }
    
    importTable() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = async (event) => {
                const content = event.target.result;
                const lines = content.split(/\r?\n/);
                if (lines.length <= 1) return;

                const newNks = new Set();
                const groupsToUpdate = new Map(); // GroupID -> Set of ColorNames

                // Formato esperado: NK, NombreColor, GrupoID (opcional)
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;
                    
                    // Manejo básico de CSV (separado por comas)
                    const parts = line.split(',').map(p => p.replace(/^"|"$/g, '').trim().toUpperCase());
                    if (parts.length < 2) continue;

                    const nk = parts[0];
                    const colorName = parts[1];
                    const groupId = parts[2] || nk; // Si no hay grupo, el NK es el grupo

                    newNks.add(nk);
                    if (!groupsToUpdate.has(groupId)) groupsToUpdate.set(groupId, new Set());
                    groupsToUpdate.get(groupId).add(colorName);
                }

                if (newNks.size === 0) {
                    alert('No se encontraron datos válidos en el archivo.');
                    return;
                }

                // 1. Sincronizar NKs con la tabla maestra
                const currentUser = this.app?.auth?.getCurrentUser()?.username || 'sistema';
                let nksAdded = 0;
                for (const nk of newNks) {
                    const res = await addMasterNk(nk, currentUser);
                    if (res.success) nksAdded++;
                }

                // 2. Sincronizar Grupos de Equivalencia
                const equivalencyRows = window.EQUIVALENCY_ROWS || [];
                let groupsCreated = 0;
                let colorsAdded = 0;

                for (const [groupId, colorNames] of groupsToUpdate) {
                    let rowIndex = equivalencyRows.findIndex(r => r[0] === groupId);
                    
                    if (rowIndex === -1) {
                        // Crear grupo nuevo
                        equivalencyRows.push([groupId, ...Array.from(colorNames)]);
                        groupsCreated++;
                        colorsAdded += colorNames.size;
                    } else {
                        // Actualizar grupo existente (evitar duplicados)
                        const existingColors = new Set(equivalencyRows[rowIndex].slice(1));
                        let addedToGroup = 0;
                        for (const name of colorNames) {
                            if (!existingColors.has(name)) {
                                equivalencyRows[rowIndex].push(name);
                                addedToGroup++;
                                colorsAdded++;
                            }
                        }
                    }
                }

                // Guardar cambios
                window.EQUIVALENCY_ROWS = equivalencyRows;
                localStorage.setItem('alphaColorMatchEquivalencyRows', JSON.stringify(window.EQUIVALENCY_ROWS));
                
                if (this.app) {
                    this.app.equivalencyRows = window.EQUIVALENCY_ROWS;
                    if (typeof this.app.buildEquivalenceMap === 'function') {
                        this.app.equivalenceMap = this.app.buildEquivalenceMap();
                    }
                }

                this.renderGroups();
                this.addHistoryEntry('SMART_IMPORT', `Sincronizados ${newNks.size} NKs y ${groupsToUpdate.size} grupos.`, `Importación masiva: ${colorsAdded} colores procesados.`);
                
                alert(`✅ Sincronización Completa:\n- NKs registrados/validados: ${newNks.size}\n- Grupos nuevos/actualizados: ${groupsToUpdate.size}\n- Colores añadidos: ${colorsAdded}`);
            };
            reader.readAsText(file);
        };
        input.click();
    }
    
    showHistoryModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px; max-height: 85vh;">
                <div class="modal-header" style="background: #2d4ed6;">
                    <h3 style="color: white;"><i class="fas fa-history"></i> Historial de cambios</h3>
                    <button class="modal-close" style="color: white; background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                <div class="modal-body" style="overflow: auto; max-height: 65vh;">
                    <input type="text" id="historySearch" placeholder="🔍 Buscar..." style="width:100%; padding:0.5rem; margin-bottom:1rem; background:#1e1e2c; border:1px solid #4b5563; border-radius:0.4rem; color:white;">
                    <div id="historyList"></div>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-secondary close-modal">Cerrar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        const renderHistory = (search = '') => {
            const filtered = this.history.filter(h => h.user.includes(search) || h.action.includes(search) || h.details.includes(search) || (h.reason && h.reason.includes(search)));
            const historyList = modal.querySelector('#historyList');
            historyList.innerHTML = filtered.map(h => `<div style="border-bottom:1px solid #2d3748; padding:0.5rem;"><div><strong>${new Date(h.timestamp).toLocaleString()}</strong> - ${h.user}</div><div><span style="color:#00e5ff;">${h.action}</span>: ${h.details}</div>${h.reason ? `<div style="color:#fbbf24; font-size:0.7rem;">📝 ${h.reason}</div>` : ''}</div>`).join('');
            if (filtered.length === 0) historyList.innerHTML = '<div class="empty-state" style="text-align:center; padding:2rem;">No hay registros</div>';
        };
        
        modal.querySelector('#historySearch').addEventListener('input', (e) => renderHistory(e.target.value));
        renderHistory();
        
        const closeModal = () => { modal.classList.remove('active'); setTimeout(() => modal.remove(), 300); };
        modal.querySelector('.modal-close').onclick = closeModal;
        modal.querySelector('.close-modal').onclick = closeModal;
    }
}