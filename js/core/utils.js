// js/core/utils.js
export function normalizeSpaces(str) {
    if (!str) return '';
    return str.trim().replace(/\s+/g, ' ');
}

/**
 * Extrae el código NK de un nombre completo únicamente si existe en el catálogo maestro.
 * CERO ADIVINANZAS: Si no está en la tabla, no se separa.
 */
export function extractNK(fullName) {
    if (!fullName) return '';
    const normalized = normalizeSpaces(fullName).toUpperCase();
    const masterNks = (window.ALL_MASTER_NKS || []).map(n => n.toUpperCase()).sort((a, b) => b.length - a.length);
    
    // 1. Prioridad Máxima: NKs que están al final del string
    for (const master of masterNks) {
        if (normalized.endsWith(master)) return master;
    }

    // 2. Segunda Prioridad: NKs que están en cualquier otra parte precedidos por espacio
    for (const master of masterNks) {
        if (normalized.includes(' ' + master)) return master;
    }

    // 3. Fallback: Detección por Patrón (Si no está en el catálogo, intentar detectar el código)
    // Busca patrones como NK001, NK-001, T123 al final o precedidos por espacio
    const patternMatch = normalized.match(/(?:\s+|^)(NK-?\d+|T\d+|[A-Z]{1,2}\d{3,8})(?:\s+|$)/i);
    if (patternMatch) {
        return patternMatch[1].trim().toUpperCase();
    }

    return '';
}

/**
 * Extrae el nombre base de un color eliminando ÚNICAMENTE el NK oficial detectado.
 * Si el nombre tiene otros códigos en medio, SE QUEDAN para que el validador lo marque como ERROR.
 */
export function extractBaseName(fullName) {
    if (!fullName) return '';
    let base = normalizeSpaces(fullName).toUpperCase();
    
    // 1. Quitar comillas al inicio y al final
    base = base.replace(/^["']|["']$/g, '').trim();

    const nk = extractNK(base);
    
    if (nk) {
        const escapedNk = nk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Quitar el NK si está al final o rodeado de espacios/comillas
        const regex = new RegExp(`\\s*${escapedNk}\\s*["']?\\s*$|\\s+${escapedNk}\\s+`, 'gi');
        base = base.replace(regex, ' ').trim();
    }

    // 2. Limpieza de espacios residuales
    base = base.trim();
    
    // 3. Limpieza final de comillas residuales
    base = base.replace(/["']/g, '').trim();

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
    let intNum = parseInt(str, 10);
    if (isNaN(intNum)) intNum = 0;
    if (intNum > 100) intNum = 100;
    if (intNum < 0) intNum = 0;
    return intNum;
}