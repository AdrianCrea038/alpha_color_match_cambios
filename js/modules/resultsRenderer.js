// js/modules/resultsRenderer.js
import { escapeHtml } from '../core/utils.js';

let currentResults = [];
let currentGroupSelections = new Map();
let currentSelectedPending = new Set();
let currentDeletedPending = new Set();
let showExact = true;
let showEquivalent = true;
let showPendingPrimary = true;
let showPendingSecondary = true;
let showAdded = true;
let showDeleted = true;

export function renderResults(results, groupSelections, selectedPending, deletedPending) {
    currentResults = results;
    currentGroupSelections = groupSelections;
    currentSelectedPending = selectedPending;
    currentDeletedPending = deletedPending;
    
    const panel = document.getElementById('resultsPanel');
    const tbody = document.getElementById('resultsTableBody');
    const statsContainer = document.getElementById('statsBadges');
    
    if (!panel || !tbody) return;
    panel.style.display = 'block';
    
    const exactMatches = results.filter(r => r.matchType === 'exact').length;
    const equivalentMatches = results.filter(r => r.matchType === 'equivalent').length;
    const pendingPrimary = results.filter(r => r.matchType === 'pending_primary').length;
    const pendingSecondary = results.filter(r => r.matchType === 'pending_secondary').length;
    const selectedCount = selectedPending.size;
    const deletedCount = deletedPending.size;
    
    statsContainer.innerHTML = `
        <span class="badge match" data-filter="exact" style="cursor:pointer; opacity: ${showExact ? '1' : '0.4'};">✅ Exactas: ${exactMatches}</span>
        <span class="badge secondary" data-filter="equivalent" style="cursor:pointer; opacity: ${showEquivalent ? '1' : '0.4'};">🔄 Equivalentes: ${equivalentMatches}</span>
        <span class="badge missing" data-filter="pendingPrimary" style="cursor:pointer; opacity: ${showPendingPrimary ? '1' : '0.4'};">❌ Pendientes Principal: ${pendingPrimary}</span>
        <span class="badge secondary" data-filter="pendingSecondary" style="cursor:pointer; opacity: ${showPendingSecondary ? '1' : '0.4'};">➕ Pendientes Secundario: ${pendingSecondary}</span>
        <span class="badge" style="background:#15803d; color:white; cursor:pointer;" data-filter="added">✓ Agregados: ${selectedCount}</span>
        <span class="badge" style="background:#991b1b; color:white; cursor:pointer;" data-filter="deleted">🗑️ Eliminados: ${deletedCount}</span>
        <span class="badge" style="background:#2d4ed6; color:white; cursor:pointer;" data-filter="reset">🔄 Mostrar todos</span>
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
            if (!isAdded && !isDeleted && !showPendingPrimary && !showPendingSecondary) return false;
        }
        
        return true;
    });
    
    if (filteredResults.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state" style="text-align: center; padding: 2rem;">
                    <div class="empty-icon">🔍</div>
                    <p>No hay resultados con los filtros actuales</p>
                    <p style="font-size: 0.7rem;">Haz clic en "Mostrar todos" para ver todos los resultados</p>
                </td>
            </tr>
        `;
        attachFilterEvents();
        return;
    }
    
    tbody.innerHTML = filteredResults.map(item => {
        const groupBadge = item.groupDisplayId ? `<span style="display:inline-block; background:rgba(0,229,255,0.2); color:#00e5ff; padding:0.1rem 0.4rem; border-radius:0.25rem; font-size:0.6rem; margin-right:0.5rem;">${escapeHtml(item.groupDisplayId)}</span>` : '';
        
        if (item.matchType === 'exact' || item.matchType === 'equivalent') {
            const currentSelection = groupSelections.get(item.groupId) || 'primary';
            const isManual = groupSelections.has(item.groupId);
            const isExact = item.matchType === 'exact';
            
            return `
                <tr style="background: ${isExact ? 'rgba(21,128,61,0.1)' : 'rgba(180,83,9,0.1)'}">
                    <td>${groupBadge}<strong>${escapeHtml(item.nk)}</strong></td>
                    <td>${escapeHtml(item.primaryData?.name || '—')}<br><span class="cmyk-small">C:${item.primaryData?.cmyk[0].toFixed(1)} M:${item.primaryData?.cmyk[1].toFixed(1)} Y:${item.primaryData?.cmyk[2].toFixed(1)} K:${item.primaryData?.cmyk[3].toFixed(1)}</span></td>
                    <td>${escapeHtml(item.secondaryData?.name || '—')}<br><span class="cmyk-small">C:${item.secondaryData?.cmyk[0].toFixed(1)} M:${item.secondaryData?.cmyk[1].toFixed(1)} Y:${item.secondaryData?.cmyk[2].toFixed(1)} K:${item.secondaryData?.cmyk[3].toFixed(1)}</span></td>
                    <td><span class="${isExact ? 'match-badge yes' : 'match-badge'}" style="${!isExact ? 'background:#b45309;' : ''}">${isExact ? '✅ COINCIDENCIA' : '🔄 EQUIVALENTE'}</span></td>
                    <td>
                        <div class="selection-buttons">
                            <button class="selection-btn ${currentSelection === 'primary' ? 'active-primary' : ''}" onclick="window.selectGroup('${item.groupId}', 'primary')">📁 Principal</button>
                            <button class="selection-btn ${currentSelection === 'secondary' ? 'active-secondary' : ''}" onclick="window.selectGroup('${item.groupId}', 'secondary')">🔄 Secundario</button>
                            ${isManual ? '<span class="manual-badge">🔒 Manual</span>' : ''}
                        </div>
                    </td>
                </tr>
            `;
        } else {
            const isAdded = selectedPending.has(item.id);
            const isDeleted = deletedPending.has(item.id);
            let statusText = '❌ PENDIENTE';
            let statusClass = 'match-badge no';
            let rowBg = 'rgba(153, 27, 27, 0.1)';
            
            if (isAdded) {
                statusText = '✓ AGREGADO';
                statusClass = 'match-badge yes';
                rowBg = 'rgba(21, 128, 61, 0.2)';
            } else if (isDeleted) {
                statusText = '🗑️ ELIMINADO';
                rowBg = 'rgba(153, 27, 27, 0.2)';
            }
            
            return `
                <tr style="background: ${rowBg}">
                    <td>${groupBadge}<strong>${escapeHtml(item.nk)}</strong></td>
                    <td>${item.primaryData ? escapeHtml(item.primaryData.name) : '—'}<br>${item.primaryData ? `<span class="cmyk-small">C:${item.primaryData.cmyk[0].toFixed(1)} M:${item.primaryData.cmyk[1].toFixed(1)} Y:${item.primaryData.cmyk[2].toFixed(1)} K:${item.primaryData.cmyk[3].toFixed(1)}</span>` : ''}</td>
                    <td>${item.secondaryData ? escapeHtml(item.secondaryData.name) : '—'}<br>${item.secondaryData ? `<span class="cmyk-small">C:${item.secondaryData.cmyk[0].toFixed(1)} M:${item.secondaryData.cmyk[1].toFixed(1)} Y:${item.secondaryData.cmyk[2].toFixed(1)} K:${item.secondaryData.cmyk[3].toFixed(1)}</span>` : ''}</td>
                    <td><span class="${statusClass}">${statusText}</span></td>
                    <td>
                        <div class="pending-buttons">
                            <button class="small-btn btn-success" onclick="window.togglePendingAdd('${item.id}')" ${isAdded ? 'disabled' : ''}>➕ Agregar</button>
                            <button class="small-btn btn-danger" onclick="window.togglePendingDelete('${item.id}')" ${isDeleted ? 'disabled' : ''}>🗑️ Eliminar</button>
                        </div>
                    </td>
                </tr>
            `;
        }
    }).join('');
    
    attachFilterEvents();
}

function attachFilterEvents() {
    const exactBtn = document.querySelector('[data-filter="exact"]');
    if (exactBtn) exactBtn.onclick = () => { showExact = !showExact; renderResults(currentResults, currentGroupSelections, currentSelectedPending, currentDeletedPending); };
    
    const equivalentBtn = document.querySelector('[data-filter="equivalent"]');
    if (equivalentBtn) equivalentBtn.onclick = () => { showEquivalent = !showEquivalent; renderResults(currentResults, currentGroupSelections, currentSelectedPending, currentDeletedPending); };
    
    const pendingPrimaryBtn = document.querySelector('[data-filter="pendingPrimary"]');
    if (pendingPrimaryBtn) pendingPrimaryBtn.onclick = () => { showPendingPrimary = !showPendingPrimary; renderResults(currentResults, currentGroupSelections, currentSelectedPending, currentDeletedPending); };
    
    const pendingSecondaryBtn = document.querySelector('[data-filter="pendingSecondary"]');
    if (pendingSecondaryBtn) pendingSecondaryBtn.onclick = () => { showPendingSecondary = !showPendingSecondary; renderResults(currentResults, currentGroupSelections, currentSelectedPending, currentDeletedPending); };
    
    const addedBtn = document.querySelector('[data-filter="added"]');
    if (addedBtn) addedBtn.onclick = () => { showAdded = !showAdded; renderResults(currentResults, currentGroupSelections, currentSelectedPending, currentDeletedPending); };
    
    const deletedBtn = document.querySelector('[data-filter="deleted"]');
    if (deletedBtn) deletedBtn.onclick = () => { showDeleted = !showDeleted; renderResults(currentResults, currentGroupSelections, currentSelectedPending, currentDeletedPending); };
    
    const resetBtn = document.querySelector('[data-filter="reset"]');
    if (resetBtn) resetBtn.onclick = () => {
        showExact = true; showEquivalent = true; showPendingPrimary = true;
        showPendingSecondary = true; showAdded = true; showDeleted = true;
        renderResults(currentResults, currentGroupSelections, currentSelectedPending, currentDeletedPending);
    };
}

export function resetFilters() {
    showExact = true; showEquivalent = true; showPendingPrimary = true;
    showPendingSecondary = true; showAdded = true; showDeleted = true;
    renderResults(currentResults, currentGroupSelections, currentSelectedPending, currentDeletedPending);
}