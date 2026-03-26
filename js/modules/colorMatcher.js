export class ColorMatcher {
    constructor() {
        this.nameMapping = new Map([
            ["10F TM WHITE", "10A WHITE"],
            ["03S TM BLACK", "00A BLACK"],
            ["01P TM DK STEEL GREY", "01P DK STEEL GREY"],
            ["03T BLUE GREY", "01V WOLF GREY"],
            ["05X TM ANTHRACITE", "06F ANTHRACITE"],
            ["2AQ TM BROWN", "20Q DARK CINDER"],
            ["2DH TM MEDIUM OLIVE", "2DH MEDIUM OLIVE"],
            ["3EM TM KELLY GREEN", "31W CLASSIC GREEN"],
            ["31V TM DARK GREEN", "39Y GORGE GREEN"],
            ["43V TM NAVY", "41S COLLEGE NAVY"],
            ["44A TM TIDAL BLUE", "44A TIDAL BLUE"],
            ["45W TM BLUSTERY", "45W BLUSTERY"],
            ["4ES TM AERO BLUE", "4ES AERO BLUE"],
            ["49V TM ROYAL", "4EV GAME ROYAL"],
            ["4CV TM LIGHT BLUE", "4EY VALOR BLUE"],
            ["52V TM PURPLE", "56N FIELD PURPLE"],
            ["64V TM SCARLET", "65N UNIVERSITY RED"],
            ["67Y TM DARK MAROON", "66P DEEP MAROON"],
            ["6DR TM PINK FIRE II", "66Z PINK FIRE II"],
            ["69W TM CRIMSON", "69W TEAM CRIMSON"],
            ["69Y TM CARDINAL", "69X TEAM MAROON"],
            ["79Y TM BRIGHT GOLD", "79Q SUNDOWN"],
            ["79S TM YELLOW STRIKE", "79S YELLOW STRIKE"],
            ["79X TM VEGAS GOLD", "79W TEAM GOLD"],
            ["81F DESERT ORANGE", "81F DESERT ORANGE"],
            ["87F TM BRIGHT CERAMIC", "87F BRIGHT CERAMIC"],
            ["82U TM ORANGE", "89L TEAM ORANGE"],
            ["06H FLINT GREY", "06H FLINT GREY"],
            ["15A NATURAL", "15A NATURAL"],
            ["3EY PRO GREEN", "3EY PRO GREEN"],
            ["3HN ACTION GREEN", "3HN ACTION GREEN"],
            ["3GU HYPER TURQUOISE", "3GU HYPER TURQUOISE"],
            ["44U SIGNAL BLUE", "44U SIGNAL BLUE"],
            ["4KB DARK TURQUOISE", "4KB DARK TURQUOISE"],
            ["4LB GYM BLUE", "4LB GYM BLUE"],
            ["48Y ITALY BLUE", "48Y ITALY BLUE"],
            ["52M NEW ORCHID", "52M NEW ORCHID"],
            ["71R VOLT", "71R VOLT"],
            ["77C GOLD", "77C GOLD"],
            ["76I UNIVERSITY GOLD", "76I UNIVERSITY GOLD"],
            ["78H AMARILLO", "78H AMARILLO"],
            ["79V CLUB GOLD", "79V CLUB GOLD"],
            ["89M UNIVERSITY ORANGE", "89M UNIVERSITY ORANGE"],
            ["89N BRILLIANT ORANGE", "89N BRILLIANT ORANGE"],
            ["89Q ORANGE HORIZON", "89Q ORANGE HORIZON"]
        ]);
    }

    normalizeForComparison(str) {
        if (!str) return '';
        return str
            .toUpperCase()
            .replace(/\s+/g, '')
            .replace(/[-_]/g, '')
            .replace(/\./g, '');
    }

    extractNKCode(fullName) {
        const match = fullName.match(/NK\d+$/i);
        return match ? match[0].toUpperCase() : null;
    }

    extractBaseName(fullName) {
        return fullName.replace(/\s+NK\d+$/i, '').trim();
    }

    normalizeBaseName(name) {
        if (!name) return '';
        
        const normalizedInput = this.normalizeForComparison(name);
        
        for (let [original, mapped] of this.nameMapping) {
            const normalizedOriginal = this.normalizeForComparison(original);
            if (normalizedInput === normalizedOriginal) {
                return mapped;
            }
        }
        
        return name.trim().replace(/\s+/g, ' ');
    }

    getUnifiedName(name) {
        const baseName = this.extractBaseName(name);
        const normalizedBase = this.normalizeBaseName(baseName);
        const nkCode = this.extractNKCode(name);
        
        return nkCode ? `${normalizedBase} ${nkCode}` : normalizedBase;
    }

    areEquivalentNames(name1, name2) {
        const base1 = this.extractBaseName(name1);
        const base2 = this.extractBaseName(name2);
        
        const normalized1 = this.normalizeForComparison(base1);
        const normalized2 = this.normalizeForComparison(base2);
        
        if (normalized1 === normalized2) return true;
        
        const unified1 = this.normalizeForComparison(this.normalizeBaseName(base1));
        const unified2 = this.normalizeForComparison(this.normalizeBaseName(base2));
        
        return unified1 === unified2;
    }

    getComparisonKey(color) {
        const nkCode = color.nkCode || this.extractNKCode(color.name);
        const baseName = color.baseName || this.extractBaseName(color.name);
        const normalizedBase = this.normalizeForComparison(this.normalizeBaseName(baseName));
        return `${nkCode}_${normalizedBase}`;
    }

    compareColors(primaryColor, secondaryColor) {
        const hasDifferences = this.hasCmykDifferences(primaryColor.cmyk, secondaryColor.cmyk);
        const diffPercentage = this.calculateDiffPercentage(primaryColor.cmyk, secondaryColor.cmyk);
        const areEquivalent = this.areEquivalentNames(primaryColor.name, secondaryColor.name);
        
        return {
            hasDifferences,
            diffPercentage,
            areEquivalent,
            diffDetails: this.getDetailedDiff(primaryColor.cmyk, secondaryColor.cmyk),
            recommendation: this.getRecommendation(diffPercentage)
        };
    }

    hasCmykDifferences(cmyk1, cmyk2) {
        if (!cmyk1 || !cmyk2) return true;
        return cmyk1.some((val, idx) => Math.abs(val - cmyk2[idx]) > 0.01);
    }

    calculateDiffPercentage(cmyk1, cmyk2) {
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
            total: this.calculateDiffPercentage(cmyk1, cmyk2).toFixed(2)
        };
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
}
