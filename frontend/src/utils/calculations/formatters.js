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
        let val = undefined;

        if (isArrayMode) {
            // Mode simple (tableau aligné)
            val = computedData[i];
        } else {
            // Mode Map (Date -> Valeur)
            if (point.date) {
                // On extrait la partie YYYY-MM-DD de la bougie intraday
                const dateKey = point.date.split('T')[0];
                val = computedData.get(dateKey);
            }
        }

        if (val !== undefined && val !== null && !isNaN(val)) {
            // On convertit en timestamp seconde pour Lightweight Charts
            res.push({ time: new Date(point.date).getTime() / 1000, value: val });
        }
    }
    return res;
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
        if (!candle.date) return;
        const candleDateStr = candle.date.split('T')[0];
        const dailyVal = valueMap.get(candleDateStr);

        if (dailyVal) {
            // On utilise le timestamp de la bougie intraday pour l'alignement X
            const time = new Date(candle.date).getTime() / 1000;
            
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

    return hydrated;
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