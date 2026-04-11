// ============================================================
// AUTH - Gestión de autenticación y permisos
// ============================================================

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
    }
    
    loadUsers() {
        const saved = localStorage.getItem('alphaColorMatchUsers');
        if (saved) {
            try {
                this.users = JSON.parse(saved);
            } catch(e) {
                this.users = [];
            }
        }
        
        const masterExists = this.users.find(u => u.username === 'master');
        if (!masterExists) {
            this.users.push({
                id: Date.now(),
                username: 'master',
                password: 'Alpha2024!',
                isMaster: true,
                permissions: ALL_PERMISSIONS
            });
            this.saveUsers();
            console.log('👑 Usuario master creado');
        }
    }
    
    saveUsers() {
        localStorage.setItem('alphaColorMatchUsers', JSON.stringify(this.users));
    }
    
    login(username, password) {
        const user = this.users.find(u => u.username === username && u.password === password);
        if (user) {
            this.currentUser = { ...user };
            delete this.currentUser.password;
            localStorage.setItem('alphaColorMatchCurrentUser', JSON.stringify(this.currentUser));
            return { success: true, user: this.currentUser };
        }
        return { success: false, error: 'Usuario o contraseña incorrectos' };
    }
    
    logout() {
        this.currentUser = null;
        localStorage.removeItem('alphaColorMatchCurrentUser');
    }
    
    loadSession() {
        const saved = localStorage.getItem('alphaColorMatchCurrentUser');
        if (saved) {
            try {
                this.currentUser = JSON.parse(saved);
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
        return this.currentUser.permissions && this.currentUser.permissions.includes(permission);
    }
    
    getCurrentUser() {
        return this.currentUser;
    }
    
    isMaster() {
        return this.currentUser && this.currentUser.isMaster === true;
    }
    
    getAllUsers() {
        return this.users.map(u => {
            const { password, ...userWithoutPassword } = u;
            return userWithoutPassword;
        });
    }
    
    getUser(username) {
        return this.users.find(u => u.username === username);
    }
    
    createUser(username, password, permissions, isMaster = false) {
        if (this.users.find(u => u.username === username)) {
            return { success: false, error: 'El usuario ya existe' };
        }
        
        const newUser = {
            id: Date.now(),
            username: username,
            password: password,
            permissions: permissions,
            isMaster: isMaster,
            createdAt: new Date().toISOString()
        };
        
        this.users.push(newUser);
        this.saveUsers();
        return { success: true, user: newUser };
    }
    
    updateUser(userId, updates) {
        const index = this.users.findIndex(u => u.id === userId);
        if (index === -1) return { success: false, error: 'Usuario no encontrado' };
        
        if (this.users[index].isMaster && updates.isMaster === undefined) {
            if (updates.permissions) {
                this.users[index].permissions = updates.permissions;
            }
        } else {
            this.users[index] = { ...this.users[index], ...updates };
        }
        
        this.saveUsers();
        return { success: true, user: this.users[index] };
    }
    
    deleteUser(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return { success: false, error: 'Usuario no encontrado' };
        if (user.isMaster) return { success: false, error: 'No se puede eliminar al usuario master' };
        
        this.users = this.users.filter(u => u.id !== userId);
        this.saveUsers();
        return { success: true };
    }
}