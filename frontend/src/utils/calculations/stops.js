import { calc_atr_array } from './core';
import { getSource, getField, wrapOutput } from './formatters';

// 16. SUPERTREND
export function calculateSuperTrend(chartData, dailyData, factor, period = 10, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source?.length) return []; 
    
    const highs = getField(source, 'high');
    const lows = getField(source, 'low');
    const closes = getField(source, 'close');
    
    const atr = calc_atr_array(highs, lows, closes, period);
    const res = [null]; 
    
    let trend = 1;
    let upperBand = 0, lowerBand = 0;

    for(let i=1; i<source.length; i++) {
        if (atr[i] === null) { res.push(null); continue; }
        
        const hl2 = (highs[i] + lows[i]) / 2;
        const basicUpper = hl2 + factor * atr[i];
        const basicLower = hl2 - factor * atr[i];
        
        const prevUpper = upperBand;
        const prevLower = lowerBand;
        const prevClose = closes[i-1];
        
        if (basicUpper < prevUpper || prevClose > prevUpper) upperBand = basicUpper;
        else upperBand = prevUpper;
        
        if (basicLower > prevLower || prevClose < prevLower) lowerBand = basicLower;
        else lowerBand = prevLower;
        
        if (trend === 1 && closes[i] < lowerBand) trend = -1;
        else if (trend === -1 && closes[i] > upperBand) trend = 1;
        
        if (trend === 1) res.push(lowerBand);
        else res.push(upperBand);
    }
    return wrapOutput(chartData, source, res, granularity);
}

// 17. PARABOLIC SAR
export function calculatePSAR(chartData, dailyData, step, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source?.length) return [];
    
    const highs = getField(source, 'high');
    const lows = getField(source, 'low');
    const res = [];
    
    let isLong = true;
    let af = step;
    let maxAf = 0.2;
    let ep = highs[0];
    let sar = lows[0];
    
    res.push(sar);
    
    for(let i=1; i<source.length; i++) {
        let nextSar = sar + af * (ep - sar);
        
        if (isLong) {
            if (i >= 1) nextSar = Math.min(nextSar, lows[i-1]);
            if (i >= 2) nextSar = Math.min(nextSar, lows[i-2]);
        } else {
            if (i >= 1) nextSar = Math.max(nextSar, highs[i-1]);
            if (i >= 2) nextSar = Math.max(nextSar, highs[i-2]);
        }
        
        let reversed = false;
        if (isLong) {
            if (lows[i] < nextSar) {
                isLong = false; reversed = true;
                nextSar = ep;
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
    return wrapOutput(chartData, source, res, granularity);
}

// 18. CHANDELIER EXIT
export function calculateChandelier(chartData, dailyData, factor, period = 22, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source?.length) return [];
    
    const highs = getField(source, 'high');
    const closes = getField(source, 'close');
    const atr = calc_atr_array(highs, getField(source, 'low'), closes, period);
    const res = [];
    
    for(let i=0; i<source.length; i++) {
        if(i < period - 1) { res.push(null); continue; }
        let maxH = -Infinity;
        for(let j=0; j<period; j++) {
            if (highs[i-j] > maxH) maxH = highs[i-j];
        }
        res.push(maxH - (atr[i] * factor));
    }
    return wrapOutput(chartData, source, res, granularity);
}