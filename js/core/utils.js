// js/core/utils.js
export function normalizeSpaces(str) {
    if (!str) return '';
    return str.trim().replace(/\s+/g, ' ');
}

export function extractNK(fullName) {
    if (!fullName) return null;
    const normalized = normalizeSpaces(fullName);
    
    // 1. Intentar encontrar el nombre oficial más largo primero
    const validNames = window.ALL_VALID_COLOR_NAMES || [];
    const sortedNames = [...validNames].sort((a, b) => b.length - a.length);
    
    for (const officialName of sortedNames) {
        if (normalized.toUpperCase().startsWith(officialName.toUpperCase())) {
            const remaining = normalized.substring(officialName.length).trim();
            if (remaining) return remaining;
            return null;
        }
    }

    // 2. NUEVO: Intentar encontrar un código NK Maestro al final
    const masterNks = window.ALL_MASTER_NKS || [];
    const sortedMasterNks = [...masterNks].sort((a, b) => b.length - a.length);
    
    for (const masterNk of sortedMasterNks) {
        const pattern = new RegExp(`\\s+${masterNk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
        if (pattern.test(normalized)) {
            return masterNk;
        }
    }

    // 3. Fallback: Solo si parece un código alfanumérico real
    const match = normalized.match(/\s+([A-Z0-9\-]+)$/i);
    if (match) {
        const possibleNk = match[1];
        if (/[0-9]/.test(possibleNk) || /^(NK|T|RW|W|BG|WG)/i.test(possibleNk)) {
            return possibleNk;
        }
    }
    
    return null;
}

export function extractBaseName(fullName) {
    if (!fullName) return '';
    const normalized = normalizeSpaces(fullName);
    
    // 1. Intentar encontrar el nombre oficial más largo primero
    const validNames = window.ALL_VALID_COLOR_NAMES || [];
    const sortedNames = [...validNames].sort((a, b) => b.length - a.length);
    
    for (const officialName of sortedNames) {
        if (normalized.toUpperCase().startsWith(officialName.toUpperCase())) {
            return officialName; // Retornamos el nombre con la cápsula oficial
        }
    }

    // 2. Fallback: Lógica original por regex
    const nk = extractNK(normalized);
    if (!nk) return normalized;
    
    const nkPattern = new RegExp(`\\s+${nk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const base = normalized.replace(nkPattern, '').trim();
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
    let fixed = str.replace(/\.+/g, '.');
    const parts = fixed.split('.');
    let integerPart = parts[0];
    let decimalPart = parts[1] || '';
    let intNum = parseInt(integerPart, 10);
    if (isNaN(intNum)) intNum = 0;
    if (intNum > 100) intNum = 100;
    if (intNum < 0) intNum = 0;
    if (decimalPart.length > 6) {
        decimalPart = decimalPart.substring(0, 6);
    } else if (decimalPart.length < 6) {
        decimalPart = decimalPart.padEnd(6, '0');
    }
    return parseFloat(`${intNum}.${decimalPart}`);
}