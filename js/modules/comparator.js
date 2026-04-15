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

export function compareFiles(primaryData, secondaryData) {
    const primaryByNK = new Map();
    const secondaryByNK = new Map();
    
    for (const color of primaryData) {
        const nk = getNK(color);
        if (nk) {
            if (!primaryByNK.has(nk)) primaryByNK.set(nk, []);
            primaryByNK.get(nk).push(color);
        }
    }
    
    for (const color of secondaryData) {
        const nk = getNK(color);
        if (nk) {
            if (!secondaryByNK.has(nk)) secondaryByNK.set(nk, []);
            secondaryByNK.get(nk).push(color);
        }
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
        
        for (const pc of primaryColors) {
            const eqGroup = getAllEquivalentNames(pc.baseName);
            const groupKey = eqGroup[0];
            if (!groups.has(groupKey)) groups.set(groupKey, { primarios: [], secundarios: [], groupKey });
            groups.get(groupKey).primarios.push(pc);
        }
        
        for (const sc of secondaryColors) {
            const eqGroup = getAllEquivalentNames(sc.baseName);
            const groupKey = eqGroup[0];
            if (!groups.has(groupKey)) groups.set(groupKey, { primarios: [], secundarios: [], groupKey });
            groups.get(groupKey).secundarios.push(sc);
        }
        
        for (const [groupKey, group] of groups) {
            const { primarios, secundarios } = group;
            const groupId = `group_${nk}_${groupCounter++}`;
            const groupDisplayId = getGroupIdForColor(groupKey);
            
            if (primarios.length && secundarios.length) {
                for (const primary of primarios) {
                    for (const secondary of secundarios) {
                        const isExact = primary.baseName === secondary.baseName;
                        results.push({
                            id: `primary_${primary.tempId || primary.id || Math.random()}`,
                            groupId,
                            groupDisplayId,
                            groupKey,
                            nk,
                            primaryData: { ...primary },
                            secondaryData: { ...secondary },
                            matchType: isExact ? 'exact' : 'equivalent',
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
                            groupKey,
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
                            groupKey,
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
    
    results.sort((a, b) => {
        const gc = (a.groupKey || '').localeCompare(b.groupKey || '');
        if (gc !== 0) return gc;
        const nc = a.nk.localeCompare(b.nk);
        if (nc !== 0) return nc;
        return (a.primaryData?.name || a.secondaryData?.name || '').localeCompare(b.primaryData?.name || b.secondaryData?.name || '');
    });
    
    return results;
}