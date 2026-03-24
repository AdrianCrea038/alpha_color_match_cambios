export class DataManager {
    constructor() {
        this.storageKey = 'alpha_color_match_history';
    }
    
    saveToHistory(item) {
        const history = this.getHistory();
        history.unshift(item);
        
        if (history.length > 50) history.pop();
        
        localStorage.setItem(this.storageKey, JSON.stringify(history));
    }
    
    getHistory() {
        const stored = localStorage.getItem(this.storageKey);
        return stored ? JSON.parse(stored) : [];
    }
    
    clearHistory() {
        localStorage.removeItem(this.storageKey);
    }
    
    saveReferenceData(data) {
        localStorage.setItem('alpha_color_match_reference', JSON.stringify(data));
    }
    
    getReferenceData() {
        const stored = localStorage.getItem('alpha_color_match_reference');
        return stored ? JSON.parse(stored) : [];
    }
}
