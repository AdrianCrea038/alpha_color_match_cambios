/**
 * Módulo ColorMatcher - Comparación inteligente de colores
 * Versión mejorada: Normalización de nombres para comparación
 */

export class ColorMatcher {
    constructor() {
        this.tolerance = {
            cmyk: 5.0,
            euclidean: 8.0
        };
        
        // Tabla de unificación para nombres base (sin NK)
        // Los nombres se normalizan internamente para comparación
        this.nameMapping = new Map([
            ["10FTM WHITE", "10A WHITE"],
            ["03STM BLACK", "00A BLACK"],
            ["01PTM DK STEEL GREY", "01P DK STEEL GREY"],
            ["03TBLUE GREY", "01V WOLF GREY"],
            ["05XTM ANTHRACITE", "06F ANTHRACITE"],
            ["2AQTM BROWN", "20Q DARK CINDER"],
            ["2DHTM MEDIUM OLIVE", "2DH MEDIUM OLIVE"],
            ["3EMTM KELLY GREEN", "31W CLASSIC GREEN"],
            ["31VTM DARK GREEN", "39Y GORGE GREEN"],
            ["43VTM NAVY", "41S COLLEGE NAVY"],
            ["44ATM TIDAL BLUE", "44A TIDAL BLUE"],
            ["45WTM BLUSTERY", "45W BLUSTERY"],
            ["4ES TM AERO BLUE", "4ES AERO BLUE"],
            ["49VTM ROYAL", "4EV GAME ROYAL"],
            ["4CVTM LIGHT BLUE", "4EY VALOR BLUE"],
            ["52VTM PURPLE", "56N FIELD PURPLE"],
            ["64VTM SCARLET", "65N UNIVERSITY RED"],
            ["67YTM DARK MAROON", "66P DEEP MAROON"],
            ["6DRTM PINK FIRE II", "66Z PINK FIRE II"],
            ["69WTM CRIMSON", "69W TEAM CRIMSON"],
            ["69YTM CARDINAL", "69X TEAM MAROON"],
            ["79YTM BRIGHT GOLD", "79Q SUNDOWN"],
            ["79STM YELLOW STRIKE", "79S YELLOW STRIKE"],
            ["79XTM VEGAS GOLD", "79W TEAM GOLD"],
            ["81FDESERT ORANGE", "81F DESERT ORANGE"],
            ["87FTM BRIGHT CERAMIC", "87F BRIGHT CERAMIC"],
            ["82U TM ORANGE", "89L TEAM ORANGE"],
            ["06HFLINT GREY", "06H FLINT GREY"],
            ["15ANATURAL", "15A NATURAL"],
            ["3EYPRO GREEN", "3EY PRO GREEN"],
            ["3HNACTION GREEN", "3HN ACTION GREEN"],
            ["3GUHYPER TURQUOISE", "3GU HYPER TURQUOISE"],
            ["44USIGNAL BLUE", "44U SIGNAL BLUE"],
            ["4KBDARK TURQUOISE", "4KB DARK TURQUOISE"],
            ["4LBGYM BLUE", "4LB GYM BLUE"],
            ["48YITALY BLUE", "48Y ITALY BLUE"],
            ["52MNEW ORCHID", "52M NEW ORCHID"],
            ["71RVOLT", "71R VOLT"],
            ["77CGOLD", "77C GOLD"],
            ["76IUNIVERSITY GOLD", "76I UNIVERSITY GOLD"],
            ["78HAMARILLO", "78H AMARILLO"],
            ["79VCLUB GOLD", "79V CLUB GOLD"],
            ["89MUNIVERSITY ORANGE", "89M UNIVERSITY ORANGE"],
            ["89NBRILLIANT ORANGE", "89N BRILLIANT ORANGE"],
            ["89QORANGE HORIZON", "89Q ORANGE HORIZON"]
        ]);
    }

    // ✅ Normalización para comparación: MAYÚSCULAS + eliminar espacios, guiones, guiones bajos, puntos
    normalizeForComparison(str) {
        if (!str) return '';
        return str
            .toUpperCase()
            .replace(/\s+/g, '')           // Eliminar todos los espacios
            .replace(/[-_]/g, '')          // Eliminar guiones y guiones bajos
            .replace(/\./g, '');           // Eliminar puntos
    }

    extractNKCode(fullName) {
        const match = fullName.match(/NK\d+$/);
        return match ? match[0] : null;
    }
    
    removeNKCode(name) {
        return name.replace(/\s+NK\d+$/, '').trim();
    }
    
    normalizeBaseName(name) {
        if (!name) return '';
        
        // Normalizar el nombre para buscar en la tabla
        const normalizedInput = this.normalizeForComparison(name);
        
        // Buscar en el mapa de unificación
        for (let [original, mapped] of this.nameMapping) {
            const normalizedOriginal = this.normalizeForComparison(original);
            if (normalizedInput === normalizedOriginal) {
                return mapped;
            }
        }
        
        return name.trim().replace(/\s+/g, ' ');
    }
    
    normalizeNameForComparison(name) {
        if (!name) return '';
        
        // Extraer NK y nombre base
        const nkCode = this.extractNKCode(name);
        let nameWithoutNK = this.removeNKCode(name);
        
        // Normalizar el nombre base
        let normalizedBase = this.normalizeBaseName(nameWithoutNK);
        
        // Devolver nombre base normalizado (para comparación de nombres)
        return this.normalizeForComparison(normalizedBase);
    }
    
    // Obtener el nombre unificado según la tabla
    getUnifiedName(name) {
        if (!name) return '';
        
        let nameWithoutNK = this.removeNKCode(name);
        nameWithoutNK = nameWithoutNK.trim().replace(/\s+/g, ' ');
        
        const normalizedInput = this.normalizeForComparison(nameWithoutNK);
        
        for (let [original, mapped] of this.nameMapping) {
            const normalizedOriginal = this.normalizeForComparison(original);
            if (normalizedInput === normalizedOriginal) {
                return mapped;
            }
        }
        
        return nameWithoutNK;
    }
    
    // Verificar si dos nombres son equivalentes según la tabla
    areEquivalentNames(name1, name2) {
        // Primero comparar por NK
        const nk1 = this.extractNKCode(name1);
        const nk2 = this.extractNKCode(name2);
        
        // Si los NK son diferentes, no son equivalentes
        if (nk1 !== nk2) return false;
        
        // Extraer nombres base
        const base1 = this.removeNKCode(name1);
        const base2 = this.removeNKCode(name2);
        
        // Si los nombres base son iguales (normalizados), son equivalentes
        const normalized1 = this.normalizeForComparison(base1);
        const normalized2 = this.normalizeForComparison(base2);
        
        if (normalized1 === normalized2) return true;
        
        // Buscar en la tabla de unificación
        const unified1 = this.getUnifiedName(name1);
        const unified2 = this.getUnifiedName(name2);
        
        return this.normalizeForComparison(unified1) === this.normalizeForComparison(unified2);
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
        const normalizedName = this.normalizeNameForComparison(secondary.name);
        
        let match = primaryIndex.byNormalizedName.get(normalizedName);
        let matchType = 'name_match';
        
        if (!match) {
            match = primaryIndex.byId.get(secondary.id);
            if (match) matchType = 'id_match';
        }
        
        if (!match) {
            match = this.fuzzySearchByCmyk(secondary.cmyk, primaryData);
            if (match) matchType = 'cmyk_match';
        }
        
        if (match) {
            const differences = this.compareCmykValues(match.cmyk, secondary.cmyk);
            const hasDifferences = differences.some(d => Math.abs(d) > 0.01);
            const diffPercentage = this.calculateDifferencePercentage(match.cmyk, secondary.cmyk);
            
            const unifiedName = this.getUnifiedName(secondary.name);
            const areEquivalent = this.areEquivalentNames(match.name, secondary.name);
            
            return {
                id: secondary.id,
                name: secondary.name,
                primaryName: match.name,
                secondaryName: secondary.name,
                unifiedName: unifiedName,
                cmykPrimary: match.cmyk,
                cmykSecondary: secondary.cmyk,
                labPrimary: match.lab,
                labSecondary: secondary.lab,
                status: hasDifferences ? 'diff' : 'match',
                matchFound: true,
                matchType: matchType,
                areEquivalent: areEquivalent,
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
            secondaryName: secondary.name,
            cmykSecondary: secondary.cmyk,
            labSecondary: secondary.lab,
            cmykPrimary: null,
            labPrimary: null,
            status: 'missing',
            matchFound: false,
            matchType: 'none',
            areEquivalent: false,
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
