// js/core/supabaseClient.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://cdiwriptqmqnexxukqaf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vX6RQCfPpA14Pg9ZVgDrFg_l3jY7KVw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// FUNCIONES PARA TABLA SIMPLE "usuarios"
// ============================================

// Obtener usuario por username
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

// Obtener todos los usuarios
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

// Crear usuario
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

// Actualizar usuario
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

// Eliminar usuario
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

// ============================================
// FUNCIONES DE COMPATIBILIDAD
// ============================================

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