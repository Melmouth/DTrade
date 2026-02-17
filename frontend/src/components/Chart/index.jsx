/* frontend/src/components/Chart/index.jsx */
import { useEffect, useRef, useState, useMemo } from 'react';
import ChartContext from './ChartContext';
import { useChartInit } from './hooks/useChartInit';

// Components
import Toolbar from './components/Toolbar';
import PriceSeries from './components/PriceSeries';
import VolumeSeries from './components/VolumeSeries';
import Overlays from './components/Overlays';
import RulerTool from './components/RulerTool';
import Legend from './components/Legend';

export default function StockChart({ 
  data, 
  dailyData, 
  loading, 
  activePeriod, 
  onPeriodChange, 
  indicators = [], 
  previewSeries = null, 
  livePrice = null, 
  isMarketOpen = false 
}) {
  const containerRef = useRef(null);
  
  // 1. Initialisation Moteur
  const { chart, isReady } = useChartInit(containerRef);
  
  // 2. État Local UI
  const [chartType, setChartType] = useState('candle');
  
  // --- FIX: État de visibilité complet ---
  const [visibility, setVisibility] = useState({ 
      volume: true, 
      priceLines: true,
      open: true,
      high: true,
      low: true,
      close: true
  });
  
  const [mainSeriesInstance, setMainSeriesInstance] = useState(null);
  // Optionnel : tu pourrais aussi capturer volumeSeriesInstance si besoin pour la légende
  
  // 3. Préparation Data (SANITIZATION ROBUSTE)
  const formattedData = useMemo(() => {
     if (!Array.isArray(data)) return [];

     const clean = data.reduce((acc, d) => {
        if (!d) return acc;
        
        // 1. Normalisation du Time
        let time = d.time;
        
        // Si pas de time unix, on tente de parser la date string
        if ((time === undefined || time === null) && d.date) {
            const parsed = new Date(d.date).getTime();
            // On convertit en secondes (Unix Timestamp)
            if (!Number.isNaN(parsed)) time = parsed / 1000;
        }

        // 2. REJET STRICT : Si le temps est invalide, on jette la bougie.
        // C'est ce qui causait "time=NaN"
        if (time === undefined || time === null || Number.isNaN(time)) {
            return acc;
        }

        // 3. Normalisation des valeurs (Protection contre les nulls qui font crasher le Volume)
        acc.push({
            time: time,
            date: d.date, // Important pour l'hydratation
            open: Number(d.open) || 0,
            high: Number(d.high) || 0,
            low: Number(d.low) || 0,
            close: Number(d.close) || 0,
            // Fallback pour LineSeries
            value: d.value !== undefined ? Number(d.value) : (Number(d.close) || 0),
            // Protection spécifique pour le crash "Value is null" du Volume
            volume: d.volume !== undefined && d.volume !== null ? Number(d.volume) : 0 
        });
        return acc;
     }, []);

     // 4. TRI STRICT (Vital pour "must be asc ordered")
     // On dédoublonne aussi par sécurité si deux bougies ont la même seconde
     const uniqueMap = new Map();
     clean.forEach(item => uniqueMap.set(item.time, item));
     
     return Array.from(uniqueMap.values()).sort((a, b) => a.time - b.time);
  }, [data]);

  // 4. Indicators Merge (FUSION INTELLIGENTE)
  const allIndicators = useMemo(() => {
    if (!previewSeries) return indicators;
    const isEditingExisting = indicators.some(i => i.id === previewSeries.id);
    if (isEditingExisting) return indicators.map(i => i.id === previewSeries.id ? previewSeries : i);
    return [...indicators, previewSeries];
  }, [indicators, previewSeries]);

  // 5. Zoom
  const prevPeriodRef = useRef(activePeriod);
  useEffect(() => {
    if (isReady && chart && formattedData.length > 0) {
        if (activePeriod !== prevPeriodRef.current || formattedData.length < 100) {
           chart.timeScale().fitContent(); 
           prevPeriodRef.current = activePeriod;
        }
    }
  }, [formattedData.length, activePeriod, isReady, chart]);

  return (
    <div className="flex flex-col w-full h-full bg-[#050505] relative group/chart">
        
        <Toolbar 
            activePeriod={activePeriod} 
            onPeriodChange={onPeriodChange} 
            chartType={chartType}
            onTypeChange={setChartType}
            visibility={visibility}
            onToggleVisibility={(k) => setVisibility(prev => ({...prev, [k]: !prev[k]}))}
        />

        <div className="flex-1 relative w-full h-full">
            {loading && (
              <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2">
                <div className="w-16 h-0.5 bg-slate-800 overflow-hidden">
                    <div className="h-full bg-neon-blue animate-[loading_1s_ease-in-out_infinite]"></div>
                </div>
                <span className="text-[10px] text-neon-blue font-mono tracking-[0.2em] animate-pulse">DECRYPTING_DATA</span>
              </div>
            )}

            <div ref={containerRef} className="w-full h-full cursor-crosshair" />
            
            {isReady && (
                <ChartContext.Provider value={{ chart }}>
                    
                    <PriceSeries 
                        data={formattedData} 
                        type={chartType} 
                        livePrice={livePrice} 
                        isMarketOpen={isMarketOpen}
                        visible={true}
                        priceLineVisible={visibility.priceLines}
                        onSeriesReady={setMainSeriesInstance}
                    />
                    
                    <VolumeSeries 
                        data={formattedData} 
                        visible={visibility.volume} 
                    />

                    <Overlays 
                        indicators={allIndicators} 
                        chartData={formattedData} 
                        dailyData={dailyData}
                        activePeriod={activePeriod} // <--- TRÈS IMPORTANT pour le filtrage RBI 
                        priceLineVisible={visibility.priceLines}
                    />

                    {mainSeriesInstance && (
                        <>
                            <Legend 
                                mainSeries={mainSeriesInstance} 
                                volumeSeries={null} 
                                chartType={chartType}
                                visibleFields={visibility} 
                                visible={true}
                            />
                            <RulerTool mainSeries={mainSeriesInstance} />
                        </>
                    )}
                    
                </ChartContext.Provider>
            )}
        </div>
    </div>
  );
}