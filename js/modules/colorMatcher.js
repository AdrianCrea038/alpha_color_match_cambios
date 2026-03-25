/**
 * Módulo ColorMatcher - Comparación inteligente de colores
 * Versión mejorada: Solo comparación CMYK con ambas fórmulas visibles
 */

export class ColorMatcher {
    constructor() {
        this.tolerance = {
            cmyk: 5.0,
            euclidean: 8.0
        };
        
        // ✅ Tabla de unificación para nombres base (sin NK)
        this.nameMapping = new Map([
            ["10FTM White", "10A White"],
            ["03sTM Black", "00A Black"],
            ["01PTM DK Steel Grey", "01P DK Steel Grey"],
            ["03TBlue Grey", "01V Wolf Grey"],
            ["05XTM Anthracite", "06F Anthracite"],
            ["2AQTM Brown", "20Q Dark Cinder"],
            ["2DHTM Medium Olive", "2DH Medium Olive"],
            ["3EMTM Kelly Green", "31W Classic Green"],
            ["31VTM Dark Green", "39Y Gorge Green"],
            ["43VTM Navy", "41S College Navy"],
            ["44ATM Tidal Blue", "44A Tidal Blue"],
            ["45WTM Blustery", "45W Blustery"],
            ["4ES TM Aero Blue", "4ES Aero Blue"],
            ["49VTM Royal", "4EV Game Royal"],
            ["4CVTM Light Blue", "4EY Valor Blue"],
            ["52VTM Purple", "56N Field Purple"],
            ["64VTM Scarlet", "65N University Red"],
            ["67YTM Dark Maroon", "66P Deep Maroon"],
            ["6DRTM Pink Fire II", "66Z Pink Fire II"],
            ["69WTM Crimson", "69W Team Crimson"],
            ["69YTM Cardinal", "69X Team Maroon"],
            ["79YTM Bright Gold", "79Q Sundown"],
            ["79STM Yellow Strike", "79S Yellow Strike"],
            ["79XTM Vegas Gold", "79W Team Gold"],
            ["81FDesert Orange", "81F Desert Orange"],
            ["87FTM Bright Ceramic", "87F Bright Ceramic"],
            ["82U TM Orange", "89L Team Orange"],
            ["06HFlint Grey", "06H Flint Grey"],
            ["15ANatural", "15A Natural"],
            ["3EYPro Green", "3EY Pro Green"],
            ["3HNAction Green", "3HN Action Green"],
            ["3GUHyper Turquoise", "3GU Hyper Turquoise"],
            ["44USignal Blue", "44U Signal Blue"],
            ["4KBDark Turquoise", "4KB Dark Turquoise"],
            ["4LBGym Blue", "4LB Gym Blue"],
            ["48YItaly Blue", "48Y Italy Blue"],
            ["52MNew Orchid", "52M New Orchid"],
            ["71RVolt", "71R Volt"],
            ["77CGold", "77C Gold"],
            ["76IUniversity Gold", "76I University Gold"],
            ["78HAmarillo", "78H Amarillo"],
            ["79VClub Gold", "79V Club Gold"],
            ["89MUniversity Orange", "89M University Orange"],
            ["89NBrilliant Orange", "89N Brilliant Orange"],
            ["89QOrange Horizon", "89Q Orange Horizon"]
        ]);
    }

    // ✅ Función para extraer el código NK
    extractNKCode(name) {
        const match = name.match(/NK\d+$/);
        return match ? match[0] : null;
    }
    
    // ✅ Función para eliminar el código NK
    removeNKCode(name) {
        return name.replace(/\s+NK\d+$/, '').trim();
    }
    
    // ✅ Función para normalizar el nombre base según la tabla
    normalizeBaseName(name) {
        // Eliminar espacios múltiples
        let normalized = name.trim().replace(/\s+/g, ' ');
        
        // Buscar en el mapa de unificación
        for (let [original, mapped] of this.nameMapping) {
            const normalizedOriginal = original.trim().replace(/\s+/g, ' ').toLowerCase();
            const normalizedName = normalized.toLowerCase();
            
            if (normalizedName === normalizedOriginal) {
                return mapped;
            }
        }
        
        return normalized;
    }
    
    // ✅ Función principal de normalización para comparación
    normalizeNameForComparison(name) {
        if (!name) return '';
        
        // Extraer y guardar el NK
        const nkCode = this.extractNKCode(name);
        
        // Eliminar NK para normalizar
        let nameWithoutNK = this.removeNKCode(name);
        
        // Normalizar el nombre base
        let normalizedBase = this.normalizeBaseName(nameWithoutNK);
        
        // Devolver solo el nombre base normalizado (sin NK para comparación)
        return normalizedBase.toLowerCase().trim();
    }

    smartCompare(primaryData, secondaryData) {
        const results = [];
        const primaryIndex = this.buildSearchIndex(primaryData);
        
        for (const secondary of secondaryData) {
            const comparison = this.compareSingleColor(secondary, primaryIndex, primaryData);
            results.push(comparison);
        }
        
        return results;
    }
    
    buildSearchIndex(primaryData) {
        const index = {
            byNormalizedName: new Map(),
            byId: new Map(),
            byCmykHash: new Map(),
            all: primaryData
        };
        
        for (const item of primaryData) {
            // ✅ Usar nombre normalizado sin NK para comparación
            const normalizedName = this.normalizeNameForComparison(item.name);
            index.byNormalizedName.set(normalizedName, item);
            index.byId.set(item.id, item);
            
            const cmykHash = this.getCmykHash(item.cmyk);
            if (!index.byCmykHash.has(cmykHash)) {
                index.byCmykHash.set(cmykHash, []);
            }
            index.byCmykHash.get(cmykHash).push(item);
        }
        
        return index;
    }
    
    compareSingleColor(secondary, primaryIndex, primaryData) {
        // ✅ Usar nombre normalizado sin NK para comparación
        const normalizedName = this.normalizeNameForComparison(secondary.name);
        
        let match = primaryIndex.byNormalizedName.get(normalizedName);
        
        if (!match) {
            match = primaryIndex.byId.get(secondary.id);
        }
        
        if (!match) {
            match = this.fuzzySearchByCmyk(secondary.cmyk, primaryData);
        }
        
        if (match) {
            const differences = this.compareCmykValues(match.cmyk, secondary.cmyk);
            const hasDifferences = differences.some(d => Math.abs(d) > 0.01);
            const diffPercentage = this.calculateDifferencePercentage(match.cmyk, secondary.cmyk);
            
            return {
                id: secondary.id,
                name: secondary.name,
                cmykPrimary: match.cmyk,
                cmykSecondary: secondary.cmyk,
                labPrimary: match.lab,
                labSecondary: secondary.lab,
                status: hasDifferences ? 'diff' : 'match',
                matchFound: true,
                matchType: this.getMatchType(match, secondary),
                differences: differences,
                diffPercentage: diffPercentage,
                originalName: match.name,
                diffDetails: this.getDetailedDiff(match.cmyk, secondary.cmyk),
                recommendation: this.getRecommendation(diffPercentage)
            };
        }
        
        return {
            id: secondary.id,
            name: secondary.name,
            cmykSecondary: secondary.cmyk,
            labSecondary: secondary.lab,
            cmykPrimary: null,
            labPrimary: null,
            status: 'missing',
            matchFound: false,
            matchType: 'none',
            message: `❌ No se encontró el color "${secondary.name}" en el archivo principal`,
            recommendation: 'Agregar este color a la referencia principal'
        };
    }
    
    getCmykHash(cmyk) {
        if (!cmyk || cmyk.length < 4) return '';
        const rounded = cmyk.map(v => Math.round(v / 5) * 5);
        return rounded.join(',');
    }
    
    fuzzySearchByCmyk(targetCmyk, dataset, threshold = 8.0) {
        let bestMatch = null;
        let smallestDistance = Infinity;
        
        for (const item of dataset) {
            if (!item.cmyk) continue;
            
            const distance = this.calculateEuclideanDistance(targetCmyk, item.cmyk);
            
            if (distance < smallestDistance && distance <= threshold) {
                smallestDistance = distance;
                bestMatch = item;
            }
        }
        
        return bestMatch;
    }
    
    compareCmykValues(cmyk1, cmyk2) {
        if (!cmyk1 || !cmyk2) return [0, 0, 0, 0];
        return cmyk1.map((val, idx) => {
            const diff = val - (cmyk2[idx] || 0);
            return parseFloat(diff.toFixed(4));
        });
    }
    
    calculateEuclideanDistance(arr1, arr2) {
        if (!arr1 || !arr2) return Infinity;
        const sum = arr1.reduce((acc, val, i) => {
            const diff = val - (arr2[i] || 0);
            return acc + diff * diff;
        }, 0);
        return Math.sqrt(sum);
    }
    
    calculateDifferencePercentage(cmyk1, cmyk2) {
        if (!cmyk1 || !cmyk2) return 100;
        const totalDiff = cmyk1.reduce((sum, val, i) => {
            return sum + Math.abs(val - (cmyk2[i] || 0));
        }, 0);
        const maxPossible = 400;
        return (totalDiff / maxPossible) * 100;
    }
    
    getDetailedDiff(cmyk1, cmyk2) {
        return {
            cyan: Math.abs(cmyk1[0] - cmyk2[0]).toFixed(2),
            magenta: Math.abs(cmyk1[1] - cmyk2[1]).toFixed(2),
            yellow: Math.abs(cmyk1[2] - cmyk2[2]).toFixed(2),
            black: Math.abs(cmyk1[3] - cmyk2[3]).toFixed(2),
            total: this.calculateDifferencePercentage(cmyk1, cmyk2).toFixed(2)
        };
    }
    
    getMatchType(match, secondary) {
        const normalizedMatch = this.normalizeNameForComparison(match.name);
        const normalizedSecondary = this.normalizeNameForComparison(secondary.name);
        
        if (normalizedMatch === normalizedSecondary) {
            return 'name_match';
        }
        if (match.id === secondary.id) {
            return 'id_match';
        }
        return 'cmyk_match';
    }
    
    getRecommendation(diffPercentage) {
        if (diffPercentage < 1) {
            return '✅ Coincidencia exacta - No requiere acción';
        } else if (diffPercentage < 5) {
            return '⚠️ Diferencia menor - Considere revisar si es intencional';
        } else if (diffPercentage < 15) {
            return '🔄 Diferencia moderada - Recomendamos actualizar';
        } else {
            return '❗ Diferencia significativa - Se recomienda reemplazar el valor';
        }
    }
    
    getComparisonStats(results) {
        const stats = {
            total: results.length,
            matches: 0,
            differences: 0,
            missing: 0,
            avgDifference: 0,
            maxDifference: 0
        };
        
        let totalDiff = 0;
        
        for (const result of results) {
            if (result.status === 'match') {
                stats.matches++;
            } else if (result.status === 'diff') {
                stats.differences++;
                if (result.diffPercentage) {
                    totalDiff += parseFloat(result.diffPercentage);
                    stats.maxDifference = Math.max(stats.maxDifference, parseFloat(result.diffPercentage));
                }
            } else if (result.status === 'missing') {
                stats.missing++;
            }
        }
        
        stats.avgDifference = stats.differences > 0 ? 
            (totalDiff / stats.differences).toFixed(2) : 0;
        
        return stats;
    }
}
normalizeBaseName(name) {
    if (!name) return '';
    
    // Eliminar espacios múltiples
    let normalized = name.trim().replace(/\s+/g, ' ');
    
    // Buscar en el mapa de unificación
    for (let [original, mapped] of this.nameMapping) {
        const normalizedOriginal = original.trim().replace(/\s+/g, ' ');
        if (normalized === normalizedOriginal) {
            return mapped;
        }
    }
    
    return normalized;
}
normalizeBaseName(name) {
    if (!name) return '';
    
    // Eliminar espacios múltiples
    let normalized = name.trim().replace(/\s+/g, ' ');
    
    // Buscar en el mapa de unificación
    for (let [original, mapped] of this.nameMapping) {
        const normalizedOriginal = original.trim().replace(/\s+/g, ' ');
        if (normalized === normalizedOriginal) {
            return mapped;
        }
    }
    
    return normalized;
}
