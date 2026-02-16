/* frontend/src/components/Chart/components/VolumeSeries.jsx */
import { useMemo } from 'react';
import { HistogramSeries } from 'lightweight-charts';
import { useSeries } from '../hooks/useSeries';

export default function VolumeSeries({ data, visible = true }) {
    
    // Transformation des données pour le volume (couleur conditonnelle)
    const volumeData = useMemo(() => {
        return data.map(d => {
            // On assume que 'd' contient déjà le volume brut ou qu'on le récupère du store
            // Ici, adaptation selon ton format data (qui semble être aplati)
            const isUp = d.close >= d.open;
            return {
                time: d.time,
                value: d.volume || 0, // Assure-toi que data contient le volume
                color: isUp ? 'rgba(0, 255, 65, 0.15)' : 'rgba(255, 0, 60, 0.15)',
            };
        });
    }, [data]);

    useSeries(HistogramSeries, volumeData, {
        priceFormat: { type: 'volume' },
        priceScaleId: '', // Overlay
        scaleMargins: { top: 0.8, bottom: 0 },
    }, visible);

    return null;
}