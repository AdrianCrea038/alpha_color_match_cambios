// js/modules/comparator.js
import { getAllEquivalentNames, getGroupIdForColor } from '../core/constants.js';

function getNK(record) {
    return record.nk || (() => {
        const match = record.name.match(/\s+([A-Z0-9\-]+)$/i);
        if (match && /^[A-Z0-9\-]{3,}$/i.test(match[1])) return match[1];
        const words = record.name.trim().split(/\s+/);
        return words.length > 0 ? words[words.length - 1] : null;
    })();
}

export function compareFiles(primaryData, secondaryData, mode = 'fusion') {
    if (mode === 'ciclico') {
        return compareStrict(primaryData, secondaryData);
    }

    const primaryByNK = new Map();
    const secondaryByNK = new Map();
    
    // Agrupar por NK estricto (ya no usamos expresiones regulares invasivas, confiamos en la separación previa)
    for (const color of primaryData) {
        const nk = (color.nk || '').trim().toUpperCase() || 'S/N';
        if (!primaryByNK.has(nk)) primaryByNK.set(nk, []);
        primaryByNK.get(nk).push(color);
    }
    
    for (const color of secondaryData) {
        const nk = (color.nk || '').trim().toUpperCase() || 'S/N';
        if (!secondaryByNK.has(nk)) secondaryByNK.set(nk, []);
        secondaryByNK.get(nk).push(color);
    }
    
    const results = [];
    const processedPrimary = new Set();
    const processedSecondary = new Set();
    const allNKs = new Set([...primaryByNK.keys(), ...secondaryByNK.keys()]);
    let groupCounter = 0;
    
    for (const nk of allNKs) {
        const primaryColors = primaryByNK.get(nk) || [];
        const secondaryColors = secondaryByNK.get(nk) || [];
        const groups = new Map();
        
        // Emparejamos estrictamente por el Nombre Base Exacto (no por ID de familia ni CMYK)
        for (const pc of primaryColors) {
            const cleanName = String(pc.baseName || pc.name || '').trim().toUpperCase();
            if (!groups.has(cleanName)) groups.set(cleanName, { primarios: [], secundarios: [], nameKey: cleanName });
            groups.get(cleanName).primarios.push(pc);
        }
        
        for (const sc of secondaryColors) {
            const cleanName = String(sc.baseName || sc.name || '').trim().toUpperCase();
            if (!groups.has(cleanName)) groups.set(cleanName, { primarios: [], secundarios: [], nameKey: cleanName });
            groups.get(cleanName).secundarios.push(sc);
        }
        
        for (const [nameKey, group] of groups) {
            const { primarios, secundarios } = group;
            const groupId = `group_${nk}_${groupCounter++}`;
            
            // El ID solo se usa para visualización en UI, no para mezclar colores distintos
            const groupDisplayId = getGroupIdForColor(nameKey) || 'S/F';
            
            if (primarios.length && secundarios.length) {
                // Si ambos archivos tienen este mismo Nombre Exacto + NK
                for (const primary of primarios) {
                    for (const secondary of secundarios) {
                        results.push({
                            id: `primary_${primary.tempId || primary.id || Math.random()}`,
                            groupId,
                            groupDisplayId,
                            groupKey: nameKey, // El nombre exacto es la clave ahora
                            nk,
                            primaryData: { ...primary },
                            secondaryData: { ...secondary },
                            matchType: 'exact',
                            isPending: false
                        });
                        processedPrimary.add(primary.tempId || primary.id);
                        processedSecondary.add(secondary.tempId || secondary.id);
                    }
                }
            } else if (primarios.length) {
                for (const primary of primarios) {
                    if (!processedPrimary.has(primary.tempId || primary.id)) {
                        results.push({
                            id: `pending_primary_${primary.tempId || primary.id || Math.random()}`,
                            groupId: null,
                            groupDisplayId,
                            groupKey: nameKey,
                            nk,
                            primaryData: { ...primary },
                            secondaryData: null,
                            matchType: 'pending_primary',
                            isPending: true
                        });
                        processedPrimary.add(primary.tempId || primary.id);
                    }
                }
            } else if (secundarios.length) {
                for (const secondary of secundarios) {
                    if (!processedSecondary.has(secondary.tempId || secondary.id)) {
                        results.push({
                            id: `pending_secondary_${secondary.tempId || secondary.id || Math.random()}`,
                            groupId: null,
                            groupDisplayId,
                            groupKey: nameKey,
                            nk,
                            primaryData: null,
                            secondaryData: { ...secondary },
                            matchType: 'pending_secondary',
                            isPending: true
                        });
                        processedSecondary.add(secondary.tempId || secondary.id);
                    }
                }
            }
        }
    }
    
    // Ordenar alfabéticamente por Nombre y NK
    results.sort((a, b) => {
        const gc = (a.groupKey || '').localeCompare(b.groupKey || '');
        if (gc !== 0) return gc;
        const nc = (a.nk || '').localeCompare(b.nk || '');
        if (nc !== 0) return nc;
        return (a.primaryData?.name || a.secondaryData?.name || '').localeCompare(b.primaryData?.name || b.secondaryData?.name || '');
    });
    
    return results;
}

function compareValues(p, s) {
    const cmykMatch = (p.cmyk || []).every((v, idx) => Math.abs(v - ((s.cmyk || [])[idx] || 0)) < 0.0001);
    const labMatch = (p.lab || []).every((v, idx) => Math.abs(v - ((s.lab || [])[idx] || 0)) < 0.01);
    return (!cmykMatch || !labMatch) ? { cmyk: !cmykMatch, lab: !labMatch } : null;
}

export function compareStrict(masterData, secondaryData) {
    const results = [];
    const masterMap = new Map();
    const eqMap = window.EQUIVALENCE_MAP || new Map();

    // 1. Mapear Maestro por GrupoID | NK
    masterData.forEach(r => {
        const cleanName = (r.baseName || r.name || '').trim().toUpperCase().replace(/[^A-Z0-9]/gi, '');
        const gid = r.groupId || eqMap.get(cleanName)?.groupId || cleanName;
        const key = `${gid}|${(r.nk || '').trim().toUpperCase()}`;
        masterMap.set(key, r);
    });

    const matchedMasterKeys = new Set();

    // 2. Comparar Secundario contra Maestro por GrupoID | NK
    secondaryData.forEach(r => {
        const cleanName = (r.baseName || r.name || '').trim().toUpperCase().replace(/[^A-Z0-9]/gi, '');
        const gid = r.groupId || eqMap.get(cleanName)?.groupId || cleanName;
        const key = `${gid}|${(r.nk || '').trim().toUpperCase()}`;
        
        const masterItem = masterMap.get(key);

        if (masterItem) {
            const diff = compareValues(masterItem, r);
            const nameMismatch = masterItem.name.trim().toUpperCase() !== r.name.trim().toUpperCase();
            
            results.push({
                matchType: diff ? 'different' : (nameMismatch ? 'name_mismatch' : 'exact'),
                primaryData: masterItem,
                secondaryData: r,
                diff,
                diffName: nameMismatch
            });
            matchedMasterKeys.add(key);
        } else {
            results.push({
                matchType: 'additional_in_secondary',
                primaryData: null,
                secondaryData: r
            });
        }
    });

    // 3. Identificar lo que falta en el secundario
    masterData.forEach(r => {
        const cleanName = (r.baseName || r.name || '').trim().toUpperCase().replace(/[^A-Z0-9]/gi, '');
        const gid = r.groupId || eqMap.get(cleanName)?.groupId || cleanName;
        const key = `${gid}|${(r.nk || '').trim().toUpperCase()}`;
        
        if (!matchedMasterKeys.has(key)) {
            results.push({
                matchType: 'missing_in_secondary',
                primaryData: r,
                secondaryData: null
            });
        }
    });

    // Ordenar resultados: Errores primero
    return results.sort((a, b) => {
        const order = { 'different': 0, 'missing_in_secondary': 1, 'additional_in_secondary': 2, 'exact': 3 };
        return (order[a.matchType] ?? 99) - (order[b.matchType] ?? 99);
    });
}
