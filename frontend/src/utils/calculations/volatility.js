import { calc_sma_array, calc_std_array, calc_ema_array, calc_atr_array } from './core';
import { getSource, getField, wrapOutput } from './formatters';

// 11. BOLLINGER
export function calculateBollinger(chartData, dailyData, factor, period = 20, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source?.length) return { basis: [], upper: [], lower: [] };
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

// 12. KELTNER
export function calculateKeltner(chartData, dailyData, factor, period = 20, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source?.length) return { basis: [], upper: [], lower: [] };
    
    const closes = getField(source, 'close');
    const highs = getField(source, 'high');
    const lows = getField(source, 'low');
    
    const ema = calc_ema_array(closes, period);
    const atr = calc_atr_array(highs, lows, closes, 10);
    
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

// 13. DONCHIAN
export function calculateDonchian(chartData, dailyData, period, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source?.length) return { basis: [], upper: [], lower: [] };
    
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

// 14. REGRESSION
export function calculateReg(chartData, dailyData, factor, period = 20, granularity = 'days') {
    return calculateBollinger(chartData, dailyData, factor, period, granularity);
}

// 15. STARC
export function calculateSTARC(chartData, dailyData, factor, period = 15, granularity = 'days') {
    const source = getSource(chartData, dailyData, granularity);
    if (!source?.length) return { basis: [], upper: [], lower: [] };
    
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

// COMPATIBILITÉ ENVELOPE
export function calculateEnvelope(chartData, dailyData, factor, period = 20, granularity = 'days') {
   const source = getSource(chartData, dailyData, granularity);
   if (!source?.length) return { basis: [], upper: [], lower: [] };
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