// js/modules/fileLoader.js
import { normalizeSpaces, extractNK, extractBaseName } from '../core/utils.js';
import { normalizeRecordsCmyk } from './cmykNormalizer.js';

export function parseTxtContent(content, keepDuplicates = false) {
    const lines = content.split(/\r?\n/);
    let dataStarted = false;
    
    // Verificación proactiva: Si el archivo NO tiene BEGIN_DATA pero tiene líneas que parecen datos (ID + Nombre + Números)
    // activamos dataStarted de inmediato para no perder información.
    const hasBeginData = content.includes('BEGIN_DATA');
    if (!hasBeginData) {
        dataStarted = true; 
    }

    const records = [];
    let tempCounter = 0;
    
    for (let line of lines) {
        const trimmed = line.trim();
        if (trimmed === '') continue;
        
        if (trimmed === 'BEGIN_DATA') { dataStarted = true; continue; }
        if (trimmed === 'END_DATA') break;
        
        if (!dataStarted) continue;
        
        // Ignorar otras cabeceras si estamos en modo auto-start
        if (!hasBeginData && (trimmed.includes('ORIGINATOR') || trimmed.includes('NUMBER_OF_FIELDS') || trimmed.includes('BEGIN_DATA_FORMAT'))) continue;

        // Intentar primero por Tabulación (Más preciso para nombres con números al inicio)
        let parts = line.split('\t');
        if (parts.length >= 7) {
            const id = parts[0].trim();
            const rawName = normalizeSpaces(parts[1]);
            const nk = extractNK(rawName);
            const baseName = extractBaseName(rawName);
            const tempId = Date.now() + '_' + (++tempCounter);

            // CMYK están en 2,3,4,5. LAB en 6,7,8 (opcional)
            const cmyk = [parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]), parseFloat(parts[5])];
            let lab = [100, 0, 0];
            if (parts[6] !== undefined && parts[7] !== undefined && parts[8] !== undefined) {
                lab = [parseFloat(parts[6]), parseFloat(parts[7]), parseFloat(parts[8])];
            }

            records.push({
                tempId, id, name: baseName, nk, baseName, cmyk, lab, originalLine: line
            });
            continue;
        }

        // 1. Intentar capturar por formato estándar con COMILLAS (El más seguro)
        // Ejemplo: 1 "00A BLACK NK675426" 89.0 13.0 ...
        const quoteMatch = line.match(/^(\d+)?(?:\.|\s+)*"([^"]+)"\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)(?:\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+))?/);
        
        let id, rawName, cmyk, lab, matchFound = false;

        if (quoteMatch) {
            id = quoteMatch[1] || "S/ID";
            rawName = quoteMatch[2];
            cmyk = [parseFloat(quoteMatch[3]), parseFloat(quoteMatch[4]), parseFloat(quoteMatch[5]), parseFloat(quoteMatch[6])];
            lab = [parseFloat(quoteMatch[7] || 100), parseFloat(quoteMatch[8] || 0), parseFloat(quoteMatch[9] || 0)];
            matchFound = true;
        } else {
            // 2. Fallback: Si no hay comillas, intentar por Tabulaciones
            const parts = line.split('\t');
            if (parts.length >= 6) {
                id = parts[0].trim();
                rawName = normalizeSpaces(parts[1]);
                cmyk = [parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]), parseFloat(parts[5])];
                lab = [parseFloat(parts[6] || 100), parseFloat(parts[7] || 0), parseFloat(parts[8] || 0)];
                matchFound = true;
            } else {
                // 3. Fallback final: Buscar el bloque de 4 números CMYK al final
                const words = line.trim().split(/\s+/);
                // Buscamos los últimos 4 o 7 números que corresponden a CMYK o CMYK+LAB
                let lastNumIdx = -1;
                for (let i = words.length - 1; i >= 0; i--) {
                    if (isNaN(parseFloat(words[i])) || !/^-?\d*\.?\d+$/.test(words[i])) {
                        lastNumIdx = i + 1;
                        break;
                    }
                }
                
                if (lastNumIdx > 0 && lastNumIdx < words.length) {
                    const nameParts = words.slice(0, lastNumIdx);
                    // Si el primer elemento es solo un número, es el ID
                    if (/^\d+$/.test(nameParts[0])) {
                        id = nameParts[0];
                        rawName = nameParts.slice(1).join(' ');
                    } else {
                        id = "S/ID";
                        rawName = nameParts.join(' ');
                    }
                    const dataParts = words.slice(lastNumIdx);
                    cmyk = dataParts.slice(0, 4).map(v => parseFloat(v));
                    lab = dataParts.slice(4, 7).map(v => parseFloat(v || 0));
                    if (lab.length < 3) lab = [100, 0, 0];
                    matchFound = true;
                }
            }
        }

        // Función interna para validar número estricto (evita letras y doble punto)
        const isStrictNumber = (val) => {
            if (typeof val !== 'string') return false;
            const trimmed = val.trim();
            // Permite opcionalmente un signo menos, dígitos y UN solo punto decimal
            return /^-?\d*(\.\d+)?$/.test(trimmed) && !isNaN(parseFloat(trimmed));
        };

        if (matchFound && rawName) {
            const normalizedName = normalizeSpaces(rawName);
            const tempId = Date.now() + '_' + (++tempCounter);
            
            // Separación estricta: El nombre es el nombre, el NK es el NK.
            const nk = extractNK(normalizedName);
            const baseName = extractBaseName(normalizedName);

            // Validar integridad de valores numéricos
            const cmykValid = cmyk.every(v => isStrictNumber(String(v)));
            const labValid = lab.every(v => isStrictNumber(String(v)));

            records.push({
                id: id,
                _uid: `file_${tempId}`,
                name: baseName, // <--- CAMBIO CRÍTICO: Usar siempre baseName
                baseName: baseName,
                nk: nk,
                cmyk: cmyk.map(v => isStrictNumber(String(v)) ? parseFloat(v) : NaN),
                lab: lab.map(v => isStrictNumber(String(v)) ? parseFloat(v) : NaN),
                isCorrupted: !cmykValid || !labValid
            });
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