import { DirectAuditView } from './directAuditView.js';
import { CyclicAuditView } from './cyclicAuditView.js';

/**
 * VISTA: Hub de Cíclicos
 * Misión: Orquestar el cambio entre Auditoría de 1 TXT y 2 TXT.
 * SEPARACIÓN GARANTIZADA: Carga instancias distintas de clases distintas.
 */
export class CyclicHubView {
    constructor() {
        this.directView = new DirectAuditView('directAuditContainer');
        this.cyclicView = new CyclicAuditView('cyclicAuditContainer');
        this.currentMode = null;
        window.cyclicHub = this;
    }

    init() {
        // Inicializar ambas sub-vistas en sus contenedores ocultos
        this.directView.init();
        this.cyclicView.init();
        
        // Resetear vista al entrar
        this.switchMode(null);
    }

    switchMode(mode) {
        const directCont = document.getElementById('directAuditContainer');
        const cyclicCont = document.getElementById('cyclicAuditContainer');
        const selector = document.querySelector('.cyclic-hub-selector');

        if (!mode) {
            selector.style.display = 'flex';
            directCont.style.display = 'none';
            cyclicCont.style.display = 'none';
            return;
        }

        selector.style.display = 'none'; // Ocultar selector al elegir modo

        if (mode === 'direct') {
            directCont.style.display = 'block';
            cyclicCont.style.display = 'none';
            // Agregar botón de volver
            this.addBackButton(directCont);
        } else {
            directCont.style.display = 'none';
            cyclicCont.style.display = 'block';
            // Agregar botón de volver
            this.addBackButton(cyclicCont);
        }
    }

    addBackButton(container) {
        if (container.querySelector('.hub-back-btn')) return;
        const btn = document.createElement('button');
        btn.className = 'premium-btn secondary hub-back-btn';
        btn.style.marginBottom = '1rem';
        btn.innerHTML = '<i class="fas fa-arrow-left"></i> Volver al Selector';
        btn.onclick = () => this.switchMode(null);
        container.insertBefore(btn, container.firstChild);
    }
}
