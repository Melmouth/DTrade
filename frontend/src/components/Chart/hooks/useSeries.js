/* frontend/src/components/Chart/hooks/useSeries.js */
import { useEffect, useRef, useState } from 'react';
import { useChart } from '../ChartContext';

export function useSeries(SeriesConstructor, data, options = {}, visible = true, onSeriesCreated = null) {
  const { chart } = useChart();
  const seriesRef = useRef(null);
  const [seriesInstance, setSeriesInstance] = useState(null);

  // 1. Cycle de vie : Création / Destruction
  useEffect(() => {
    if (!chart) return;
    
    // Création de la série
    let series = null;
    try {
        series = chart.addSeries(SeriesConstructor, options);
    } catch (e) {
        console.error("[Chart] Failed to create series", e);
        return;
    }

    seriesRef.current = series;
    setSeriesInstance(series);
    
    if (onSeriesCreated) onSeriesCreated(series);

    // FIX CRASH: Initialisation Safe des données
    if (data && Array.isArray(data) && data.length > 0) {
        try {
            // Protection ultime : On vérifie que les données sont valides pour LW Charts
            // Pour LineSeries, il faut 'time' et 'value'. Pour Candle, 'open/high/low/close'.
            // Si une des clés manque, LW charts throw "Value is undefined".
            
            // On check juste le premier point pour la forme, pour la perf
            const first = data[0];
            const isValid = first.time !== undefined && (first.value !== undefined || first.close !== undefined);
            
            if (isValid) {
                series.setData(data);
            } else {
                console.warn("[Chart] Ignored invalid data format at init:", first);
            }
        } catch (e) {
            console.warn("[Chart] Init Data Error (Silent Catch):", e);
        }
    }

    // Cleanup
    return () => {
      if (chart && series) {
        try {
            chart.removeSeries(series);
        } catch(e) { /* ignore cleanup errors */ }
        seriesRef.current = null;
        setSeriesInstance(null);
        if (onSeriesCreated) onSeriesCreated(null);
      }
    };
  }, [chart, SeriesConstructor]); // Re-run uniquement si la classe change

  // 2. Mise à jour Data (Blindée)
  useEffect(() => {
    if (seriesInstance && data && Array.isArray(data) && data.length > 0) {
      try {
        seriesInstance.setData(data);
      } catch (err) {
        // Ce catch empêche l'écran rouge "CRITICAL UI CRASH"
        console.warn("[Chart] Series Update Error (Ignored):", err.message);
      }
    }
  }, [data, seriesInstance]);

  // 3. Mise à jour Options
  useEffect(() => {
    if (seriesInstance) {
        try {
           seriesInstance.applyOptions({ ...options, visible });
        } catch(e) { console.warn(e); }
    }
  }, [options, visible, seriesInstance]);

  return seriesInstance;
}