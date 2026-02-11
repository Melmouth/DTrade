/**
 * ==========================================
 * MATH CORE (Pure Array Calculations)
 * ==========================================
 */

// Moyenne Mobile Simple
export function calc_sma_array(data, period) {
    const res = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) { res.push(null); continue; }
        let sum = 0;
        for (let j = 0; j < period; j++) sum += data[i - j];
        res.push(sum / period);
    }
    return res;
}

// Moyenne Mobile Exponentielle
export function calc_ema_array(data, period) {
    const res = [];
    const k = 2 / (period + 1);
    // On initialise souvent l'EMA avec la première valeur dispo
    let ema = data[0]; 
    for (let i = 0; i < data.length; i++) {
        if (data[i] === null) { res.push(null); continue; }
        // Si c'est la toute première valeur, ema = data[i]
        // Ici on simplifie en assumant data[0] existe
        ema = data[i] * k + ema * (1 - k);
        res.push(i >= period - 1 ? ema : null);
    }
    return res;
}

// Moyenne Mobile Pondérée (WMA)
export function calc_wma_array(data, period) {
    const res = [];
    const denom = (period * (period + 1)) / 2;
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) { res.push(null); continue; }
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += data[i - j] * (period - j);
        }
        res.push(sum / denom);
    }
    return res;
}

// True Range (TR)
export function calc_tr_array(highs, lows, closes) {
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

// Average True Range (ATR)
export function calc_atr_array(highs, lows, closes, period) {
    const tr = calc_tr_array(highs, lows, closes);
    const res = [];
    let val = tr[0];
    const alpha = 1 / period;
    
    for (let i = 0; i < tr.length; i++) {
        val = (tr[i] - val) * alpha + val;
        res.push(i >= period ? val : null);
    }
    return res;
}

// Standard Deviation (Rolling)
export function calc_std_array(data, period, smaArray) {
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