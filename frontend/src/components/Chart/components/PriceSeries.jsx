/* frontend/src/components/Chart/components/PriceSeries.jsx */
import { useEffect, useRef } from 'react';
import { CandlestickSeries, LineSeries } from 'lightweight-charts';
import { useSeries } from '../hooks/useSeries';

export default function PriceSeries({ 
    data, 
    type = 'candle', 
    livePrice, 
    isMarketOpen, 
    visible = true,
    priceLineVisible = true,
    onSeriesReady // Callback pour remonter l'instance au parent (pour Ruler)
}) {
    // Choix du constructeur dynamique
    const Constructor = type === 'candle' ? CandlestickSeries : LineSeries;
    
    // Options dynamiques
    const options = type === 'candle' ? {
        upColor: '#00ff41', borderUpColor: '#00ff41', wickUpColor: '#00ff41',
        downColor: '#ff003c', borderDownColor: '#ff003c', wickDownColor: '#ff003c',
        priceLineVisible, lastValueVisible: true,
    } : {
        color: '#00f3ff', lineWidth: 2,
        priceLineVisible, lastValueVisible: true,
    };

    const series = useSeries(Constructor, data, options, visible, onSeriesReady);
    
    // --- LIVE UPDATE LOGIC ---
    const lastCandleRef = useRef(null);
    
    // Sync du dernier état connu quand la data change (changement de période ou load initial)
    useEffect(() => {
        if (data.length > 0) {
            lastCandleRef.current = { ...data[data.length - 1] };
        }
    }, [data]);

    // Tick par tick
    useEffect(() => {
        if (!series || !livePrice || !isMarketOpen || !lastCandleRef.current) return;

        const current = lastCandleRef.current;
        const safePrice = Number(livePrice);
        
        // Construction de la bougie mise à jour
        const updated = {
            ...current,
            close: safePrice,
            high: Math.max(Number(current.high !== undefined ? current.high : current.value), safePrice),
            low: Math.min(Number(current.low !== undefined ? current.low : current.value), safePrice),
        };
        
        // Si LineSeries, lightweight-charts attend 'value', si Candle 'close'
        if (type === 'line') updated.value = safePrice;

        series.update(updated);
        lastCandleRef.current = updated;
    }, [livePrice, isMarketOpen, series, type]);

    return null; // Logic component
}