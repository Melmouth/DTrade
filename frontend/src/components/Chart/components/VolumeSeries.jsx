import { useMemo } from 'react';
import { HistogramSeries } from 'lightweight-charts';
import { useSeries } from '../hooks/useSeries';

export default function VolumeSeries({ data, visible = true }) {
    
    const volumeData = useMemo(() => {
        if (!Array.isArray(data)) return [];

        return data
            .filter(d => d.time !== undefined && !Number.isNaN(d.time)) // Filtre temps
            .map(d => {
                const isUp = d.close >= d.open;
                // Protection ultime contre le crash "Value is null"
                const vol = (d.volume === null || d.volume === undefined || Number.isNaN(d.volume)) 
                    ? 0 
                    : Number(d.volume);

                return {
                    time: d.time,
                    value: vol, 
                    color: isUp ? 'rgba(0, 255, 65, 0.15)' : 'rgba(255, 0, 60, 0.15)',
                };
            });
    }, [data]);

    useSeries(HistogramSeries, volumeData, {
        priceFormat: { type: 'volume' },
        priceScaleId: '', 
        scaleMargins: { top: 0.8, bottom: 0 },
    }, visible);

    return null;
}