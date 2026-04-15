// js/core/auth.js
export const PERMISSIONS = {
    COMPARATOR: 'comparator',
    HISTORY: 'history',
    CREATOR: 'creator',
    EPS: 'eps',
    DEVELOPMENT: 'development',
    ASSIGNMENT: 'assignment',
    REPORTS: 'reports',
    ADMIN: 'admin'
};

export const ALL_PERMISSIONS = [
    PERMISSIONS.COMPARATOR,
    PERMISSIONS.HISTORY,
    PERMISSIONS.CREATOR,
    PERMISSIONS.EPS,
    PERMISSIONS.DEVELOPMENT,
    PERMISSIONS.ASSIGNMENT,
    PERMISSIONS.REPORTS,
    PERMISSIONS.ADMIN
];

export class Auth {
    constructor() {
        this.currentUser = null;
        this.users = [];
        this.loadUsers();
        this.ensureMasterUser();
    }
    
    ensureMasterUser() {
        const masterExists = this.users.find(u => u.username === 'master');
        if (!masterExists) {
            console.log('👑 Creando usuario master...');
            this.users.push({
                id: Date.now(),
                username: 'master',
                password: 'Alpha2024!',
                isMaster: true,
                permissions: ALL_PERMISSIONS,
                createdAt: new Date().toISOString()
            });
            this.saveUsers();
            console.log('✅ Usuario master creado con contraseña: Alpha2024!');
        } else {
            console.log('✅ Usuario master ya existe');
        }
    }
    
    loadUsers() {
        const saved = localStorage.getItem('alphaColorMatchUsers');
        if (saved) {
            try {
                this.users = JSON.parse(saved);
                console.log(`📋 ${this.users.length} usuarios cargados`);
            } catch(e) {
                console.error('Error al cargar usuarios:', e);
                this.users = [];
            }
        } else {
            console.log('📋 No hay usuarios guardados, se crearán por defecto');
            this.users = [];
        }
    }
    
    saveUsers() {
        localStorage.setItem('alphaColorMatchUsers', JSON.stringify(this.users));
        console.log(`💾 ${this.users.length} usuarios guardados`);
    }
    
    login(username, password) {
        console.log(`🔐 Intentando login: ${username}`);
        
        this.ensureMasterUser();
        
        const user = this.users.find(u => u.username === username && u.password === password);
        
        if (user) {
            this.currentUser = { ...user };
            delete this.currentUser.password;
            
            localStorage.setItem('alphaColorMatchCurrentUser', JSON.stringify({
                ...this.currentUser,
                loginTimestamp: new Date().toISOString()
            }));
            
            console.log(`✅ Login exitoso: ${username}`);
            return { success: true, user: this.currentUser };
        }
        
        console.log(`❌ Login fallido: ${username}`);
        return { success: false, error: '❌ Usuario o contraseña incorrectos' };
    }
    
    logout() {
        this.currentUser = null;
        localStorage.removeItem('alphaColorMatchCurrentUser');
        console.log('👋 Sesión cerrada');
    }
    
    loadSession() {
        const saved = localStorage.getItem('alphaColorMatchCurrentUser');
        if (saved) {
            try {
                this.currentUser = JSON.parse(saved);
                console.log(`🔄 Sesión cargada para: ${this.currentUser.username}`);
                return true;
            } catch(e) { 
                console.error('Error al cargar sesión:', e);
                return false; 
            }
        }
        console.log('🔄 No hay sesión guardada');
        return false;
    }
    
    hasPermission(permission) {
        if (!this.currentUser) return false;
        if (this.currentUser.isMaster) return true;
        return this.currentUser.permissions?.includes(permission);
    }
    
    getCurrentUser() { return this.currentUser; }
    isMaster() { return this.currentUser?.isMaster === true; }
    
    getAllUsers() {
        return this.users.map(({ password, ...u }) => u);
    }
    
    getUser(username) {
        return this.users.find(u => u.username === username);
    }
    
    getUserById(id) {
        return this.users.find(u => u.id === id);
    }
    
    createUser(username, password, permissions, isMaster = false) {
        if (this.users.find(u => u.username === username)) {
            return { success: false, error: '❌ El usuario ya existe' };
        }
        if (!password || password.length < 6) {
            return { success: false, error: '❌ La contraseña debe tener al menos 6 caracteres' };
        }
        
        const newUser = { 
            id: Date.now(), 
            username, 
            password, 
            permissions: permissions || [], 
            isMaster, 
            createdAt: new Date().toISOString() 
        };
        
        this.users.push(newUser);
        this.saveUsers();
        return { success: true, user: newUser };
    }
    
    updateUser(userId, updates) {
        const index = this.users.findIndex(u => u.id === userId);
        if (index === -1) return { success: false, error: '❌ Usuario no encontrado' };
        
        if (this.users[index].isMaster && !updates.isMaster) {
            if (updates.permissions) {
                this.users[index].permissions = updates.permissions;
                this.saveUsers();
                return { success: true, user: this.users[index] };
            }
            return { success: false, error: '❌ No se puede modificar el usuario master' };
        }
        
        if (updates.password) this.users[index].password = updates.password;
        if (updates.permissions) this.users[index].permissions = updates.permissions;
        if (updates.isMaster !== undefined) this.users[index].isMaster = updates.isMaster;
        
        this.saveUsers();
        
        if (this.currentUser && this.currentUser.id === userId) {
            this.currentUser = { ...this.users[index] };
            delete this.currentUser.password;
            localStorage.setItem('alphaColorMatchCurrentUser', JSON.stringify(this.currentUser));
        }
        
        return { success: true, user: this.users[index] };
    }
    
    deleteUser(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return { success: false, error: '❌ Usuario no encontrado' };
        if (user.isMaster) return { success: false, error: '❌ No se puede eliminar al usuario master' };
        
        this.users = this.users.filter(u => u.id !== userId);
        this.saveUsers();
        return { success: true };
    }
    
    changePassword(oldPassword, newPassword) {
        if (!this.currentUser) {
            return { success: false, error: '❌ No hay sesión activa' };
        }
        
        const user = this.users.find(u => u.id === this.currentUser.id);
        if (!user) return { success: false, error: '❌ Usuario no encontrado' };
        
        if (user.password !== oldPassword) {
            return { success: false, error: '❌ Contraseña actual incorrecta' };
        }
        
        if (newPassword.length < 6) {
            return { success: false, error: '❌ La nueva contraseña debe tener al menos 6 caracteres' };
        }
        
        user.password = newPassword;
        this.saveUsers();
        
        this.currentUser = { ...user };
        delete this.currentUser.password;
        localStorage.setItem('alphaColorMatchCurrentUser', JSON.stringify(this.currentUser));
        
        return { success: true };
    }
}