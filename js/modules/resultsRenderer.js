// js/modules/resultsRenderer.js
import { escapeHtml } from '../core/utils.js';

export function renderResults(results, groupSelections, selectedPending, deletedPending) {
    const panel = document.getElementById('resultsPanel');
    const tbody = document.getElementById('resultsTableBody');
    const statsContainer = document.getElementById('statsBadges');
    
    if (!panel || !tbody) return;
    panel.style.display = 'block';
    
    const counts = {
        exact: results.filter(r => r.matchType === 'exact').length,
        equivalent: results.filter(r => r.matchType === 'equivalent').length,
        pendingPrimary: results.filter(r => r.matchType === 'pending_primary').length,
        pendingSecondary: results.filter(r => r.matchType === 'pending_secondary').length,
        added: selectedPending.size,
        deleted: deletedPending.size
    };

    const showExact = window.app.showExact !== undefined ? window.app.showExact : true;
    const showEquivalent = window.app.showEquivalent !== undefined ? window.app.showEquivalent : true;
    const showPendingPrimary = window.app.showPendingPrimary !== undefined ? window.app.showPendingPrimary : true;
    const showPendingSecondary = window.app.showPendingSecondary !== undefined ? window.app.showPendingSecondary : true;
    const showAdded = window.app.showAdded !== undefined ? window.app.showAdded : true;
    const showDeleted = window.app.showDeleted !== undefined ? window.app.showDeleted : true;

    statsContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1rem; width: 100%;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.8rem; color: #64748b; text-transform: uppercase; letter-spacing: 2px; font-weight: 800;">FILTRAR RESULTADOS:</span>
            </div>
            <div style="display: flex; gap: 0.8rem; flex-wrap: wrap;">
                <div class="badge premium-filter ${showExact ? 'active' : ''}" data-filter="exact">
                    <i class="fas fa-check-double"></i> Exactas: <strong>${counts.exact}</strong>
                </div>
                <div class="badge premium-filter ${showEquivalent ? 'active' : ''}" data-filter="equivalent">
                    <i class="fas fa-sync-alt"></i> Equivalentes: <strong>${counts.equivalent}</strong>
                </div>
                <div class="badge premium-filter ${showPendingPrimary ? 'active' : ''}" data-filter="pendingPrimary">
                    <i class="fas fa-database"></i> Solo Master: <strong>${counts.pendingPrimary}</strong>
                </div>
                <div class="badge premium-filter ${showPendingSecondary ? 'active' : ''}" data-filter="pendingSecondary">
                    <i class="fas fa-file-import"></i> Solo Sec: <strong>${counts.pendingSecondary}</strong>
                </div>
                <div class="badge premium-filter ${showAdded ? 'active' : ''}" data-filter="added">
                    <i class="fas fa-plus-circle"></i> Agregados: <strong>${counts.added}</strong>
                </div>
                <div class="badge premium-filter ${showDeleted ? 'active' : ''}" data-filter="deleted">
                    <i class="fas fa-trash-alt"></i> Quitados: <strong>${counts.deleted}</strong>
                </div>
                <div class="badge premium-filter" data-filter="reset" style="margin-left: auto; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; border: none;">
                    <i class="fas fa-eye"></i> Ver Todo
                </div>
            </div>
        </div>
    `;

    const filteredResults = results.filter(item => {
        if (item.matchType === 'exact' && !showExact) return false;
        if (item.matchType === 'equivalent' && !showEquivalent) return false;
        if (item.matchType === 'pending_primary' && !showPendingPrimary) return false;
        if (item.matchType === 'pending_secondary' && !showPendingSecondary) return false;
        if (item.matchType === 'pending_primary' || item.matchType === 'pending_secondary') {
            const isAdded = selectedPending.has(item.id);
            const isDeleted = deletedPending.has(item.id);
            if (isAdded && !showAdded) return false;
            if (isDeleted && !showDeleted) return false;
        }
        return true;
    });

    tbody.innerHTML = filteredResults.map(item => renderNormalRow(item, groupSelections, selectedPending, deletedPending)).join('');
    attachFilterEvents();
}

function cmykToRgb(cmyk) {
    if (!cmyk || cmyk.length < 4) return 'rgb(0,0,0)';
    const [c, m, y, k] = cmyk.map(v => Number(v) / 100);
    const r = 255 * (1 - c) * (1 - k);
    const g = 255 * (1 - m) * (1 - k);
    const b = 255 * (1 - y) * (1 - k);
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function cleanName(name, nk) {
    if (!name) return '---';
    let clean = name.trim();
    if (nk) clean = clean.replace(nk, '').replace(nk, '').trim();
    return clean;
}

function renderNormalRow(item, groupSelections, selectedPending, deletedPending) {
    const { primaryData: p, secondaryData: s, matchType, groupId, groupDisplayId } = item;
    const isAdded = selectedPending.has(item.id);
    const isDeleted = deletedPending.has(item.id);
    
    let rowClass = '';
    let statusLabel = '';
    let statusClass = '';
    let icon = '';

    if (matchType === 'exact') {
        rowClass = 'row-match-exact'; statusLabel = 'EXACTO'; statusClass = 'status-ok-premium'; icon = '<i class="fas fa-check-circle"></i>';
    } else if (matchType === 'equivalent') {
        rowClass = 'row-match-equivalent'; statusLabel = 'EQUIVALENTE'; statusClass = 'status-warn-premium'; icon = '<i class="fas fa-sync-alt"></i>';
    } else if (matchType === 'pending_primary') {
        rowClass = isDeleted ? 'row-deleted' : (isAdded ? 'row-added' : 'row-pending');
        statusLabel = isDeleted ? 'QUITADO' : (isAdded ? 'AGREGADO' : 'SOLO MASTER');
        statusClass = isDeleted ? 'status-err-premium' : (isAdded ? 'status-info-premium' : 'status-warn-premium');
        icon = isDeleted ? '<i class="fas fa-trash-alt"></i>' : '<i class="fas fa-database"></i>';
    } else if (matchType === 'pending_secondary') {
        rowClass = isAdded ? 'row-added' : (isDeleted ? 'row-deleted' : 'row-pending');
        statusLabel = isAdded ? 'AGREGADO' : (isDeleted ? 'QUITADO' : 'SOLO SEC');
        statusClass = isAdded ? 'status-info-premium' : 'status-err-premium';
        icon = isAdded ? '<i class="fas fa-plus-circle"></i>' : '<i class="fas fa-file-import"></i>';
    }

    const renderCell = (data) => {
        if (!data) return '<div class="empty-cell" style="color: #475569; font-style: italic;">--- Sin Datos ---</div>';
        const colorName = cleanName(data.name, data.nk);
        const rgb = cmykToRgb(data.cmyk);
        return `
            <div class="color-cell">
                <div class="nk-tag">${escapeHtml(data.nk || 'S/NK')}</div>
                <div class="name-text">${escapeHtml(colorName)}</div>
                <div class="cmyk-row">
                    <div class="color-swatch-premium" style="background: ${rgb};"></div>
                    [${data.cmyk.map(v => Number(v).toFixed(1)).join('/')}]
                </div>
            </div>
        `;
    };

    const pInfo = renderCell(p);
    const sInfo = renderCell(s);

    let actions = '';
    if (matchType === 'exact' || matchType === 'equivalent') {
        const selection = groupSelections.get(groupId) || 'primary';
        actions = `
            <div class="selection-buttons premium">
                <button class="selection-btn p-btn ${selection === 'primary' ? 'active' : ''}" onclick="window.app.selectGroup('${groupId}', 'primary')">Usar Principal</button>
                <button class="selection-btn s-btn ${selection === 'secondary' ? 'active' : ''}" onclick="window.app.selectGroup('${groupId}', 'secondary')">Usar Secundario</button>
            </div>
        `;
    } else {
        actions = `
            <div class="pending-buttons premium">
                <button class="action-btn add ${isAdded ? 'active' : ''}" onclick="window.app.togglePendingAdd('${item.id}')">
                    <i class="fas fa-plus"></i> ${isAdded ? 'Agregado' : 'Agregar'}
                </button>
                <button class="action-btn remove ${isDeleted ? 'active' : ''}" onclick="window.app.togglePendingDelete('${item.id}')">
                    <i class="fas fa-times"></i> ${isDeleted ? 'Quitado' : 'Quitar'}
                </button>
            </div>
        `;
    }

    return `
        <tr class="${rowClass}" data-id="${item.id}">
            <td>${pInfo}</td>
            <td>${sInfo}</td>
            <td style="text-align: center; vertical-align: middle;">
                <div class="status-premium ${statusClass}">
                    ${icon} ${statusLabel}
                </div>
                ${groupDisplayId ? `<div style="font-size: 0.65rem; color: #475569; margin-top: 6px; font-weight: 700;">GRUPO: ${groupDisplayId}</div>` : ''}
            </td>
            <td style="vertical-align: middle;">
                ${actions}
            </td>
        </tr>
    `;
}

function attachFilterEvents() {
    const filters = ['exact', 'equivalent', 'pendingPrimary', 'pendingSecondary', 'added', 'deleted', 'reset'];
    filters.forEach(f => {
        const btn = document.querySelector(`[data-filter="${f}"]`);
        if (!btn) return;
        btn.onclick = () => {
            if (f === 'reset') {
                window.app.showExact = true; window.app.showEquivalent = true; window.app.showPendingPrimary = true;
                window.app.showPendingSecondary = true; window.app.showAdded = true; window.app.showDeleted = true;
            } else {
                window.app.showExact = (f === 'exact'); window.app.showEquivalent = (f === 'equivalent');
                window.app.showPendingPrimary = (f === 'pendingPrimary'); window.app.showPendingSecondary = (f === 'pendingSecondary');
                window.app.showAdded = (f === 'added'); window.app.showDeleted = (f === 'deleted');
            }
            window.app.renderResults(); 
        };
    });
}