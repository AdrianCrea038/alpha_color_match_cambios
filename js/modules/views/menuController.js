// ============================================================
// MENU CONTROLLER - Controla el cambio entre vistas
// NO modifica el sistema existente, solo agrega navegación
// ============================================================

class MenuController {
    constructor() {
        this.menuItems = document.querySelectorAll('.menu-item');
        this.views = {
            comparator: document.getElementById('comparatorView'),
            history: document.getElementById('historyView'),
            creator: document.getElementById('creatorView'),
            eps: document.getElementById('epsView')
        };
        
        this.init();
    }
    
    init() {
        // Agregar event listeners a los items del menú
        this.menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const viewName = item.dataset.view;
                if (viewName) {
                    this.switchView(viewName);
                }
            });
        });
        
        console.log('✅ Menú Controller iniciado');
    }
    
    switchView(viewName) {
        // Ocultar todas las vistas
        Object.values(this.views).forEach(view => {
            if (view) view.classList.remove('active');
        });
        
        // Mostrar la vista seleccionada
        if (this.views[viewName]) {
            this.views[viewName].classList.add('active');
        }
        
        // Actualizar clase active en los items del menú
        this.menuItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.view === viewName) {
                item.classList.add('active');
            }
        });
        
        // Disparar evento personalizado para que otros módulos sepan que cambió la vista
        const event = new CustomEvent('viewChanged', { detail: { view: viewName } });
        document.dispatchEvent(event);
    }
}

// Iniciar el controlador cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.menuController = new MenuController();
});