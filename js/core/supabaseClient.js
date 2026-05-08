// js/core/supabaseClient.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://cdiwriptqmqnexxukqaf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vX6RQCfPpA14Pg9ZVgDrFg_l3jY7KVw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// FUNCIONES PARA TABLA "usuarios"
// ============================================

export async function getUserByUsername(username) {
    const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('username', username)
        .maybeSingle();
    
    if (error) {
        console.error('Error en getUserByUsername:', error);
        return null;
    }
    return data;
}

export async function getAllUsers() {
    const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .order('username');
    
    if (error) {
        console.error('Error en getAllUsers:', error);
        return [];
    }
    return data;
}

export async function createUserInDB(username, password, permissions, isMaster = false) {
    const { data, error } = await supabase
        .from('usuarios')
        .insert([{
            username: username,
            password: password,
            is_master: isMaster,
            permisos: permissions
        }])
        .select();
    
    if (error) {
        console.error('Error en createUserInDB:', error);
        return { success: false, error: error.message };
    }
    
    return { success: true, user: data[0] };
}

export async function updateUserInDB(userId, updates) {
    const updateData = {};
    if (updates.username !== undefined) updateData.username = updates.username;
    if (updates.password !== undefined) updateData.password = updates.password;
    if (updates.permissions !== undefined) updateData.permisos = updates.permissions;
    if (updates.isMaster !== undefined) updateData.is_master = updates.isMaster;
    
    const { error } = await supabase
        .from('usuarios')
        .update(updateData)
        .eq('id', userId);
    
    if (error) {
        console.error('Error en updateUserInDB:', error);
        return { success: false, error: error.message };
    }
    
    return { success: true };
}

export async function deleteUserFromDB(userId) {
    const { error } = await supabase
        .from('usuarios')
        .delete()
        .eq('id', userId);
    
    if (error) {
        console.error('Error en deleteUserFromDB:', error);
        return { success: false, error: error.message };
    }
    
    return { success: true };
}

export async function getUserProfileByUsername(username) {
    return await getUserByUsername(username);
}

export async function getUserProfile(userId) {
    const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
    
    if (error) return null;
    return data;
}

// ============================================
// FUNCIONES PARA TABLA "library_txt"
// ============================================

// Generar ID alfanumérico: NK711075_P14_001
function generateTxtId(nk, plotter, version) {
    const versionStr = version.toString().padStart(3, '0');
    return `${nk}_P${plotter}_${versionStr}`;
}

// Obtener todas las versiones de un NK + Plotter
export async function getTxtVersions(nk, plotter) {
    if (!nk || !plotter || nk === 'undefined' || plotter === 'undefined') {
        console.warn('⚠️ Intento de consulta a library_txt con parámetros incompletos:', { nk, plotter });
        return [];
    }
    const { data, error } = await supabase
        .from('library_txt')
        .select('*')
        .eq('nk', nk)
        .eq('plotter', plotter)
        .order('version', { ascending: false });
    
    if (error) {
        console.error('Error en getTxtVersions:', error);
        return [];
    }
    return data;
}

// Obtener TODOS los TXTs activos del sistema (para catálogo maestro global)
export async function getAllActiveLibraryTxts() {
    const { data, error } = await supabase
        .from('library_txt')
        .select('*')
        .eq('activo', true);
    
    if (error) {
        console.error('Error en getAllActiveLibraryTxts:', error);
        return [];
    }
    return data || [];
}

// Obtener la versión activa de un NK + Plotter
export async function getActiveTxt(nk, plotter) {
    if (!nk || !plotter || nk === 'undefined' || plotter === 'undefined') {
        return null;
    }
    const { data, error } = await supabase
        .from('library_txt')
        .select('*')
        .eq('nk', nk)
        .eq('plotter', plotter)
        .eq('activo', true)
        .maybeSingle();
    
    if (error) {
        console.error('Error en getActiveTxt:', error);
        return null;
    }
    return data;
}

// Obtener todos los NK únicos (para la lista desplegable)
export async function getAllNks() {
    const { data, error } = await supabase
        .from('library_txt')
        .select('nk')
        .eq('activo', true);
    
    if (error) {
        console.error('Error en getAllNks:', error);
        return [];
    }
    
    const uniqueNks = [...new Set(data.map(item => item.nk))];
    return uniqueNks.sort();
}

// Crear nuevo TXT (versión 1 o nueva versión)
export async function createNewTxt(nk, plotter, contenido, nombreArchivo, usuarioCarga, motivo) {
    try {
        // Obtener versiones existentes
        const versions = await getTxtVersions(nk, plotter);
        let version = 1;
        
        if (versions.length > 0) {
            version = Math.max(...versions.map(v => v.version)) + 1;
        }
        
        const txtId = generateTxtId(nk, plotter, version);
        const coloresCount = countColorsInContent(contenido);
        
        // Desactivar versión anterior si existe
        if (versions.length > 0) {
            await supabase
                .from('library_txt')
                .update({ activo: false })
                .eq('nk', nk)
                .eq('plotter', plotter)
                .eq('activo', true);
        }
        
        // Insertar nueva versión
        const { data, error } = await supabase
            .from('library_txt')
            .insert([{
                id: txtId,
                nk: nk,
                plotter: plotter,
                version: version,
                activo: true,
                contenido: contenido,
                nombre_archivo: nombreArchivo,
                colores_count: coloresCount,
                usuario_carga: usuarioCarga,
                motivo: motivo,
                fecha_carga: new Date().toISOString()
            }])
            .select();
        
        if (error) throw error;
        
        return { success: true, data: data[0], isNewVersion: version > 1 };
        
    } catch (error) {
        console.error('Error en createNewTxt:', error);
        return { success: false, error: error.message };
    }
}

// Reemplazar TXT (crear nueva versión)
export async function replaceTxt(nk, plotter, contenido, nombreArchivo, usuarioCarga, motivo) {
    return await createNewTxt(nk, plotter, contenido, nombreArchivo, usuarioCarga, motivo);
}

// Obtener TXT por ID
export async function getTxtById(id) {
    const { data, error } = await supabase
        .from('library_txt')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    
    if (error) {
        console.error('Error en getTxtById:', error);
        return null;
    }
    return data;
}

// Contar colores en el contenido del TXT
function countColorsInContent(content) {
    const lines = content.split(/\r?\n/);
    let count = 0;
    let dataStarted = false;
    
    for (const line of lines) {
        if (line.trim() === 'BEGIN_DATA') {
            dataStarted = true;
            continue;
        }
        if (dataStarted && line.trim() === 'END_DATA') break;
        if (dataStarted && line.trim() && !line.startsWith('NUMBER_OF_SETS')) {
            const match = line.match(/^\d+\s+/);
            if (match) count++;
        }
    }
    return count;
}

// Extraer NK del contenido
export function extractNKFromContent(content) {
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        const match = line.match(/(NK\d+)/i);
        if (match) return match[1];
    }
    return 'NK000001';
}

// ============================================
// FUNCIONES PARA MASTER NKs
// ============================================

export async function getAllMasterNks() {
    try {
        const { data, error } = await supabase
            .from('master_nks')
            .select('nk_code')
            .order('nk_code', { ascending: true });
        if (error) throw error;
        return (data || []).map(item => item.nk_code);
    } catch (error) {
        console.warn('Error cargando master_nks:', error.message);
        return [];
    }
}

export async function addMasterNk(nkCode, user = 'sistema') {
    const code = (nkCode || '').trim().toUpperCase();
    if (!code) return { success: false, error: 'Código vacío' };
    try {
        const { error } = await supabase
            .from('master_nks')
            .upsert([{ nk_code: code, created_by: user }], { onConflict: 'nk_code' });
        if (error) throw error;
        return { success: true, code };
    } catch (error) {
        console.error('Error en addMasterNk:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// FUNCIONES PARA GRUPOS DE EQUIVALENCIA
// ============================================

export async function getEquivalencyGroupsFromDB() {
    try {
        console.log('📡 Consultando tabla maestra: equivalencias...');
        // Simplificamos la consulta para evitar problemas de formato
        const { data, error, status } = await supabase
            .from('equivalencias')
            .select();
        
        if (error) {
            console.error(`❌ Error en Supabase (Status ${status}):`, error);
            console.error('Mensaje:', error.message);
            console.error('Detalle:', error.details);
            console.error('Pista:', error.hint);
            return [];
        }
        
        if (!data) {
            console.warn('⚠️ La consulta devolvió "null" para la tabla equivalencias.');
            return [];
        }

        return await processGroupData(data);
    } catch (error) {
        console.error('❌ Error de red o ejecución:', error);
        return [];
    }
}

async function processGroupData(data) {
    if (!data || data.length === 0) return [];
    
    const result = [];
    data.forEach(item => {
        // Priorizar nk_code o nk (según la estructura de Supabase)
        const code = item.nk_code || item.nk || item.grupo_id || item.grupo || item.group_code || item.group_id || item.code || 'UNKNOWN';
        
        // Manejar el array 'colores'
        let names = [];
        if (item.colores) {
            if (Array.isArray(item.colores)) {
                names = item.colores.map(n => n.toString().trim().toUpperCase());
            } else if (typeof item.colores === 'string') {
                try {
                    // Si viene como string JSON '["A", "B"]'
                    const parsed = JSON.parse(item.colores);
                    if (Array.isArray(parsed)) {
                        names = parsed.map(n => n.toString().trim().toUpperCase());
                    } else {
                        names = [item.colores.trim().toUpperCase()];
                    }
                } catch (e) {
                    // Si viene como string separado por comas 'A, B'
                    names = item.colores.split(',').map(n => n.trim().toUpperCase());
                }
            }
        }
        
        // Si no se encontraron en 'colores', buscar en campos individuales
        if (names.length === 0) {
            const singleName = item.nombre || item.color_name || item.name || item.color || '';
            if (singleName) names = [singleName.toString().trim().toUpperCase()];
        }
        
        if (names.length > 0 && code !== 'UNKNOWN') {
            const cleanCode = code.toString().trim().toUpperCase();
            result.push([cleanCode, ...names]);
        }
    });

    // NUEVO: Cargar master_nks con sus respectivos IDs de grupo para validación cruzada
    try {
        const { data: nks } = await supabase.from('master_nks').select('nk_code');
        if (nks && nks.length > 0) {
            window.ALL_MASTER_NKS = nks.map(n => n.nk_code.toUpperCase());
            window.NK_TO_GROUP_MAP = new Map();
            const aggressiveNormalizeNK = (v) => String(v || '').replace(/^NK/i, '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
            
            nks.forEach(n => {
                const rawNk = String(n.nk_code || '').trim().toUpperCase();
                const rawGroup = String(n.group_id || n.grupo_id || '').trim().toUpperCase();
                
                if (rawNk && rawGroup) {
                    const cleanKey = aggressiveNormalizeNK(rawNk);
                    window.NK_TO_GROUP_MAP.set(cleanKey, rawGroup);
                }
            });
            console.log(`✅ Sincronizados ${nks.length} NKs maestros y sus mapeos de grupo.`);
        }
    } catch (e) {
        console.warn('No se pudo cargar mapeo de master_nks:', e);
    }

    console.log(`✅ Sincronizados ${result.length} grupos desde la base de datos.`);
    return result;
}

// ============================================
// AGREGAR NOMBRE A GRUPO DE EQUIVALENCIA
// ============================================

export async function addColorNameToGroup(groupNkCode, newColorName) {
    try {
        // 1. Obtener una fila para detectar el nombre de la columna de ID
        const { data: firstRow } = await supabase.from('equivalencias').select().limit(1).maybeSingle();
        if (!firstRow) return { success: false, error: 'No se pudo leer la estructura de la tabla.' };

        // Buscar cuál de estas columnas existe en la tabla
        const idColumn = ['nk', 'grupo_id', 'nk_code', 'group_id', 'code'].find(col => col in firstRow);
        if (!idColumn) return { success: false, error: 'No se encontró la columna de ID en la tabla equivalencias.' };

        console.log(`🔍 Usando columna "${idColumn}" para identificar el grupo.`);

        // 2. Obtener la fila actual del grupo usando la columna detectada
        const { data, error } = await supabase
            .from('equivalencias')
            .select()
            .eq(idColumn, groupNkCode.trim().toUpperCase())
            .maybeSingle();

        if (error) throw error;
        if (!data) return { success: false, error: `Grupo "${groupNkCode}" no encontrado.` };

        // 3. Obtener lista actual de colores
        let currentColors = [];
        if (Array.isArray(data.colores)) {
            currentColors = data.colores;
        } else if (typeof data.colores === 'string') {
            try { currentColors = JSON.parse(data.colores); } catch { currentColors = [data.colores]; }
        }

        const newName = newColorName.trim().toUpperCase();
        if (currentColors.map(c => c.toUpperCase()).includes(newName)) {
            return { success: false, error: `"${newName}" ya existe en este grupo.` };
        }

        // 4. Agregar el nuevo nombre
        const updatedColors = [...currentColors, newName];
        const { error: updateError } = await supabase
            .from('equivalencias')
            .update({ colores: updatedColors })
            .eq(idColumn, groupNkCode.trim().toUpperCase());

        if (updateError) throw updateError;
        return { success: true, updatedColors };

    } catch (err) {
        console.error('Error en addColorNameToGroup:', err);
        return { success: false, error: err.message };
    }
}

export async function createNewEquivalencyGroup(newGroupId, firstColorName) {
    try {
        // 1. Detectar columna de ID
        const { data: firstRow } = await supabase.from('equivalencias').select().limit(1).maybeSingle();
        const idColumn = ['nk', 'grupo_id', 'nk_code', 'group_id', 'code'].find(col => col && firstRow && col in firstRow) || 'nk';

        // 2. Verificar si ya existe
        const { data: existing } = await supabase
            .from('equivalencias')
            .select(idColumn)
            .eq(idColumn, newGroupId.trim().toUpperCase())
            .maybeSingle();

        if (existing) return { success: false, error: `El grupo "${newGroupId}" ya existe.` };

        // 3. Insertar nuevo grupo
        const { error } = await supabase
            .from('equivalencias')
            .insert([{
                [idColumn]: newGroupId.trim().toUpperCase(),
                colores: [firstColorName.trim().toUpperCase()]
            }]);

        if (error) throw error;
        return { success: true };

    } catch (err) {
        console.error('Error en createNewEquivalencyGroup:', err);
        return { success: false, error: err.message };
    }
}

/**
 * REEMPLAZO MASIVO: Borra todo de 'equivalencias' e inserta nuevos datos.
 * @param {Array} groups - Lista de { group_id, colores: [] }
 */
export async function replaceEquivalenciesTable(groups) {
    try {
        console.log(`🚀 Iniciando reemplazo masivo de EQUIVALENCIAS (${groups.length} registros)...`);
        
        // 1. Detectar columna de ID (nk, grupo_id, etc)
        const { data: firstRow } = await supabase.from('equivalencias').select().limit(1).maybeSingle();
        const idColumn = ['nk', 'grupo_id', 'nk_code', 'group_id', 'code'].find(col => col && firstRow && col in firstRow) || 'nk';

        // 2. BORRAR TODO (Usamos un filtro que siempre sea true, ej: neq id a -1)
        const { error: delError } = await supabase.from('equivalencias').delete().neq(idColumn, '___NONE___');
        if (delError) throw delError;

        // 3. INSERTAR EN LOTES (Supabase/PostgREST recomienda lotes de ~500-1000)
        const batchSize = 200;
        for (let i = 0; i < groups.length; i += batchSize) {
            const batch = groups.slice(i, i + batchSize).map(g => ({
                [idColumn]: g.group_id.toString().toUpperCase().trim(),
                colores: g.colores.map(c => c.toString().toUpperCase().trim())
            }));
            const { error: insError } = await supabase.from('equivalencias').insert(batch);
            if (insError) throw insError;
            console.log(`✅ Lote ${Math.floor(i/batchSize) + 1} insertado...`);
        }

        return { success: true };
    } catch (err) {
        console.error('Error en replaceEquivalenciesTable:', err);
        return { success: false, error: err.message };
    }
}

/**
 * REEMPLAZO MASIVO: Borra todo de 'master_nks' e inserta nuevos datos.
 * @param {Array} nks - Lista de strings o { nk_code, created_by }
 */
export async function replaceMasterNksTable(nks, user = 'admin') {
    try {
        console.log(`🚀 Iniciando reemplazo masivo de MASTER NKs (${nks.length} registros)...`);
        
        // 1. BORRAR TODO
        const { error: delError } = await supabase.from('master_nks').delete().neq('nk_code', '___NONE___');
        if (delError) throw delError;

        // 2. INSERTAR EN LOTES
        const batchSize = 500;
        for (let i = 0; i < nks.length; i += batchSize) {
            const batch = nks.slice(i, i + batchSize).map(nk => {
                const code = typeof nk === 'string' ? nk : (nk.nk_code || nk.nk);
                return { 
                    nk_code: code.toString().toUpperCase().trim(),
                    created_by: user 
                };
            });
            const { error: insError } = await supabase.from('master_nks').insert(batch);
            if (insError) throw insError;
            console.log(`✅ Lote ${Math.floor(i/batchSize) + 1} insertado...`);
        }

        return { success: true };
    } catch (err) {
        console.error('Error en replaceMasterNksTable:', err);
        return { success: false, error: err.message };
    }
}



