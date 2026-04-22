// js/modules/fileLoader.js
import { normalizeSpaces, extractNK, extractBaseName } from '../core/utils.js';
import { normalizeRecordsCmyk } from './cmykNormalizer.js';

export function parseTxtContent(content, keepDuplicates = false) {
    const lines = content.split(/\r?\n/);
    let dataStarted = false;
    const records = [];
    let tempCounter = 0;
    
    for (let line of lines) {
        if (line.trim() === '') continue;
        if (line.trim() === 'BEGIN_DATA') { dataStarted = true; continue; }
        if (dataStarted && line.trim() === 'END_DATA') break;
        if (!dataStarted) continue;
        
        const match = line.match(/^(\d+)\.?\s+(?:"([^"]+)"|([^\s]+(?:\s+[^\s]+)*?))\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)(?:\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+))?/);
        if (match) {
            let rawName = match[2] || match[3];
            if (rawName) {
                const normalizedName = normalizeSpaces(rawName);
                const nk = extractNK(normalizedName);
                const baseName = extractBaseName(normalizedName);
                const tempId = Date.now() + '_' + (++tempCounter);
                
                let lVal = 100, aVal = 0, bVal = 0;
                if (match[8] && match[9] && match[10]) {
                    lVal = parseFloat(match[8]); if (isNaN(lVal)) lVal = 100;
                    aVal = parseFloat(match[9]); if (isNaN(aVal)) aVal = 0;
                    bVal = parseFloat(match[10]); if (isNaN(bVal)) bVal = 0;
                }
                records.push({
                    tempId: tempId,
                    id: match[1],
                    name: normalizedName,
                    nk: nk,
                    baseName: baseName,
                    cmyk: [parseFloat(match[4]), parseFloat(match[5]), parseFloat(match[6]), parseFloat(match[7])],
                    lab: [lVal, aVal, bVal],
                    originalLine: line
                });
            }
        }
    }
    
    // Normalizar CMYK
    const { records: normalizedRecords, warnings } = normalizeRecordsCmyk(records);
    if (warnings.length > 0) console.warn('Advertencias de normalización CMYK:', warnings.length);

    if (keepDuplicates) return normalizedRecords;

    // Eliminar duplicados exactos para evitar líneas repetidas en comparación/exportación.
    const uniqueRecords = [];
    const seen = new Set();
    for (const record of normalizedRecords) {
        const cmykKey = (record.cmyk || []).map(v => Number(v).toFixed(6)).join('|');
        const labKey = (record.lab || []).map(v => Number(v).toFixed(6)).join('|');
        const signature = [
            normalizeSpaces(record.name || '').toUpperCase(),
            normalizeSpaces(record.baseName || '').toUpperCase(),
            (record.nk || '').toUpperCase(),
            cmykKey,
            labKey
        ].join('||');

        if (seen.has(signature)) continue;
        seen.add(signature);
        uniqueRecords.push(record);
    }

    return uniqueRecords;
}

export function loadFile(file, keepDuplicates = false) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject('No se seleccionó ningún archivo');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const records = parseTxtContent(e.target.result, keepDuplicates);
                console.log(`📁 Archivo "${file.name}" parseado: ${records.length} registros`);
                resolve({ records, fileName: file.name });
            } catch (error) {
                console.error('Error al parsear:', error);
                reject(error.message || 'Error al procesar el archivo');
            }
        };
        reader.onerror = () => reject('Error al leer el archivo');
        reader.readAsText(file, 'UTF-8');
    });
}