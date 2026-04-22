// js/modules/exporter.js
import { getAllEquivalentNames } from '../core/constants.js';
import { extractNK, extractBaseName } from '../core/utils.js';

function expandWithEquivalents(item, nk, baseName) {
    const equivalents = getAllEquivalentNames(baseName);
    const expanded = [];
    const nkStr = (nk || '').trim();
    
    for (const eqName of equivalents) {
        // Solo añadir el NK si existe, de lo contrario dejar el nombre limpio
        const finalName = nkStr ? `${eqName} ${nkStr}` : eqName;
        
        expanded.push({
            ...item,
            name: finalName,
            isEquivalent: eqName !== baseName
        });
    }
    return expanded;
}

export function buildExportItems(results, groupSelections, selectedPending, deletedPending, correctedPrimary, correctedSecondary) {
    const exportItems = [];
    const processedGroups = new Set();
    
    for (const item of results) {
        if (item.matchType === 'exact' || item.matchType === 'equivalent') {
            if (processedGroups.has(item.groupId)) continue;
            processedGroups.add(item.groupId);
            
            const selection = groupSelections.get(item.groupId) || 'primary';
            const sourceData = selection === 'primary' ? item.primaryData : item.secondaryData;
            
            if (sourceData) {
                const nk = sourceData.nk || extractNK(sourceData.name);
                const baseName = sourceData.baseName || extractBaseName(sourceData.name);
                exportItems.push({
                    name: sourceData.name,
                    cmyk: sourceData.cmyk,
                    lab: sourceData.lab,
                    nk: nk,
                    baseName: baseName
                });
            }
        }
        
        if (selectedPending.has(item.id)) {
            const sourceData = item.primaryData || item.secondaryData;
            if (sourceData) {
                const nk = sourceData.nk || extractNK(sourceData.name);
                const baseName = sourceData.baseName || extractBaseName(sourceData.name);
                exportItems.push({
                    name: sourceData.name,
                    cmyk: sourceData.cmyk,
                    lab: sourceData.lab,
                    nk: nk,
                    baseName: baseName
                });
            }
        }
    }
    
    const expandedItems = [];
    for (const item of exportItems) {
        const expanded = expandWithEquivalents(item, item.nk, item.baseName);
        expandedItems.push(...expanded);
    }
    
    const uniqueItems = [];
    const seenNames = new Set();
    for (const item of expandedItems) {
        if (!seenNames.has(item.name)) {
            seenNames.add(item.name);
            uniqueItems.push(item);
        }
    }
    
    return uniqueItems;
}

export function generateCGATSContent(exportItems) {
    const today = new Date();
    const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
    let content = 'CGATS.17\n';
    content += 'ORIGINATOR\t"ALPHA COLOR MATCH"\n';
    content += 'FILE_DESCRIPTOR\t""\n';
    content += `CREATED\t"${dateStr}"\n`;
    content += 'NUMBER_OF_FIELDS\t9\n';
    content += 'BEGIN_DATA_FORMAT\n';
    content += 'SAMPLE_ID SAMPLE_NAME CMYK_C CMYK_M CMYK_Y CMYK_K LAB_L LAB_A LAB_B\n';
    content += 'END_DATA_FORMAT\n';
    content += `NUMBER_OF_SETS\t${exportItems.length}\n`;
    content += 'BEGIN_DATA\n\n';
    
    exportItems.forEach((item, index) => {
        const counter = index + 1;
        content += `${counter} "${item.name}" `;
        content += `${item.cmyk[0].toFixed(6)} ${item.cmyk[1].toFixed(6)} `;
        content += `${item.cmyk[2].toFixed(6)} ${item.cmyk[3].toFixed(6)} `;
        content += `${item.lab[0].toFixed(6)} ${item.lab[1].toFixed(6)} ${item.lab[2].toFixed(6)}\n`;
    });
    
    content += '\nEND_DATA\n';
    return content;
}

export function exportResults(results, groupSelections, selectedPending, deletedPending, correctedPrimary, correctedSecondary) {
    const exportItems = buildExportItems(results, groupSelections, selectedPending, deletedPending, correctedPrimary, correctedSecondary);
    
    if (exportItems.length === 0) {
        alert('No hay datos para exportar.');
        return false;
    }
    
    const content = generateCGATSContent(exportItems);
    const fileNameInput = document.getElementById('exportFileName');
    let baseFileName = 'alpha_color_export';
    if (fileNameInput && fileNameInput.value.trim() !== '') {
        baseFileName = fileNameInput.value.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    }
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const fullFileName = `${baseFileName}_${timestamp}.txt`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fullFileName;
    a.click();
    URL.revokeObjectURL(url);
    
    alert(`✅ Exportado: ${exportItems.length} colores`);
    return true;
}