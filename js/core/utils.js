// js/core/utils.js
export function normalizeSpaces(str) {
    if (!str) return '';
    return str.trim().replace(/\s+/g, ' ');
}

export function extractNK(fullName) {
    if (!fullName) return null;
    const normalized = normalizeSpaces(fullName).toUpperCase();
    
    // 1. ÚNICO CRITERIO: Buscar NKs que existen físicamente en la tabla maestra
    // Se ordena por longitud para evitar que un NK corto "robe" parte de uno largo
    const masterNks = (window.ALL_MASTER_NKS || []).map(n => n.toUpperCase()).sort((a, b) => b.length - a.length);
    
    for (const master of masterNks) {
        // Buscamos el NK como palabra completa o al final del string
        const regex = new RegExp(`\\b${master}\\b|${master}$`, 'i');
        if (regex.test(normalized)) {
            return master;
        }
    }

    // 2. Si no está en la tabla, buscamos si hay algo que parezca un NK al final (para marcar error)
    const words = normalized.split(/\s+/);
    const lastWord = words[words.length - 1];
    if (lastWord && (lastWord.startsWith('NK') || lastWord.startsWith('T') || /[0-9]/.test(lastWord))) {
        return lastWord; // Se devuelve para que isValidNK(lastWord) sea false y aparezca el error
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