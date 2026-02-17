/* frontend/src/utils/calculations/formatters.js */

/**
 * ==========================================
 * FORMATTERS & HELPERS
 * ==========================================
 */

export function formatSeries(chartData, computedData) {
    const res = [];
    const isArrayMode = Array.isArray(computedData);

    for (let i = 0; i < chartData.length; i++) {
        const point = chartData[i];

        // SÉCURITÉ : On saute si le point de référence n'a pas de temps valide (déjà nettoyé en amont)
        if (!point || point.time === undefined || Number.isNaN(point.time)) continue;

        let val = undefined;

        if (isArrayMode) {
            // Mode simple (tableau aligné index par index)
            val = computedData[i];
        } else {
            // Mode Map (Date -> Valeur) pour le mapping Daily sur Intraday
            if (point.date) {
                // On extrait la partie YYYY-MM-DD de la bougie intraday
                const dateKey = point.date.split('T')[0];
                val = computedData.get(dateKey);
            }
        }

        // Validation stricte de la valeur ET du temps
        // Lightweight charts accepte null/undefined pour "ne pas dessiner", 
        // mais le temps DOIT être valide et trié.
        if (val !== undefined && val !== null && !isNaN(val)) {
            res.push({ 
                time: point.time, // On utilise le time déjà nettoyé et valide du chartData
                value: val 
            });
        }
    }
    
    // TRI FINAL : Obligatoire pour éviter "Assertion failed: data must be asc ordered"
    return res.sort((a, b) => a.time - b.time);
}

// --- NEW: BACKEND DATA HYDRATION ---
export function hydrateBackendData(backendData, chartData, granularity) {
    // Si pas de données ou Intraday sur Intraday (match 1:1), pas besoin d'hydrater
    if (!backendData || !chartData || granularity !== 'days') {
        return backendData;
    }

    // Si on est ici, on a des données journalières (Backend) à afficher sur un chart Intraday.
    // On doit mapper chaque bougie intraday à la valeur de son jour pour créer un effet d'escalier (Step-Line).
    
    // 1. Détection du format (Bande vs Ligne)
    const isBand = backendData.length > 0 && backendData[0].upper !== undefined;
    
    // 2. Création de Map pour accès O(1)
    // Key = String Date YYYY-MM-DD
    const valueMap = new Map();
    
    backendData.forEach(p => {
        // Backend renvoie des timestamps unix (secondes). 
        // On convertit en string date pour matcher le format YYYY-MM-DD du chartData
        const dateStr = new Date(p.time * 1000).toISOString().split('T')[0];
        valueMap.set(dateStr, p);
    });

    // 3. Projection sur le ChartData (Dense)
    const hydrated = [];

    chartData.forEach(candle => {
        // On sécurise ici aussi l'utilisation de candle.time si dispo
        if (!candle.date && !candle.time) return;
        
        // Si candle.date existe, on l'utilise pour la clé. Sinon fallback (rare)
        const candleDateStr = candle.date ? candle.date.split('T')[0] : new Date(candle.time * 1000).toISOString().split('T')[0];
        const dailyVal = valueMap.get(candleDateStr);

        if (dailyVal) {
            // On utilise le timestamp de la bougie intraday pour l'alignement X
            // Priorité à candle.time qui est déjà un number (secondes) propre
            const time = candle.time !== undefined ? candle.time : new Date(candle.date).getTime() / 1000;
            
            if (isBand) {
                hydrated.push({
                    time: time,
                    upper: dailyVal.upper,
                    lower: dailyVal.lower,
                    basis: dailyVal.basis
                });
            } else {
                hydrated.push({
                    time: time,
                    value: dailyVal.value
                });
            }
        }
    });

    return hydrated.sort((a, b) => a.time - b.time);
}

export function getSource(chartData, dailyData, granularity) {
    // Si l'utilisateur veut du daily, on utilise dailyData (Macro)
    // Sinon on utilise les données affichées (chartData)
    if (granularity === 'days' && dailyData && dailyData.length > 0) return dailyData;
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
    // On crée une Map : "2023-10-25" -> Valeur de l'indicateur
    const map = new Map();
    for (let i = 0; i < source.length; i++) {
        if (resultArr[i] !== null && source[i].date) {
            // IMPORTANT : On s'assure de n'avoir que la date YYYY-MM-DD
            const dateStr = source[i].date.split('T')[0];
            map.set(dateStr, resultArr[i]);
        }
    }
    
    // formatSeries va maintenant chercher dans cette Map pour chaque bougie intraday
    return formatSeries(chartData, map);
}