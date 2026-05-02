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
        for (let i = 1; i < row.length; i++) {
            names.push(row[i].toUpperCase());
        }
    }
    ALL_VALID_COLOR_NAMES = [...new Set(names)].sort();

    // Reconstruir EQUIVALENCE_MAP
    EQUIVALENCE_MAP = new Map();
    for (const row of EQUIVALENCY_ROWS) {
        const groupId = row[0];
        const namesInGroup = row.slice(1).filter(n => n && n.trim() !== '');
        for (const name of namesInGroup) {
            // Normalización agresiva: remover todo excepto letras y números para match total
            const key = name.toUpperCase().replace(/[^A-Z0-9]/gi, '');
            if (!EQUIVALENCE_MAP.has(key)) {
                EQUIVALENCE_MAP.set(key, { 
                    groupId, 
                    masterName: namesInGroup[0], // El primero es el oficial
                    names: [...namesInGroup] 
                });
            }
        }
    }

    // Reconstruir MAIN_COLOR_NAMES
    const mainNames = [];
    for (const row of EQUIVALENCY_ROWS) {
        if (row.length > 1) {
            mainNames.push(row[1]);
        }
    }
    MAIN_COLOR_NAMES = mainNames.sort();
    
    // Hacer disponible globalmente para todos los módulos (Evita problemas de caché de módulos)
    window.EQUIVALENCE_MAP = EQUIVALENCE_MAP;
    window.EQUIVALENCY_ROWS = EQUIVALENCY_ROWS;
    
    console.log('💎 Constantes del sistema actualizadas dinámicamente desde la base de datos.');
}

export function getAllEquivalentNames(baseName) {
    // Normalización idéntica a la usada al construir el EQUIVALENCE_MAP
    const key = (baseName || '').toUpperCase().replace(/[^A-Z0-9]/gi, '');
    const equiv = EQUIVALENCE_MAP.get(key);
    return equiv ? [...equiv.names] : [baseName];
}

export function getGroupIdForColor(baseName) {
    const key = (baseName || '').toUpperCase();
    const equiv = EQUIVALENCE_MAP.get(key);
    return equiv ? equiv.groupId : '';
}