// js/modules/cmykNormalizer.js

export function normalizeCmykValue(value, channel) {
    let str = String(value).trim();
    if (str === '') return '0.000000';
    
    // Corregir doble punto
    if (str.includes('..')) {
        str = str.replace(/\.+/g, '.');
        console.warn(`⚠️ ${channel}: doble punto corregido a "${str}"`);
    }
    
    // Corregir múltiples puntos
    const parts = str.split('.');
    if (parts.length > 2) {
        str = parts[0] + '.' + parts.slice(1).join('');
        console.warn(`⚠️ ${channel}: múltiples puntos corregido a "${str}"`);
    }
    
    // Si no tiene punto decimal
    if (!str.includes('.')) {
        let intNum = parseInt(str, 10);
        if (isNaN(intNum)) intNum = 0;
        
        // VALIDACIÓN: solo 100 puede tener 3 dígitos
        if (intNum > 100) {
            console.warn(`⚠️ ${channel}: valor ${intNum} > 100, limitado a 100`);
            intNum = 100;
        }
        
        if (intNum < 0) intNum = 0;
        const result = `${intNum}.000000`;
        if (str !== result) {
            console.warn(`⚠️ ${channel}: sin punto decimal, normalizado de "${str}" a "${result}"`);
        }
        return result;
    }
    
    // Tiene punto decimal
    const finalParts = str.split('.');
    let integerPart = finalParts[0];
    let decimalPart = finalParts[1];
    
    // Validar parte entera vacía
    if (integerPart === '' || integerPart === '-') {
        integerPart = '0';
        console.warn(`⚠️ ${channel}: parte entera vacía, usando 0`);
    }
    
    let intNum = parseInt(integerPart, 10);
    if (isNaN(intNum)) {
        intNum = 0;
        console.warn(`⚠️ ${channel}: parte entera no numérica, usando 0`);
    }
    
    // VALIDACIÓN: solo 100 puede tener 3 dígitos
    if (intNum > 100) {
        console.warn(`⚠️ ${channel}: valor ${intNum} > 100, limitado a 100`);
        intNum = 100;
    }
    
    if (intNum < 0) {
        intNum = 0;
        console.warn(`⚠️ ${channel}: valor negativo, limitado a 0`);
    }
    
    // Validar parte decimal
    if (decimalPart === undefined || decimalPart === '') {
        decimalPart = '000000';
        console.warn(`⚠️ ${channel}: sin decimales, usando 000000`);
    }
    
    // Truncar si tiene más de 6 decimales
    if (decimalPart.length > 6) {
        const originalDecimal = decimalPart;
        decimalPart = decimalPart.substring(0, 6);
        console.warn(`⚠️ ${channel}: más de 6 decimales (${originalDecimal.length}), truncado a "${decimalPart}"`);
    }
    
    // Rellenar si tiene menos de 6 decimales
    if (decimalPart.length < 6) {
        const originalDecimal = decimalPart;
        decimalPart = decimalPart.padEnd(6, '0');
        console.warn(`⚠️ ${channel}: menos de 6 decimales (${originalDecimal.length}), rellenado a "${decimalPart}"`);
    }
    
    // Limpiar decimales no numéricos
    if (!/^\d+$/.test(decimalPart)) {
        const originalDecimal = decimalPart;
        decimalPart = decimalPart.replace(/[^\d]/g, '').padEnd(6, '0').substring(0, 6);
        console.warn(`⚠️ ${channel}: decimales no numéricos "${originalDecimal}", corregido a "${decimalPart}"`);
    }
    
    return `${intNum}.${decimalPart}`;
}

export function normalizeRecordCmyk(record) {
    const originalCmyk = [...record.cmyk];
    const cNorm = normalizeCmykValue(record.cmyk[0], 'C');
    const mNorm = normalizeCmykValue(record.cmyk[1], 'M');
    const yNorm = normalizeCmykValue(record.cmyk[2], 'Y');
    const kNorm = normalizeCmykValue(record.cmyk[3], 'K');
    
    const normalizedCmyk = [parseFloat(cNorm), parseFloat(mNorm), parseFloat(yNorm), parseFloat(kNorm)];
    const wasNormalized = (cNorm !== String(originalCmyk[0]) || mNorm !== String(originalCmyk[1]) ||
                           yNorm !== String(originalCmyk[2]) || kNorm !== String(originalCmyk[3]));
    
    return { ...record, cmyk: normalizedCmyk, originalCmyk, wasNormalized };
}

export function normalizeRecordsCmyk(records) {
    const warnings = [];
    const normalized = records.map(record => {
        const result = normalizeRecordCmyk(record);
        if (result.wasNormalized) {
            warnings.push(`ID ${record.id}: CMYK normalizado de [${result.originalCmyk.join(', ')}] a [${result.cmyk.map(v => v.toFixed(6)).join(', ')}]`);
        }
        return result;
    });
    
    if (warnings.length > 0) {
        console.group('📊 Normalización CMYK');
        warnings.forEach(w => console.warn(w));
        console.groupEnd();
    }
    
    return { records: normalized, warnings };
}