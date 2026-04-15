// js/core/utils.js
export function normalizeSpaces(str) {
    if (!str) return '';
    return str.trim().replace(/\s+/g, ' ');
}

export function extractNK(fullName) {
    if (!fullName) return null;
    const match = fullName.match(/\s+([A-Z0-9\-]+)$/i);
    if (match && /^[A-Z0-9\-]{3,}$/i.test(match[1])) return match[1];
    const words = fullName.trim().split(/\s+/);
    return words.length > 0 ? words[words.length - 1] : null;
}

export function extractBaseName(fullName) {
    if (!fullName) return '';
    const nk = extractNK(fullName);
    if (!nk) return normalizeSpaces(fullName);
    const nkPattern = new RegExp(`\\s+${nk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const base = fullName.replace(nkPattern, '').trim();
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