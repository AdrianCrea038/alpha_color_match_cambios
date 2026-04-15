// js/views/creatorView.js
export class CreatorView {
    constructor(app, equivalencyTable) {
        this.app = app;
        this.equivalencyTable = equivalencyTable;
        this.colors = [];
        console.log('✅ CreatorView inicializado');
    }
    
    renderTable() { console.log('renderTable'); }
    getGlobalPlotter() { return parseInt(document.getElementById('globalPlotter')?.value || 14); }
    getPendingColors() { return []; }
}