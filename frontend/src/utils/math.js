/**
 * ==========================================
 * CORE HELPERS (Data Management)
 * ==========================================
 */

/**
 * Normalise la donnée calculée pour Lightweight Charts.
 * Transforme un Array ou une Map en tableau d'objets { time, value }.
 */
function formatSeries(chartData, computedData) {
    const res = [];
    const isArrayMode = Array.isArray(computedData);

    for (let i = 0; i < chartData.length; i++) {
        const point = chartData[i];
        let val = undefined;

        if (isArrayMode) {
            val = computedData[i];
        } else {
            if (point.date) {
                const dateKey = point.date.split('T')[0];
                val = computedData.get(dateKey);
            }
        }

        if (val !== undefined && val !== null && !isNaN(val)) {
            res.push({ time: new Date(point.date).getTime() / 1000, value: val });
        }
    }
    return res;
}

/**
 * Sélectionne la source (Intraday vs Daily).
 */
function getSource(chartData, dailyData, granularity) {
    if (granularity === 'data') return chartData;
    return dailyData;
}

/**
 * Extrait un tableau simple d'une propriété (ex: 'close') de la source.
 */
function getField(source, field = 'close') {
    return source.map(d => d ? d[field] : null);
}

/**
 * ==========================================
 * MATH HELPERS (Internal Calculation Logic)
 * ==========================================
 */

// Moyenne Mobile Simple (Raw Array)
function calc_sma_array(data, period) {
    const res = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) { res.push(null); continue; }
        let sum = 0;
        for (let j = 0; j < period; j++) sum += data[i - j];
        res.push(sum / period);
    }
    return res;
}

// Moyenne Mobile Exponentielle (Raw Array)
function calc_ema_array(data, period) {
    const res = [];
    const k = 2 / (period + 1);
    let ema = data[0];
    for (let i = 0; i < data.length; i++) {
        if (data[i] === null) { res.push(null); continue; }
        ema = data[i] * k + ema * (1 - k);
        res.push(i >= period - 1 ? ema : null);
    }
    return res;
}

// Moyenne Mobile Pondérée (WMA)
function calc_wma_array(data, period) {
    const res = [];
    const denom = (period * (period + 1)) / 2;
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) { res.push(null); continue; }
        let sum = 0;
        for (let j = 0; j < period; j++) {
            // Poids : j=0 (actuel) -> p, j=1 -> p-1...
            // Formule WMA: (P1*1 + P2*2 + ... + Pn*n) / denom
            // Ici boucle arrière: data[i] a poids 'period', data[i-1] a poids 'period-1'
            sum += data[i - j] * (period - j);
        }
        res.push(sum / denom);
    }
    return res;
}

// True Range (TR)
function calc_tr_array(highs, lows, closes) {
    const res = [highs[0] - lows[0]]; // Premier TR
    for (let i = 1; i < highs.length; i++) {
        const h = highs[i];
        const l = lows[i];
        const pc = closes[i - 1];
        const val = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
        res.push(val);
    }
    return res;
}

// Average True Range (ATR) - Basé sur RMA (Wilder)
function calc_atr_array(highs, lows, closes, period) {
    const tr = calc_tr_array(highs, lows, closes);
    // ATR Wilder est une EMA lissée (alpha = 1/n)
    const res = [];
    let val = tr[0]; // Seed simple
    const alpha = 1 / period;
    
    for (let i = 0; i < tr.length; i++) {
        val = (tr[i] - val) * alpha + val;
        res.push(i >= period ? val : null);
    }
    return res;
}

// Standard Deviation (Rolling)
function calc_std_array(data, period, smaArray) {
    const res = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) { res.push(null); continue; }
        const avg = smaArray[i];
        let sumSq = 0;
        for (let j = 0; j < period; j++) {
            sumSq += Math.pow(data[i - j] - avg, 2);
        }
        res.push(Math.sqrt(sumSq / period));
    }
    return res;
}

/**
 * Helper générique pour mapper un résultat brut (Array) vers le format de sortie (Map ou Array)
 */
function wrapOutput(chartData, source, resultArr, granularity) {
    if (granularity === 'data') {
        return formatSeries(chartData, resultArr);
    }
    // Days : Convertir Array -> Map(Date -> Val)
    const map = new Map();
    for (let i = 0; i < source.length; i++) {
        if (resultArr[i] !== null) {
            map.set(source[i].raw_date, resultArr[i]);
        }
    }
    return formatSeries(chartData, map);
}

/**
 * ==========================================
 * EXPORTED INDICATORS
 * ==========================================
 */

// 1. SMA
export function calculateSMA(chartData, dailyData, period, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source || !source.length) return [];
    const closes = getField(source, 'close');
    const res = calc_sma_array(closes, period);
    return wrapOutput(chartData, source, res, granularity);
}

// 2. EMA
export function calculateEMA(chartData, dailyData, period, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source || !source.length) return [];
    const closes = getField(source, 'close');
    const res = calc_ema_array(closes, period);
    return wrapOutput(chartData, source, res, granularity);
}

// 3. WMA (Weighted)
export function calculateWMA(chartData, dailyData, period, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source || !source.length) return [];
    const closes = getField(source, 'close');
    const res = calc_wma_array(closes, period);
    return wrapOutput(chartData, source, res, granularity);
}

// 4. HMA (Hull)
export function calculateHMA(chartData, dailyData, period, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source || !source.length) return [];
    const closes = getField(source, 'close');
    
    // 1. WMA(n/2)
    const wmaHalf = calc_wma_array(closes, Math.floor(period / 2));
    // 2. WMA(n)
    const wmaFull = calc_wma_array(closes, period);
    
    // 3. Raw HMA = 2 * WMA(n/2) - WMA(n)
    const rawHMA = [];
    for(let i=0; i<closes.length; i++) {
        if(wmaHalf[i] !== null && wmaFull[i] !== null) {
            rawHMA.push(2 * wmaHalf[i] - wmaFull[i]);
        } else {
            rawHMA.push(null);
        }
    }

    // 4. WMA(sqrt(n)) on Raw
    const sqrtP = Math.floor(Math.sqrt(period));
    // Attention: rawHMA contient des null au début, calc_wma_array doit gérer ça (ici ça glisse)
    // On remplace les null par 0 ou on slice ? Simplification : on passe le rawHMA tel quel.
    // Pour être propre, on devrait ignorer les nulls du début, mais JS gère mal.
    // Hack: On remplit les nulls initiaux par la première valeur valide pour le calcul suivant
    let firstVal = rawHMA.find(x => x !== null) || 0;
    const cleanRaw = rawHMA.map(x => x === null ? firstVal : x);
    
    const finalHMA = calc_wma_array(cleanRaw, sqrtP);
    
    // Remettre les nulls initiaux (environ Period + Sqrt(Period))
    for(let i=0; i<period; i++) finalHMA[i] = null;

    return wrapOutput(chartData, source, finalHMA, granularity);
}

// 5. VWMA (Volume Weighted)
export function calculateVWMA(chartData, dailyData, period, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source || !source.length) return [];
    const res = [];
    
    for (let i = 0; i < source.length; i++) {
        if (i < period - 1) { res.push(null); continue; }
        let sumPV = 0;
        let sumV = 0;
        for (let j = 0; j < period; j++) {
            const p = source[i - j].close;
            const v = source[i - j].volume || 0;
            sumPV += p * v;
            sumV += v;
        }
        res.push(sumV === 0 ? null : sumPV / sumV);
    }
    return wrapOutput(chartData, source, res, granularity);
}

// 6. DEMA (Double EMA)
export function calculateDEMA(chartData, dailyData, period, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source || !source.length) return [];
    const closes = getField(source, 'close');

    const ema1 = calc_ema_array(closes, period);
    // On doit nettoyer ema1 des nulls pour calculer ema2 correctement
    let first = ema1.find(x => x !== null) || 0;
    const cleanEma1 = ema1.map(x => x === null ? first : x);
    
    const ema2 = calc_ema_array(cleanEma1, period);
    
    const res = [];
    for(let i=0; i<closes.length; i++) {
        if(ema1[i] === null || ema2[i] === null) res.push(null);
        else res.push(2 * ema1[i] - ema2[i]);
    }
    return wrapOutput(chartData, source, res, granularity);
}

// 7. TEMA (Triple EMA)
export function calculateTEMA(chartData, dailyData, period, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source || !source.length) return [];
    const closes = getField(source, 'close');

    const ema1 = calc_ema_array(closes, period);
    let first = ema1.find(x => x !== null) || 0;
    const cleanEma1 = ema1.map(x => x === null ? first : x);

    const ema2 = calc_ema_array(cleanEma1, period);
    let first2 = ema2.find(x => x !== null) || 0;
    const cleanEma2 = ema2.map(x => x === null ? first2 : x);

    const ema3 = calc_ema_array(cleanEma2, period);

    const res = [];
    for(let i=0; i<closes.length; i++) {
        if(ema1[i] === null || ema2[i] === null || ema3[i] === null) res.push(null);
        else res.push(3 * ema1[i] - 3 * ema2[i] + ema3[i]);
    }
    return wrapOutput(chartData, source, res, granularity);
}

// 8. ZLEMA (Zero Lag)
export function calculateZLEMA(chartData, dailyData, period, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source || !source.length) return [];
    const closes = getField(source, 'close');
    const lag = Math.floor((period - 1) / 2);
    
    const deLaggedData = [];
    for(let i=0; i<closes.length; i++) {
        const prev = (i - lag >= 0) ? closes[i - lag] : closes[0];
        deLaggedData.push(closes[i] + (closes[i] - prev));
    }
    
    const res = calc_ema_array(deLaggedData, period);
    return wrapOutput(chartData, source, res, granularity);
}

// 9. KAMA (Kaufman Adaptive)
export function calculateKAMA(chartData, dailyData, period, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source || !source.length) return [];
    const closes = getField(source, 'close');
    const res = [];
    
    let kama = closes[0]; // Seed
    res.push(null); 

    const fast = 2 / (2 + 1);
    const slow = 2 / (30 + 1);

    for (let i = 1; i < closes.length; i++) {
        if (i < period) { res.push(null); kama = closes[i]; continue; }

        const change = Math.abs(closes[i] - closes[i - period]);
        let volatility = 0;
        for(let j=0; j<period; j++) {
            volatility += Math.abs(closes[i-j] - closes[i-j-1]);
        }
        
        const er = volatility === 0 ? 0 : change / volatility;
        const sc = Math.pow(er * (fast - slow) + slow, 2);
        
        kama = kama + sc * (closes[i] - kama);
        res.push(kama);
    }
    return wrapOutput(chartData, source, res, granularity);
}

// 10. MCGINLEY DYNAMIC
export function calculateMcGinley(chartData, dailyData, period, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source || !source.length) return [];
    const closes = getField(source, 'close');
    const res = [];
    
    let mcg = closes[0];
    res.push(mcg); // Seed

    for(let i=1; i<closes.length; i++) {
        const prev = mcg;
        const price = closes[i];
        // Formule MD: Prev + (Price - Prev) / (K * (Price/Prev)^4)
        const ratio = price / prev;
        const denom = period * Math.pow(ratio, 4);
        mcg = prev + (price - prev) / Math.max(denom, 0.1); // Avoid div 0
        res.push(mcg);
    }
    return wrapOutput(chartData, source, res, granularity);
}

// --- BANDES & CANAUX ---

// 11. BOLLINGER
export function calculateBollinger(chartData, dailyData, factor, period = 20, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source || !source.length) return { basis: [], upper: [], lower: [] };
    const closes = getField(source, 'close');
    
    const sma = calc_sma_array(closes, period);
    const std = calc_std_array(closes, period, sma);
    
    const upper = [], lower = [];
    for(let i=0; i<closes.length; i++) {
        if (sma[i] === null) { upper.push(null); lower.push(null); continue; }
        upper.push(sma[i] + std[i] * factor);
        lower.push(sma[i] - std[i] * factor);
    }
    
    return {
        basis: wrapOutput(chartData, source, sma, granularity),
        upper: wrapOutput(chartData, source, upper, granularity),
        lower: wrapOutput(chartData, source, lower, granularity)
    };
}

// 12. KELTNER CHANNELS (EMA +/- ATR * K)
export function calculateKeltner(chartData, dailyData, factor, period = 20, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source || !source.length) return { basis: [], upper: [], lower: [] };
    
    const closes = getField(source, 'close');
    const highs = getField(source, 'high');
    const lows = getField(source, 'low');
    
    const ema = calc_ema_array(closes, period);
    const atr = calc_atr_array(highs, lows, closes, 10); // ATR Period fixée à 10 souvent pour Keltner
    
    const upper = [], lower = [];
    for(let i=0; i<closes.length; i++) {
        if (ema[i] === null || atr[i] === null) { upper.push(null); lower.push(null); continue; }
        upper.push(ema[i] + atr[i] * factor);
        lower.push(ema[i] - atr[i] * factor);
    }

    return {
        basis: wrapOutput(chartData, source, ema, granularity),
        upper: wrapOutput(chartData, source, upper, granularity),
        lower: wrapOutput(chartData, source, lower, granularity)
    };
}

// 13. DONCHIAN CHANNELS (Min/Max N)
export function calculateDonchian(chartData, dailyData, period, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source || !source.length) return { basis: [], upper: [], lower: [] };
    
    // Note: Donchian parameter 'period' vient souvent de "optimal_k" du backend si mappé ainsi
    const p = Math.floor(period);
    const highs = getField(source, 'high');
    const lows = getField(source, 'low');
    
    const upper = [], lower = [], basis = [];
    
    for(let i=0; i<source.length; i++) {
        if(i < p - 1) { upper.push(null); lower.push(null); basis.push(null); continue; }
        
        let maxH = -Infinity, minL = Infinity;
        for(let j=0; j<p; j++) {
            if(highs[i-j] > maxH) maxH = highs[i-j];
            if(lows[i-j] < minL) minL = lows[i-j];
        }
        upper.push(maxH);
        lower.push(minL);
        basis.push((maxH + minL) / 2);
    }

    return {
        basis: wrapOutput(chartData, source, basis, granularity),
        upper: wrapOutput(chartData, source, upper, granularity),
        lower: wrapOutput(chartData, source, lower, granularity)
    };
}

// 14. REGRESSION (Lineaire - Backend simulé par SMA+StdDev, ici idem pour consistance "Smart")
// On garde le nom "Reg" mais on applique la logique simplifiée pour coller au parametre 'k'
export function calculateReg(chartData, dailyData, factor, period = 20, granularity = 'days') {
    // Exactement comme Bollinger pour le moment car le backend 'smart' optimise le StdDev.
    return calculateBollinger(chartData, dailyData, factor, period, granularity);
}

// 15. STARC BANDS (SMA +/- ATR * K)
export function calculateSTARC(chartData, dailyData, factor, period = 15, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source || !source.length) return { basis: [], upper: [], lower: [] };
    
    const closes = getField(source, 'close');
    const highs = getField(source, 'high');
    const lows = getField(source, 'low');
    
    const sma = calc_sma_array(closes, period);
    const atr = calc_atr_array(highs, lows, closes, period);
    
    const upper = [], lower = [];
    for(let i=0; i<closes.length; i++) {
        if (sma[i] === null || atr[i] === null) { upper.push(null); lower.push(null); continue; }
        upper.push(sma[i] + atr[i] * factor);
        lower.push(sma[i] - atr[i] * factor);
    }

    return {
        basis: wrapOutput(chartData, source, sma, granularity),
        upper: wrapOutput(chartData, source, upper, granularity),
        lower: wrapOutput(chartData, source, lower, granularity)
    };
}

// --- TENDANCE & STOPS ---

// 16. SUPERTREND
export function calculateSuperTrend(chartData, dailyData, factor, period = 10, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source || !source.length) return []; // FIX: return array (was { upper: [] })
    
    const highs = getField(source, 'high');
    const lows = getField(source, 'low');
    const closes = getField(source, 'close');
    
    const atr = calc_atr_array(highs, lows, closes, period);
    const res = [];
    
    // Etats initiaux
    let trend = 1; // 1 = Up, -1 = Down
    let upperBand = 0, lowerBand = 0;
    
    // Seed
    res.push(null);

    for(let i=1; i<source.length; i++) {
        if (atr[i] === null) { res.push(null); continue; }
        
        const hl2 = (highs[i] + lows[i]) / 2;
        const basicUpper = hl2 + factor * atr[i];
        const basicLower = hl2 - factor * atr[i];
        
        const prevUpper = upperBand;
        const prevLower = lowerBand;
        const prevClose = closes[i-1];
        
        // Logic SuperTrend
        if (basicUpper < prevUpper || prevClose > prevUpper) upperBand = basicUpper;
        else upperBand = prevUpper;
        
        if (basicLower > prevLower || prevClose < prevLower) lowerBand = basicLower;
        else lowerBand = prevLower;
        
        let prevTrend = trend;
        if (trend === 1 && closes[i] < lowerBand) trend = -1;
        else if (trend === -1 && closes[i] > upperBand) trend = 1;
        
        // Resultat : Si Trend Up -> LowerBand (Support), Si Trend Down -> UpperBand (Resistance)
        if (trend === 1) res.push(lowerBand);
        else res.push(upperBand);
    }
    
    // FIX: Retourne directement le tableau (au lieu de { basis: ... })
    return wrapOutput(chartData, source, res, granularity);
}

// 17. PARABOLIC SAR
export function calculatePSAR(chartData, dailyData, step, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source || !source.length) return []; // FIX: return array (was { basis: [] })
    
    const highs = getField(source, 'high');
    const lows = getField(source, 'low');
    const res = [];
    
    // Init simple
    let isLong = true;
    let af = step;
    let maxAf = 0.2; // Standard hardcodé ou param ? Standard.
    let ep = highs[0]; // Extreme Point
    let sar = lows[0];
    
    res.push(sar);
    
    for(let i=1; i<source.length; i++) {
        // Calcul du SAR de demain
        let nextSar = sar + af * (ep - sar);
        
        // Contraintes (SAR ne doit pas dépasser les prix d'hier)
        if (isLong) {
            if (i >= 1) nextSar = Math.min(nextSar, lows[i-1]);
            if (i >= 2) nextSar = Math.min(nextSar, lows[i-2]);
        } else {
            if (i >= 1) nextSar = Math.max(nextSar, highs[i-1]);
            if (i >= 2) nextSar = Math.max(nextSar, highs[i-2]);
        }
        
        // Renversement ?
        let reversed = false;
        if (isLong) {
            if (lows[i] < nextSar) {
                isLong = false; reversed = true;
                nextSar = ep; // Le SAR devient l'ancien EP
                ep = lows[i];
                af = step;
            }
        } else {
            if (highs[i] > nextSar) {
                isLong = true; reversed = true;
                nextSar = ep;
                ep = highs[i];
                af = step;
            }
        }
        
        if (!reversed) {
            // Update AF et EP
            if (isLong) {
                if (highs[i] > ep) {
                    ep = highs[i];
                    af = Math.min(af + step, maxAf);
                }
            } else {
                if (lows[i] < ep) {
                    ep = lows[i];
                    af = Math.min(af + step, maxAf);
                }
            }
        }
        
        sar = nextSar;
        res.push(sar);
    }
    
    // FIX: Retourne directement le tableau
    return wrapOutput(chartData, source, res, granularity);
}

// 18. CHANDELIER EXIT
export function calculateChandelier(chartData, dailyData, factor, period = 22, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source || !source.length) return []; // FIX: return array (was { basis: [] })
    
    const highs = getField(source, 'high');
    const lows = getField(source, 'low');
    const closes = getField(source, 'close');
    
    const atr = calc_atr_array(highs, lows, closes, period);
    const res = [];
    
    for(let i=0; i<source.length; i++) {
        if(i < period - 1) { res.push(null); continue; }
        
        // Highest High sur la période
        let maxH = -Infinity;
        for(let j=0; j<period; j++) {
            if (highs[i-j] > maxH) maxH = highs[i-j];
        }
        
        // Long Stop = MaxHigh - ATR * Factor
        res.push(maxH - (atr[i] * factor));
    }
    
    // FIX: Retourne directement le tableau
    return wrapOutput(chartData, source, res, granularity);
}

// === OLD COMPATIBILITY (Wrappers) ===
// On garde calculateEnvelope existant s'il était utilisé spécifiquement, 
// mais ici on a tout refait. Pour assurer la compat, on réexporte.
export function calculateEnvelope(chartData, dailyData, factor, period = 20, granularity = 'days') {
   // Envelope = SMA +/- %
   const source = getSource(chartData, dailyData, granularity);
   if (!source || !source.length) return { basis: [], upper: [], lower: [] };
   const closes = getField(source, 'close');
   const sma = calc_sma_array(closes, period);
   const k = factor / 100;
   
   const upper = sma.map(v => v === null ? null : v * (1 + k));
   const lower = sma.map(v => v === null ? null : v * (1 - k));
   
   return {
       basis: wrapOutput(chartData, source, sma, granularity),
       upper: wrapOutput(chartData, source, upper, granularity),
       lower: wrapOutput(chartData, source, lower, granularity)
   };
}