} else if (item.status === 'missing') {
    // Si falta en secundario (solo en principal)
    if (item.cmykPrimary && !item.cmykSecondary) {
        actions = `
            <div class="action-buttons-cell">
                <button class="small-btn btn-keep" onclick="window.app.showKeepMissingConfirm('${item.id}')">
                    💾 Mantener en principal
                </button>
                <button class="small-btn btn-danger" onclick="window.app.showDeleteMissingConfirm('${item.id}')">
                    🗑️ Eliminar de principal
                </button>
            </div>
        `;
    }
    // Si falta en principal (solo en secundario)
    else if (item.cmykSecondary && !item.cmykPrimary) {
        actions = `
            <div class="action-buttons-cell">
                <button class="small-btn btn-success" onclick="window.app.showAddConfirm('${item.id}')">
                    ➕ Agregar a principal
                </button>
                <button class="small-btn btn-secondary" onclick="window.app.showIgnoreConfirm('${item.id}')">
                    ⏭️ Ignorar
                </button>
            </div>
        `;
    }
}
