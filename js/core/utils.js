// js/core/utils.js
export function normalizeSpaces(str) {
    if (!str) return '';
    return str.trim().replace(/\s+/g, ' ');
}

export function extractNK(fullName) {
    if (!fullName) return null;
    const normalized = normalizeSpaces(fullName).toUpperCase();
    
    // 1. Prioridad ABSOLUTA: Buscar NKs conocidos de la base de datos
    // Ordenamos por longitud descendente para no confundir NK675 con NK675426
    const masterNks = (window.ALL_MASTER_NKS || []).map(n => n.toUpperCase()).sort((a, b) => b.length - a.length);
    for (const master of masterNks) {
        if (normalized.includes(master)) {
            return master;
        }
    }

    // 2. Fallback: Buscar patrón NK...
    const nkMatch = normalized.match(/NK[A-Z0-9\-]+/i);
    if (nkMatch) return nkMatch[0].toUpperCase();
    
    // 3. Fallback Agresivo: Última palabra con números
    const words = normalized.split(/\s+/);
    for (let i = words.length - 1; i >= 0; i--) {
        const word = words[i];
        if (/[0-9]/.test(word) && word.length >= 4) return word.toUpperCase();
    }
    
    return null;
}

export function extractBaseName(fullName) {
    if (!fullName) return '';
    const normalized = normalizeSpaces(fullName).toUpperCase();
    
    // 1. Quitar el NK si existe (aunque esté pegado al nombre)
    const nk = extractNK(fullName);
    let base = normalized;
    if (nk) {
        // Usamos un reemplazo global sin límites de palabra para despegarlo
        base = normalized.replace(new RegExp(nk, 'gi'), '').trim();
    }

    // 2. NO quitar prefijos técnicos (2DH, TM, etc.) - Son parte del nombre oficial
    
    // 3. Quitar paréntesis (1), (2), etc.
    base = base.replace(/\s*\([^)]*\)/g, '').trim();
    
    return normalizeSpaces(base);
}

export function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function showNotification(title, message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'floating-notification';
    notification.innerHTML = `<div class="notification-content ${type}"><strong>${title}</strong><br><span>${message}</span></div>`;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 2500);
}

export function validateAndFixCmykValue(value) {
    const str = String(value).trim();
    if (str === '') return 0;
    
    // El usuario requiere ENTEROS 0-100
    let intNum = parseInt(str, 10);
    if (isNaN(intNum)) intNum = 0;
    if (intNum > 100) intNum = 100;
    if (intNum < 0) intNum = 0;
    
    return intNum; // Retornar entero puro
}