// js/core/constants.js

// Ahora la fuente de verdad es la BASE DE DATOS (Supabase).
// Estas listas se mantienen vacías y se llenan dinámicamente al iniciar la app.

export let EQUIVALENCY_ROWS = [];

export let ALL_VALID_COLOR_NAMES = [];

export let EQUIVALENCE_MAP = new Map();

export let MAIN_COLOR_NAMES = [];

/**
 * Función crítica para actualizar el catálogo desde la base de datos
 * @param {Array} dbGroups - Datos provenientes de la tabla equivalency_groups
 */
export function updateConstantsFromDB(dbGroups) {
    EQUIVALENCY_ROWS = dbGroups || [];
    
    // Reconstruir ALL_VALID_COLOR_NAMES
    const names = [];
    for (const row of EQUIVALENCY_ROWS) {
        // row puede ser un objeto o un array según de donde venga
        const colorList = Array.isArray(row) ? row.slice(1) : (row.colores || []);
        for (const name of colorList) {
            if (name) names.push(name.toUpperCase());
        }
    }
    ALL_VALID_COLOR_NAMES = [...new Set(names)].sort();

    // Reconstruir EQUIVALENCE_MAP - Limpiar y rellenar para mantener referencia
    EQUIVALENCE_MAP.clear();
    for (const row of EQUIVALENCY_ROWS) {
        const groupId = Array.isArray(row) ? row[0] : (row.nk_code || row.nk);
        const namesInGroup = Array.isArray(row) ? row.slice(1).filter(n => n) : (row.colores || []);
        
        for (const name of namesInGroup) {
            if (!name) continue;
            // Normalización agresiva: remover todo excepto letras y números para match total
            const key = name.toString().toUpperCase().replace(/[^A-Z0-9]/gi, '');
            if (!EQUIVALENCE_MAP.has(key)) {
                EQUIVALENCE_MAP.set(key, { 
                    groupId, 
                    masterName: namesInGroup[0], 
                    names: [...namesInGroup] 
                });
            }
        }
    }

    // Reconstruir MAIN_COLOR_NAMES
    const mainNames = [];
    for (const row of EQUIVALENCY_ROWS) {
        const firstColor = Array.isArray(row) ? row[1] : (row.colores ? row.colores[0] : null);
        if (firstColor) mainNames.push(firstColor);
    }
    MAIN_COLOR_NAMES = mainNames.sort();
    
    window.EQUIVALENCE_MAP = EQUIVALENCE_MAP;
    window.EQUIVALENCY_ROWS = EQUIVALENCY_ROWS;
    window.ALL_VALID_COLOR_NAMES = ALL_VALID_COLOR_NAMES;
    
    console.log(`💎 Catálogo sincronizado: ${EQUIVALENCE_MAP.size} nombres indexados.`);
}

export function getAllEquivalentNames(baseName) {
    const key = (baseName || '').toString().toUpperCase().replace(/[^A-Z0-9]/gi, '');
    const equiv = EQUIVALENCE_MAP.get(key);
    return equiv ? [...equiv.names] : [baseName];
}

export function getGroupIdForColor(baseName) {
    const key = (baseName || '').toString().toUpperCase().replace(/[^A-Z0-9]/gi, '');
    const equiv = EQUIVALENCE_MAP.get(key);
    return equiv ? equiv.groupId : '';
}