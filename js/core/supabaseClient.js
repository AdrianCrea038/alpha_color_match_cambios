// js/core/supabaseClient.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// 🔴 REEMPLAZA con tus valores de Supabase (los encuentras en Project Settings → API)
const SUPABASE_URL = 'https://cdiwriptqmqnexxukqaf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vX6RQCfPpA14Pg9ZVgDrFg_l3jY7KVw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Obtener usuario actual
export async function getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) return null;
    return user;
}

// Obtener perfil de usuario por ID
export async function getUserProfile(userId) {
    const { data, error } = await supabase
        .from('perfiles_usuarios')
        .select('*')
        .eq('id', userId)
        .single();
    if (error) return null;
    return data;
}

// Obtener perfil por nombre de usuario (para login)
export async function getUserProfileByUsername(username) {
    const { data, error } = await supabase
        .from('perfiles_usuarios')
        .select('*')
        .eq('username', username)
        .single();
    if (error) return null;
    return data;
}

// Obtener todos los usuarios (solo para master)
export async function getAllUsers() {
    const { data, error } = await supabase
        .from('perfiles_usuarios')
        .select('*');
    if (error) return [];
    return data;
}

// Actualizar perfil de usuario
export async function updateUserProfile(userId, updates) {
    const { data, error } = await supabase
        .from('perfiles_usuarios')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
    if (error) return null;
    return data;
}

// Obtener todas las equivalencias
export async function getAllEquivalencias() {
    const { data, error } = await supabase
        .from('equivalencias')
        .select('*');
    if (error) return [];
    return data;
}