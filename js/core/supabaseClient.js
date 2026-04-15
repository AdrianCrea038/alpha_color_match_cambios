// js/core/supabaseClient.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// 🔴 AQUÍ VAN TUS CREDENCIALES REALES (las que copiaste de Supabase)
const SUPABASE_URL = 'https://78b04517a22246f7b816b413bc352c7a.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Obtener perfil por nombre de usuario
export async function getUserProfileByUsername(username) {
    const { data, error } = await supabase
        .from('perfiles_usuarios')
        .select('*')
        .eq('username', username)
        .single();
    if (error) return null;
    return data;
}

// Obtener usuario actual
export async function getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) return null;
    return user;
}

// Obtener perfil por ID
export async function getUserProfile(userId) {
    const { data, error } = await supabase
        .from('perfiles_usuarios')
        .select('*')
        .eq('id', userId)
        .single();
    if (error) return null;
    return data;
}