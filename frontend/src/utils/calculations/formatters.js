/* frontend/src/utils/calculations/formatters.js */

/**
 * ==========================================
 * FORMATTERS & HELPERS (RBI CORE)
 * ==========================================
 */

// --- UTILS : TIME BUCKETING ---
// Convertit un timestamp en clé de "bucket" (ex: jour, heure, minute)
// Utile pour mapper une donnée macro sur une donnée micro
function getTimeBucketKey(timestamp, resolution) {
    const date = new Date(timestamp * 1000);
    
    // ISO String : YYYY-MM-DDTHH:mm:ss.sssZ
    const iso = date.toISOString();
    
    // CAS 1 : Daily, Weekly, Monthly (Macro)
    if (['1d', '1wk', '1mo', '3mo', 'days'].includes(resolution)) {
        return iso.split('T')[0]; // "2023-10-27"
    }

    // CAS 2 : Intraday (Micro)
    // On doit arrondir à la minute, 5 min, etc.
    // Pour l'instant, on gère le mapping fin via le timestamp exact ou la minute
    if (['1m', '5m', '15m', '60m', '1h', 'data'].includes(resolution)) {
        // Pour simplifier, on clef sur la minute YYYY-MM-DDTHH:mm
        return iso.substring(0, 16); 
    }
    
    // Fallback : Daily
    return iso.split('T')[0];
}


export function formatSeries(chartData, computedData) {
    const res = [];
    const isArrayMode = Array.isArray(computedData);

    for (let i = 0; i < chartData.length; i++) {
        const point = chartData[i];

        // SÉCURITÉ : On saute si le point de référence n'a pas de temps valide
        if (!point || point.time === undefined || Number.isNaN(Number(point.time))) continue;

        let val = undefined;

        if (isArrayMode) {
            // Mode simple (tableau aligné index par index)
            // Utilisé quand source == chart (même résolution)
            val = computedData[i];
        } else {
            // Mode Map (Projection Temporelle)
            // computedData est une Map<StringKey, Value>
            
            // On génère la clé du point courant du graphique
            // NOTE: Ici on assume que la Map a été construite avec des clés Daily ("YYYY-MM-DD")
            // Si on veut supporter la projection Intraday -> Intraday (ex: 1h sur 5m), il faudra rendre ça dynamique.
            // Pour le moment RBI se concentre sur Daily -> Intraday.
            
            if (point.date) {
                const dateKey = point.date.split('T')[0];
                val = computedData.get(dateKey);
            } else {
                 // Fallback timestamp -> date string
                 const dateKey = new Date(point.time * 1000).toISOString().split('T')[0];
                 val = computedData.get(dateKey);
            }
        }

        // Validation stricte
        if (val !== undefined && val !== null && !Number.isNaN(val)) {
            res.push({ 
                time: point.time, 
                value: Number(val)
            });
        }
    }
    
    // TRI FINAL
    return res.sort((a, b) => a.time - b.time);
}

// --- NEW: BACKEND DATA HYDRATION & PROJECTION ---
/**
 * Projette des données backend (potentiellement d'une autre résolution) sur le graphique actuel.
 * @param {Array} backendData - Données calculées par le backend (ex: Daily)
 * @param {Array} chartData - Données affichées sur le graphique (ex: 1m)
 * @param {String} resolution - Résolution de la source ('1d', '1m', etc.)
 */
export function hydrateBackendData(backendData, chartData, resolution) {
    
    // CAS 0 : Pas de données
    if (!backendData || !chartData || backendData.length === 0) return [];

    // CAS 1 : Résolution identique (Pas de projection nécessaire)
    // On détecte ça si la taille des tableaux est très proche ou si resolution == 'data' (legacy)
    // Mais avec RBI, on a une résolution explicite.
    // Si backendData est déjà dense (autant de points que chartData), on retourne direct.
    // (Approximation : si ratio > 0.8)
    if (backendData.length > chartData.length * 0.8) {
        return backendData;
    }

    // CAS 2 : Projection (ex: Daily sur Intraday)
    // On crée l'effet d'escalier (Step-Line).
    
    // A. Détection du format (Bande vs Ligne)
    const isBand = backendData[0].upper !== undefined;
    
    // B. Indexation des valeurs Backend (Sparse)
    const valueMap = new Map();
    
    backendData.forEach(p => {
        // On indexe par date YYYY-MM-DD
        // TODO: Si on supporte le mapping H1->m5, il faudra changer la clé ici.
        // Pour l'instant, on reste sur le mapping Daily par défaut pour tout ce qui est macro.
        const dateStr = new Date(p.time * 1000).toISOString().split('T')[0];
        valueMap.set(dateStr, p);
    });

    // C. Projection sur le ChartData (Dense)
    const hydrated = [];

    chartData.forEach(candle => {
        if (!candle.time && !candle.date) return;
        
        // Clé de la bougie graphique
        const candleTime = candle.time !== undefined ? candle.time : new Date(candle.date).getTime() / 1000;
        const candleDateStr = new Date(candleTime * 1000).toISOString().split('T')[0];
        
        // Recherche de la valeur macro correspondante
        const macroVal = valueMap.get(candleDateStr);

        if (macroVal) {
            if (isBand) {
                hydrated.push({
                    time: candleTime,
                    upper: macroVal.upper,
                    lower: macroVal.lower,
                    basis: macroVal.basis
                });
            } else {
                hydrated.push({
                    time: candleTime,
                    value: macroVal.value
                });
            }
        }
    });

    return hydrated.sort((a, b) => a.time - b.time);
}

// Alias pour compatibilité Legacy
export const hydrateWithProjection = hydrateBackendData;


export function getSource(chartData, dailyData, granularity) {
    // LEGACY SUPPORT : 'days' -> utilise dailyData
    if (granularity === 'days' && dailyData && dailyData.length > 0) return dailyData;
    
    // NOUVEAU : Si granularity est une résolution explicite (ex: '1d'), on pourrait
    // vouloir chercher dans un cache spécifique, mais pour l'instant le Worker gère ça.
    
    return chartData;
}

export function getField(source, field = 'close') {
    return source.map(d => d ? d[field] : null);
}

export function wrapOutput(chartData, source, resultArr, granularity) {
    // Cas 1 : Intraday sur Intraday (1 pour 1)
    if (granularity === 'data' || source === chartData) {
        return formatSeries(chartData, resultArr);
    }

    // Cas 2 : Daily sur Intraday (Mapping par date)
    const map = new Map();
    for (let i = 0; i < source.length; i++) {
        if (resultArr[i] !== null && source[i].date) {
            const dateStr = source[i].date.split('T')[0];
            map.set(dateStr, resultArr[i]);
        }
    }
    
    return formatSeries(chartData, map);
}