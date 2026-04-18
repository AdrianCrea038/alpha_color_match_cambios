    // js/core/constants.js
    export const EQUIVALENCY_ROWS = [
        ["BLK", "00A BLACK", "03S TM Black", "03T TM BLACK", "00ABLACK", "002 BLACK"],
        ["ANT", "06F ANTHRACITE", "05X TM Anthracite"],
        ["GRY1", "01V WOLF GREY", "03T Blue Grey", "03T TM Blue Grey"],
        ["GRY2", "01P DK STEEL GREY", "01P DARK STEEL GREY", "01P T DARK STEEL GREY", "01P TM DARK STEEL GREY"],
        ["GRY3", "08Q TM PEWTER GREY", "03T PEWTER GREY", "08Q PEWTER GREY", "03T TM PEWTER GREY"],
        ["GRY4", "06H FLINT GREY"],
        ["WHT", "10F WHITE", "10F TM WHITE"],
        ["NAT", "15A TM NATURAL", "15A NATURAL"],
        ["GLD1", "77C GOLD"],
        ["GLD2", "79W TEAM GOLD", "79X TM Vegas Gold"],
        ["GLD3", "79Y TM Bright Gold", "79Q SUNDOWN"],
        ["GLD4", "79V CLUB GOLD"],
        ["GLD5", "76I UNIVERSITY GOLD", "76I UNI GOLD"],
        ["GLD6", "79U GOLD DART"],
        ["GLD7", "77C TONAL GOLD"],
        ["GLD8", "PMS 132 OLD GOLD", "PMS 1255C OLD GOLD"],
        ["YEL1", "79S YELLOW STRIKE", "79S TM Yellow Strike"],
        ["YEL2", "PMS 109C NEW YELLOW"],
        ["YEL3", "78H AMARILLO"],
        ["ORG1", "81F DESERT ORANGE", "81F TM DESERT ORANGE"],
        ["ORG2", "89L TEAM ORANGE", "82U TM ORANGE"],
        ["ORG3", "89M Uni Orange"],
        ["ORG4", "89N Brilliant Orange"],
        ["RED1", "65N UNIVERSITY RED", "65N UNI RED", "64V TM SCARLET"],
        ["RED2", "66P DEEP MAROON", "67Y TM Dark Maroon"],
        ["RED3", "69W TM CRIMSON", "69W TEAM CRIMSON"],
        ["RED4", "69X TEAM MAROON", "69Y TM CARDINAL"],
        ["RED5", "6DL GYM RED"],
        ["GRN1", "39Y GORGE GREEN", "31V TM Dark Green"],
        ["GRN2", "31W CLASSIC GREEN", "3EM TM Kelly Green"],
        ["GRN3", "2DH MEDIUM OLIVE", "2DH TM Medium Olive"],
        ["GRN4", "3EY PRO GREEN"],
        ["GRN5", "PMS 361C LEVEL GREEN"],
        ["BLU1", "4EV GAME ROYAL", "49V TM ROYAL"],
        ["BLU2", "4EY VALOR BLUE", "4CV TM LIGHT BLUE"],
        ["BLU3", "4ES AERO BLUE", "4ES TM AERO BLUE"],
        ["BLU4", "44A TIDAL BLUE", "44A TM TIDAL BLUE"],
        ["BLU5", "41S COLLEGE NAVY", "43V TM NAVY"],
        ["BLU6", "4EW RUSH BLUE"],
        ["BLU7", "48Y ITALY BLUE"],
        ["BLU8", "44U SIGNAL BLUE"],
        ["BLU9", "45W BLUSTERY", "45W TM BLUSTERY"],
        ["PRP1", "56N FIELD PURPLE", "52V TM Purple"],
        ["PRP2", "52M NEW ORCHID"],
        ["PRP3", "55U URBAN LILAC"],
        ["PNK1", "66Z PINK FIRE II", "6DR TM Pink Fire", "66Z PINK FIRE"],
        ["BRN1", "2AQ TM Brown", "20Q DARK CINDER"],
        ["BRN2", "2DI SEAL BROWN"],
        ["BRN3", "33B OCHRE"],
        ["BRN4", "TAN PMS 720C"],
        ["VOL", "71R VOLT"],
        ["TRQ1", "3GU HYPER TURQ"],
        ["TRQ2", "4KB DARK TURQUOISE"],
        ["CRM", "87F BRIGHT CERAMIC", "87F TM BRIGHT CERAMIC"]
    ];

    export const ALL_VALID_COLOR_NAMES = (() => {
        const names = [];
        for (const row of EQUIVALENCY_ROWS) {
            for (let i = 1; i < row.length; i++) {
                names.push(row[i].toUpperCase());
            }
        }
        return [...new Set(names)].sort();
    })();

    export const EQUIVALENCE_MAP = (() => {
        const map = new Map();
        for (const row of EQUIVALENCY_ROWS) {
            const groupId = row[0];
            const names = row.slice(1);
            for (const name of names) {
                const key = name.toUpperCase();
                if (!map.has(key)) {
                    map.set(key, { groupId, names: [...names] });
                }
            }
        }
        return map;
    })();

    export const MAIN_COLOR_NAMES = (() => {
        const mainNames = [];
        for (const row of EQUIVALENCY_ROWS) {
            if (row.length > 1) {
                mainNames.push(row[1]);
            }
        }
        return mainNames.sort();
    })();

    export function getAllEquivalentNames(baseName) {
        const key = baseName.toUpperCase();
        const equiv = EQUIVALENCE_MAP.get(key);
        return equiv ? [...equiv.names] : [baseName];
    }

    export function getGroupIdForColor(baseName) {
        const key = baseName.toUpperCase();
        const equiv = EQUIVALENCE_MAP.get(key);
        return equiv ? equiv.groupId : '';
    }