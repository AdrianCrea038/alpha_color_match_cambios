// js/modules/cacheManager.js
export function saveState(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

export function loadState(key, defaultValue = null) {
    const saved = localStorage.getItem(key);
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch(e) {
            return defaultValue;
        }
    }
    return defaultValue;
}

export function clearAllCache() {
    const keysToRemove = [
        'alphaColorMatchData',
        'alphaColorMatchEquivalencyRows',
        'developmentColors',
        'alphaColorMatchLibrary',
        'alphaColorMatchGroupIds',
        'alphaColorMatchUsers',
        'nameCorrectionHistory',
        'alphaColorMatchAssignments'
    ];
    
    for (const key of keysToRemove) {
        localStorage.removeItem(key);
    }
    
    console.log('✅ Caché completamente limpiada');
}

export function saveComparatorState(primaryData, secondaryData, results, selectedPending, deletedPending, groupSelections, manualGroupSelections) {
    const state = {
        primaryData,
        secondaryData,
        results,
        selectedPending: Array.from(selectedPending),
        deletedPending: Array.from(deletedPending),
        groupSelections: Array.from(groupSelections.entries()),
        manualGroupSelections: Array.from(manualGroupSelections),
        lastUpdated: new Date().toISOString()
    };
    saveState('alphaColorMatchData', state);
}

export function loadComparatorState() {
    const state = loadState('alphaColorMatchData', null);
    if (state) {
        return {
            primaryData: state.primaryData || [],
            secondaryData: state.secondaryData || [],
            results: state.results || [],
            selectedPending: new Set(state.selectedPending || []),
            deletedPending: new Set(state.deletedPending || []),
            groupSelections: new Map(state.groupSelections || []),
            manualGroupSelections: new Set(state.manualGroupSelections || [])
        };
    }
    return null;
}