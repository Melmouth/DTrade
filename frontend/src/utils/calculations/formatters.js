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