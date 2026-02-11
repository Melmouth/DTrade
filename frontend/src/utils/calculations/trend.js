import { calc_sma_array, calc_ema_array, calc_wma_array } from './core';
import { getSource, getField, wrapOutput } from './formatters';

// 1. SMA
export function calculateSMA(chartData, dailyData, period, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source?.length) return [];
    const closes = getField(source, 'close');
    const res = calc_sma_array(closes, period);
    return wrapOutput(chartData, source, res, granularity);
}

// 2. EMA
export function calculateEMA(chartData, dailyData, period, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source?.length) return [];
    const closes = getField(source, 'close');
    const res = calc_ema_array(closes, period);
    return wrapOutput(chartData, source, res, granularity);
}

// 3. WMA
export function calculateWMA(chartData, dailyData, period, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source?.length) return [];
    const closes = getField(source, 'close');
    const res = calc_wma_array(closes, period);
    return wrapOutput(chartData, source, res, granularity);
}

// 4. HMA
export function calculateHMA(chartData, dailyData, period, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source?.length) return [];
    const closes = getField(source, 'close');
    
    const wmaHalf = calc_wma_array(closes, Math.floor(period / 2));
    const wmaFull = calc_wma_array(closes, period);
    
    const rawHMA = [];
    for(let i=0; i<closes.length; i++) {
        if(wmaHalf[i] !== null && wmaFull[i] !== null) {
            rawHMA.push(2 * wmaHalf[i] - wmaFull[i]);
        } else {
            rawHMA.push(null);
        }
    }

    let firstVal = rawHMA.find(x => x !== null) || 0;
    const cleanRaw = rawHMA.map(x => x === null ? firstVal : x);
    const sqrtP = Math.floor(Math.sqrt(period));
    const finalHMA = calc_wma_array(cleanRaw, sqrtP);
    
    for(let i=0; i<period; i++) finalHMA[i] = null;
    return wrapOutput(chartData, source, finalHMA, granularity);
}

// 5. VWMA
export function calculateVWMA(chartData, dailyData, period, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source?.length) return [];
    const res = [];
    for (let i = 0; i < source.length; i++) {
        if (i < period - 1) { res.push(null); continue; }
        let sumPV = 0, sumV = 0;
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

// 6. DEMA
export function calculateDEMA(chartData, dailyData, period, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source?.length) return [];
    const closes = getField(source, 'close');
    const ema1 = calc_ema_array(closes, period);
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

// 7. TEMA
export function calculateTEMA(chartData, dailyData, period, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source?.length) return [];
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

// 8. ZLEMA
export function calculateZLEMA(chartData, dailyData, period, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source?.length) return [];
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

// 9. KAMA
export function calculateKAMA(chartData, dailyData, period, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source?.length) return [];
    const closes = getField(source, 'close');
    const res = [null]; 
    let kama = closes[0];
    const fast = 2 / (2 + 1);
    const slow = 2 / (30 + 1);

    for (let i = 1; i < closes.length; i++) {
        if (i < period) { res.push(null); kama = closes[i]; continue; }
        const change = Math.abs(closes[i] - closes[i - period]);
        let volatility = 0;
        for(let j=0; j<period; j++) volatility += Math.abs(closes[i-j] - closes[i-j-1]);
        
        const er = volatility === 0 ? 0 : change / volatility;
        const sc = Math.pow(er * (fast - slow) + slow, 2);
        kama = kama + sc * (closes[i] - kama);
        res.push(kama);
    }
    return wrapOutput(chartData, source, res, granularity);
}

// 10. McGinley
export function calculateMcGinley(chartData, dailyData, period, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source?.length) return [];
    const closes = getField(source, 'close');
    const res = [];
    let mcg = closes[0];
    res.push(mcg);

    for(let i=1; i<closes.length; i++) {
        const prev = mcg;
        const price = closes[i];
        const ratio = price / prev;
        const denom = period * Math.pow(ratio, 4);
        mcg = prev + (price - prev) / Math.max(denom, 0.1);
        res.push(mcg);
    }
    return wrapOutput(chartData, source, res, granularity);
}