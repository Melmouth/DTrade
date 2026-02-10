// frontend/src/utils/math.js

/**
 * Helper: Normalise la donnée calculée pour le graphique (Lightweight Charts).
 * Gère deux cas :
 * 1. Mode 'data' (Array) : Alignement strict par index.
 * 2. Mode 'days' (Map)  : Alignement par date calendaire (YYYY-MM-DD).
 */
function formatSeries(chartData, computedData) {
    const res = [];
    
    // Détection du type de source : Array (pour 'data') ou Map (pour 'days')
    const isArrayMode = Array.isArray(computedData);

    for (let i = 0; i < chartData.length; i++) {
        const point = chartData[i];
        let val = undefined;

        if (isArrayMode) {
            // Mode Intraday/Data : on prend l'index direct
            val = computedData[i];
        } else {
            // Mode Daily : on cherche la clé date
            // Note : point.date est au format ISO complet, on veut YYYY-MM-DD
            if (point.date) {
                const dateKey = point.date.split('T')[0];
                val = computedData.get(dateKey);
            }
        }

        // On ne pousse que les valeurs valides (Lightweight charts n'aime pas les NaN/undefined dans les séries simples)
        if (val !== undefined && val !== null && !isNaN(val)) {
            res.push({ time: new Date(point.date).getTime() / 1000, value: val });
        }
    }
    return res;
}

/**
 * Sélectionne la source de données selon la granularité.
 * @param {Array} chartData - Données affichées (Timeframe courant).
 * @param {Array} dailyData - Données journalières (Reference).
 * @param {string} granularity - 'days' (défaut) ou 'data'.
 */
function getSource(chartData, dailyData, granularity) {
    if (granularity === 'data') return chartData;
    // Par défaut ou si 'days', on utilise dailyData
    return dailyData;
}

// === SMA (Simple Moving Average) ===
export function calculateSMA(chartData, dailyData, period, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    // Sécurité : Forcer la période en entier pour éviter les crashs d'index (ex: arr[12.5])
    const p = Math.floor(period);

    if (!source || source.length === 0 || p <= 0) return [];

    // --- Mode DATA (Intraday / Chart based) ---
    if (granularity === 'data') {
        const result = [];
        for (let i = 0; i < source.length; i++) {
            // Pas assez de données pour calculer la moyenne
            if (i < p - 1) { 
                result.push(null); 
                continue; 
            }
            
            let sum = 0;
            // Sécurité supplémentaire sur la boucle
            for (let j = 0; j < p; j++) {
                const item = source[i - j];
                if (item) sum += item.close;
            }
            result.push(sum / p);
        }
        return formatSeries(chartData, result);
    }

    // --- Mode DAYS (Daily fixed) ---
    const smaMap = new Map();
    for (let i = p - 1; i < source.length; i++) {
        let sum = 0;
        for (let j = 0; j < p; j++) {
            const item = source[i - j];
            if (item) sum += item.close;
        }
        smaMap.set(source[i].raw_date, sum / p);
    }
    return formatSeries(chartData, smaMap);
}
// === EMA (Exponential Moving Average) ===
export function calculateEMA(chartData, dailyData, period, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source || source.length === 0) return [];

    const k = 2 / (period + 1);

    // --- Mode DATA (Intraday / Chart based) ---
    if (granularity === 'data') {
        const result = [];
        let ema = source[0].close; // Seed avec le premier prix
        
        for (let i = 0; i < source.length; i++) {
            const price = source[i].close;
            ema = price * k + ema * (1 - k);
            
            // On commence à afficher seulement après la période pour éviter le bruit du début
            if (i >= period - 1) {
                result.push(ema);
            } else {
                result.push(null);
            }
        }
        return formatSeries(chartData, result);
    }

    // --- Mode DAYS (Daily fixed) ---
    const emaMap = new Map();
    let ema = source[0].close;
    
    for (let i = 0; i < source.length; i++) {
        const price = source[i].close;
        ema = price * k + ema * (1 - k);
        
        if (i >= period) { // Stockage après période de chauffe
             emaMap.set(source[i].raw_date, ema);
        }
    }
    return formatSeries(chartData, emaMap);
}

// === ENVELOPE (Bandes fixes %) ===
export function calculateEnvelope(chartData, dailyData, factor, period = 20, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source || source.length === 0) return [];

    const pct = factor / 100;

    // --- Mode DATA ---
    if (granularity === 'data') {
        const rBasis = [], rUpper = [], rLower = [];
        
        for (let i = 0; i < source.length; i++) {
             if (i < period - 1) { 
                 rBasis.push(null); rUpper.push(null); rLower.push(null); 
                 continue; 
             }
             
             let sum = 0;
             for (let j = 0; j < period; j++) sum += source[i - j].close;
             const sma = sum / period;
             
             rBasis.push(sma);
             rUpper.push(sma * (1 + pct));
             rLower.push(sma * (1 - pct));
        }

        return {
            basis: formatSeries(chartData, rBasis),
            upper: formatSeries(chartData, rUpper),
            lower: formatSeries(chartData, rLower)
        };
    }

    // --- Mode DAYS ---
    const mapUpper = new Map();
    const mapLower = new Map();
    const mapBasis = new Map();

    for (let i = period - 1; i < source.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) sum += source[i - j].close;
        const sma = sum / period;
        
        mapBasis.set(source[i].raw_date, sma);
        mapUpper.set(source[i].raw_date, sma * (1 + pct));
        mapLower.set(source[i].raw_date, sma * (1 - pct));
    }

    return {
        basis: formatSeries(chartData, mapBasis),
        upper: formatSeries(chartData, mapUpper),
        lower: formatSeries(chartData, mapLower)
    };
}

// === BOLLINGER BANDS (Standard Deviation) ===
export function calculateBollinger(chartData, dailyData, factor, period = 20, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source || source.length === 0) return [];

    // --- Mode DATA ---
    if (granularity === 'data') {
        const rBasis = [], rUpper = [], rLower = [];

        for (let i = 0; i < source.length; i++) {
            if (i < period - 1) { 
                rBasis.push(null); rUpper.push(null); rLower.push(null); 
                continue; 
            }

            // 1. Mean
            let sum = 0;
            for (let j = 0; j < period; j++) sum += source[i - j].close;
            const sma = sum / period;
            
            // 2. StdDev
            let sumSq = 0;
            for (let j = 0; j < period; j++) {
                sumSq += Math.pow(source[i - j].close - sma, 2);
            }
            const std = Math.sqrt(sumSq / period);

            rBasis.push(sma);
            rUpper.push(sma + (std * factor));
            rLower.push(sma - (std * factor));
        }

        return {
            basis: formatSeries(chartData, rBasis),
            upper: formatSeries(chartData, rUpper),
            lower: formatSeries(chartData, rLower)
        };
    }

    // --- Mode DAYS ---
    const mapUpper = new Map();
    const mapLower = new Map();
    const mapBasis = new Map();

    for (let i = period - 1; i < source.length; i++) {
        // 1. Mean
        let sum = 0;
        for (let j = 0; j < period; j++) sum += source[i - j].close;
        const sma = sum / period;
        
        // 2. StdDev
        let sumSq = 0;
        for (let j = 0; j < period; j++) {
            sumSq += Math.pow(source[i - j].close - sma, 2);
        }
        const std = Math.sqrt(sumSq / period);

        mapBasis.set(source[i].raw_date, sma);
        mapUpper.set(source[i].raw_date, sma + (std * factor));
        mapLower.set(source[i].raw_date, sma - (std * factor));
    }

    return {
        basis: formatSeries(chartData, mapBasis),
        upper: formatSeries(chartData, mapUpper),
        lower: formatSeries(chartData, mapLower)
    };
}