// js/core/auth.js - VERSIÓN TABLA SIMPLE CON CRUD COMPLETO
import { supabase, getUserByUsername, getAllUsers, createUserInDB, updateUserInDB, deleteUserFromDB } from './supabaseClient.js';

export const PERMISSIONS = {
    COMPARATOR: 'comparator',
    HISTORY: 'history',
    PALETTE_VALIDATOR: 'paletteValidator',
    DEVELOPMENT: 'development',
    ASSIGNMENT: 'assignment',
    REPORTS: 'reports',
    DASHBOARD: 'dashboard',
    BACKUP: 'backup',
    ADMIN: 'admin',
    LINEARIZATION: 'linearization'
};

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export class Auth {
    constructor() {
        this.currentUser = null;
    }
    
    async login(username, password) {
        try {
            console.log('🔍 Buscando usuario:', username);
            
            const user = await getUserByUsername(username);
            
            if (!user) {
                return { success: false, error: '❌ Usuario o contraseña incorrectos' };
            }
            
            if (user.password !== password) {
                return { success: false, error: '❌ Usuario o contraseña incorrectos' };
            }
            
            this.currentUser = {
                id: user.id,
                username: user.username,
                isMaster: user.is_master || false,
                permissions: user.permisos || []
            };
            
            localStorage.setItem('alphaColorMatchCurrentUser', JSON.stringify(this.currentUser));
            
            return { success: true, user: this.currentUser };
            
        } catch (error) {
            console.error('Error en login:', error);
            return { success: false, error: '❌ Error al iniciar sesión' };
        }
    }
    
    logout() {
        this.currentUser = null;
        localStorage.removeItem('alphaColorMatchCurrentUser');
        window.location.href = 'login.html';
    }
    
    loadSession() {
        const saved = localStorage.getItem('alphaColorMatchCurrentUser');
        if (saved) {
            try {
                this.currentUser = JSON.parse(saved);
                console.log('🔄 Sesión cargada:', this.currentUser.username);
                return true;
            } catch(e) {
                return false;
            }
        }
        return false;
    }
    
    hasPermission(permission) {
        if (!this.currentUser) return false;
        if (this.currentUser.isMaster) return true;
        return this.currentUser.permissions?.includes(permission) || false;
    }
    
    getCurrentUser() {
        return this.currentUser;
    }
    
    isMaster() {
        return this.currentUser?.isMaster === true;
    }
    
    // ============================================
    // CRUD COMPLETO PARA TABLA SIMPLE
    // ============================================
    
    async getAllUsers() {
        return await getAllUsers();
    }
    
    async getUserById(id) {
        const { data, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        
        if (error) return null;
        return data;
    }
    
    async createUser(username, password, permissions, isMaster = false) {
        // Validar que no exista
        const existing = await getUserByUsername(username);
        if (existing) {
            return { success: false, error: '❌ El nombre de usuario ya existe' };
        }
        
        // Validar contraseña
        if (!password || password.length < 6) {
            return { success: false, error: '❌ La contraseña debe tener al menos 6 caracteres' };
        }
        
        return await createUserInDB(username, password, permissions, isMaster);
    }
    
    async updateUser(userId, updates) {
        // No permitir editar al MASTER si no eres MASTER
        const userToUpdate = await this.getUserById(userId);
        if (userToUpdate?.is_master && !this.currentUser?.isMaster) {
            return { success: false, error: '❌ No puedes modificar al usuario MASTER' };
        }
        
        // No permitir eliminarse a sí mismo
        if (this.currentUser?.id === userId && updates.isMaster === false) {
            return { success: false, error: '❌ No puedes desactivar tus propios privilegios MASTER' };
        }
        
        return await updateUserInDB(userId, updates);
    }
    
    async deleteUser(userId) {
        // No permitir eliminar al MASTER
        const userToDelete = await this.getUserById(userId);
        if (userToDelete?.is_master) {
            return { success: false, error: '❌ No puedes eliminar al usuario MASTER' };
        }
        
        // No permitir eliminarse a sí mismo
        if (this.currentUser?.id === userId) {
            return { success: false, error: '❌ No puedes eliminar tu propio usuario' };
        }
        
        return await deleteUserFromDB(userId);
    }
}