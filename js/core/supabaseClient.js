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

// Obtener la versión activa de un NK + Plotter
export async function getActiveTxt(nk, plotter) {
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
// FUNCIONES PARA NOMBRES VALIDOS DE COLORES
// ============================================

const COLOR_NAMES_TABLE = 'valid_color_names';

export async function getCustomValidColorNames() {
    try {
        const { data, error } = await supabase
            .from(COLOR_NAMES_TABLE)
            .select('name')
            .order('name', { ascending: true });

        if (error) {
            console.warn('No se pudieron cargar nombres personalizados desde Supabase:', error.message);
            return [];
        }

        return (data || [])
            .map(item => (item?.name || '').trim().toUpperCase())
            .filter(Boolean);
    } catch (error) {
        console.warn('Error en getCustomValidColorNames:', error.message);
        return [];
    }
}

export async function addCustomValidColorName(name, user = 'sistema') {
    const normalized = (name || '').trim().toUpperCase();
    if (!normalized) {
        return { success: false, error: 'Nombre vacío' };
    }

    try {
        const { data: existing, error: existingError } = await supabase
            .from(COLOR_NAMES_TABLE)
            .select('name')
            .eq('name', normalized)
            .maybeSingle();

        if (existingError) {
            console.error('Error verificando nombre existente:', existingError);
            return { success: false, error: existingError.message };
        }

        if (existing) {
            return { success: true, name: normalized, alreadyExists: true };
        }

        const { error } = await supabase
            .from(COLOR_NAMES_TABLE)
            .insert([{ name: normalized, created_by: user }]);

        if (error) {
            console.error('Error en addCustomValidColorName:', error);
            return { success: false, error: error.message };
        }

        return { success: true, name: normalized };
    } catch (error) {
        console.error('Error inesperado en addCustomValidColorName:', error);
        return { success: false, error: error.message };
    }
}

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
