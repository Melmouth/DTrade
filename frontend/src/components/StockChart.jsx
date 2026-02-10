import { useEffect, useRef, useState } from 'react';
import { 
  createChart, 
  ColorType, 
  CrosshairMode, 
  CandlestickSeries, 
  HistogramSeries,
  LineSeries 
} from 'lightweight-charts';
import { BarChart2, TrendingUp, Zap, MoreHorizontal, Ruler } from 'lucide-react'; 
import { calculateSMA, calculateEMA, calculateEnvelope, calculateBollinger } from '../utils/math';

// --- CONFIGURATION ---
const PERIODS = [
  { label: '1J', value: '1d' },
  { label: '1S', value: '5d' },
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '6M', value: '6mo' },
  { label: 'YTD', value: 'ytd' },
  { label: '1A', value: '1y' },
  { label: '5A', value: '5y' },
  { label: 'MAX', value: 'max' },
];

const TOGGLES_CONFIG = [
  { key: 'open',   label: 'OPN', type: 'legend', tooltip: 'Ouverture' },
  { key: 'high',   label: 'HGH', type: 'legend', tooltip: 'Haut' },
  { key: 'low',    label: 'LOW', type: 'legend', tooltip: 'Bas' },
  { key: 'close',  label: 'CLS', type: 'legend', tooltip: 'Clôture' },
  { key: 'volume', label: 'VOL', type: 'series', tooltip: 'Volume' },
  { key: 'priceLines', label: 'LNS', type: 'ui', icon: MoreHorizontal, tooltip: 'Lignes de prix' },
];

// AJOUT DE LA PROP 'livePrice'
export default function StockChart({ data, dailyData, meta, loading, activePeriod, onPeriodChange, indicators = [], previewSeries = null, livePrice = null }) {
  const chartContainerRef = useRef();
  const chartInstance = useRef(null);
  
  // Références aux séries
  const mainSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const indicatorSeriesRef = useRef(new Map());

  // Ref pour gérer le "Zoom Lock"
  const shouldZoomRef = useRef(true); 
  const prevPeriodRef = useRef(activePeriod);

  // --- NOUVEAU : REF POUR LE LIVE UPDATE ---
  // On stocke la dernière bougie connue pour pouvoir la modifier sans re-fetch
  const lastCandleRef = useRef(null);

  // --- REF POUR L'OUTIL DE MESURE ---
  const measurementRef = useRef({
    active: false,
    startPrice: null,
    startLine: null,
    endLine: null,
    removeTimer: null
  });

  // États UI
  const [chartType, setChartType] = useState('candle');
  const [legend, setLegend] = useState(null);
  
  // Initialisation visibilité
  const [visibility, setVisibility] = useState(() => 
    TOGGLES_CONFIG.reduce((acc, item) => ({ ...acc, [item.key]: true }), {})
  );

  const toggleVisibility = (key) => {
    setVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // --- 1. INITIALISATION DU GRAPHIQUE ---
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#050505' },
        textColor: '#64748b',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        fontSize: 10,
      },
      watermark: { visible: false },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.5)', style: 1 },
        horzLines: { color: 'rgba(30, 41, 59, 0.5)', style: 1 },
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { width: 1, color: '#00f3ff', style: 3, labelBackgroundColor: '#00f3ff' },
        horzLine: { width: 1, color: '#00f3ff', style: 3, labelBackgroundColor: '#00f3ff' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#1e293b',
      },
      rightPriceScale: { borderColor: '#1e293b' },
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '', 
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;
    chartInstance.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current && chartInstance.current) {
        chartInstance.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    // --- GESTION DU CROSSHAIR (Survol) ---
    chart.subscribeCrosshairMove((param) => {
      // 1. Mise à jour Légende
      if (!param.point || !param.time || param.point.x < 0 || param.point.y < 0) return;
      if (!mainSeriesRef.current || !volumeSeriesRef.current) return;

      const mainData = param.seriesData.get(mainSeriesRef.current);
      const volumeData = param.seriesData.get(volumeSeriesRef.current);

      if (mainData) {
        const val = mainData.value !== undefined ? mainData.value : mainData.close;
        const open = mainData.open !== undefined ? mainData.open : val;
        const close = mainData.close !== undefined ? mainData.close : val;
        const high = mainData.high !== undefined ? mainData.high : val;
        const low = mainData.low !== undefined ? mainData.low : val;

        setLegend({
          open, high, low, close,
          volume: volumeData ? volumeData.value : 0,
          color: close >= open ? 'text-neon-green' : 'text-neon-red'
        });
      }

      // 2. GESTION OUTIL DE MESURE (RULER) - Mouse Move
      if (measurementRef.current.active && mainSeriesRef.current) {
        // Convertir coordonnée Y en prix
        const currentPrice = mainSeriesRef.current.coordinateToPrice(param.point.y);
        if (currentPrice === null) return;

        const startPrice = measurementRef.current.startPrice;
        const diff = currentPrice - startPrice;
        const pct = (diff / startPrice) * 100;
        const isUp = diff >= 0;
        const color = isUp ? '#00ff41' : '#ff003c'; // Neon Green / Neon Red

        const lineOptions = {
          price: currentPrice,
          color: color,
          lineWidth: 2,
          lineStyle: 0, // Solid
          axisLabelVisible: true,
          title: `${isUp ? '+' : ''}${diff.toFixed(2)} (${isUp ? '+' : ''}${pct.toFixed(2)}%)`,
        };

        // Création ou Mise à jour de la ligne mouvante
        if (measurementRef.current.endLine) {
           measurementRef.current.endLine.applyOptions(lineOptions);
        } else {
           measurementRef.current.endLine = mainSeriesRef.current.createPriceLine(lineOptions);
        }
      }
    });

    // --- GESTION DES CLICS (Début / Fin de mesure) ---
    chart.subscribeClick((param) => {
        if (!param.point || !mainSeriesRef.current) return;

        // Nettoyage timer précédent si clic rapide
        if (measurementRef.current.removeTimer) {
            clearTimeout(measurementRef.current.removeTimer);
            measurementRef.current.removeTimer = null;
        }

        // CAS 1 : Démarrer la mesure
        if (!measurementRef.current.active) {
            // Nettoyage des anciennes lignes si elles existent encore
            if (measurementRef.current.startLine) {
                try { mainSeriesRef.current.removePriceLine(measurementRef.current.startLine); } catch(e){}
                measurementRef.current.startLine = null;
            }
            if (measurementRef.current.endLine) {
                try { mainSeriesRef.current.removePriceLine(measurementRef.current.endLine); } catch(e){}
                measurementRef.current.endLine = null;
            }

            const price = mainSeriesRef.current.coordinateToPrice(param.point.y);
            if (price === null) return;

            measurementRef.current.active = true;
            measurementRef.current.startPrice = price;

            // Création ligne de départ (Blanche pointillée)
            measurementRef.current.startLine = mainSeriesRef.current.createPriceLine({
                price: price,
                color: '#ffffff',
                lineStyle: 2, // Dotted
                lineWidth: 1,
                axisLabelVisible: true,
                title: 'MEASURE START',
            });
        } 
        // CAS 2 : Arrêter la mesure (Figer + Fade out)
        else {
            measurementRef.current.active = false;
            
            // On laisse les lignes affichées 1.5s puis on supprime
            measurementRef.current.removeTimer = setTimeout(() => {
                if (mainSeriesRef.current) {
                    if (measurementRef.current.startLine) {
                        try { mainSeriesRef.current.removePriceLine(measurementRef.current.startLine); } catch(e){}
                        measurementRef.current.startLine = null;
                    }
                    if (measurementRef.current.endLine) {
                        try { mainSeriesRef.current.removePriceLine(measurementRef.current.endLine); } catch(e){}
                        measurementRef.current.endLine = null;
                    }
                }
            }, 1500);
        }
    });

    // --- FIX CRASH: NETTOYAGE COMPLET ---
    return () => {
      resizeObserver.disconnect();
      if (chartInstance.current) {
        chartInstance.current.remove();
        chartInstance.current = null;
      }
      indicatorSeriesRef.current.clear();
      mainSeriesRef.current = null;
      volumeSeriesRef.current = null;
      // Cleanup mesure
      if (measurementRef.current.removeTimer) clearTimeout(measurementRef.current.removeTimer);
    };
  }, []);

  // --- 2. LOGIC : DETECTER CHANGEMENT DE PÉRIODE ---
  useEffect(() => {
     if (activePeriod !== prevPeriodRef.current) {
         shouldZoomRef.current = true;
         prevPeriodRef.current = activePeriod;
     }
  }, [activePeriod]);

  useEffect(() => {
      if (data.length === 0) shouldZoomRef.current = true;
  }, [data.length]);

  // --- 3. LOGIC : RENDERING DES DONNÉES HISTORIQUES ---
  useEffect(() => {
    if (!chartInstance.current || !data || data.length === 0) return;
    const chart = chartInstance.current;

    // A. MAIN SERIES
    if (mainSeriesRef.current) {
      try { chart.removeSeries(mainSeriesRef.current); } catch (e) { /* ignore */ }
      mainSeriesRef.current = null;
      
      // Reset ref mesure car la série parente est détruite
      measurementRef.current = { active: false, startPrice: null, startLine: null, endLine: null, removeTimer: null };
    }

    const mainData = [];
    const volumeData = [];

    data.forEach((d) => {
      const time = new Date(d.date).getTime() / 1000;
      const isUp = d.close >= d.open;
      volumeData.push({
        time,
        value: d.volume,
        color: isUp ? 'rgba(0, 255, 65, 0.15)' : 'rgba(255, 0, 60, 0.15)',
      });
      if (chartType === 'candle') {
        mainData.push({ time, open: d.open, high: d.high, low: d.low, close: d.close });
      } else {
        mainData.push({ time, value: d.close });
      }
    });

    let newSeries;
    const commonOptions = {
        priceLineVisible: visibility.priceLines,
        lastValueVisible: true,
    };

    if (chartType === 'candle') {
      newSeries = chart.addSeries(CandlestickSeries, {
        ...commonOptions,
        upColor: '#00ff41', borderUpColor: '#00ff41', wickUpColor: '#00ff41',
        downColor: '#ff003c', borderDownColor: '#ff003c', wickDownColor: '#ff003c',
      });
    } else {
      newSeries = chart.addSeries(LineSeries, {
        ...commonOptions,
        color: '#00f3ff', lineWidth: 2, 
        crosshairMarkerVisible: true, crosshairMarkerBackgroundColor: '#00f3ff',
      });
    }

    newSeries.setData(mainData);
    
    // --- INIT LIVE UPDATE REF ---
    // On initialise la référence avec la dernière donnée chargée pour pouvoir faire des deltas
    if (mainData.length > 0) {
        lastCandleRef.current = { ...mainData[mainData.length - 1] };
    }

    if (volumeSeriesRef.current) volumeSeriesRef.current.setData(volumeData);
    mainSeriesRef.current = newSeries;

    // B. INDICATEURS
    let indicatorsToShow = indicators.filter(i => i.visible !== false);
    const activeIds = new Set(indicatorsToShow.map(i => i.id));
    if (previewSeries) activeIds.add(previewSeries.id);

    // FIX SECONDAIRE: Sécurisation de la suppression des séries
    indicatorSeriesRef.current.forEach((val, id) => {
      if (!activeIds.has(id)) {
        try {
            if (Array.isArray(val)) val.forEach(s => chart.removeSeries(s));
            else chart.removeSeries(val);
        } catch (e) {
            console.warn("Cleanup warning for series", id);
        }
        indicatorSeriesRef.current.delete(id);
      }
    });

    const drawIndicator = (id, type, color, calculatedData) => {
         // Cleanup si changement de type
         if (indicatorSeriesRef.current.has(id)) {
            const old = indicatorSeriesRef.current.get(id);
            const wasBand = Array.isArray(old);
            const isBand = type === 'BAND';
            
            if (wasBand !== isBand) {
                try {
                    if (wasBand) old.forEach(s => chart.removeSeries(s));
                    else chart.removeSeries(old);
                } catch(e) { console.warn(e); }
                indicatorSeriesRef.current.delete(id);
            }
         }

         const indOptions = {
             priceLineVisible: visibility.priceLines,
             lastValueVisible: true,
             priceLineSource: 1, 
             priceLineStyle: 2, 
         };

         if (type === 'BAND') {
             let seriesSet = indicatorSeriesRef.current.get(id);
             
             if (!seriesSet) {
                 const sUpper = chart.addSeries(LineSeries, { color: color, lineWidth: 1, lineType: 2, priceLineVisible: false, lastValueVisible: false }); 
                 const sLower = chart.addSeries(LineSeries, { color: color, lineWidth: 1, lineType: 2, priceLineVisible: false, lastValueVisible: false }); 
                 const sBasis = chart.addSeries(LineSeries, { color: color, lineWidth: 1, lineStyle: 2, lineVisible: true, ...indOptions }); 
                 seriesSet = [sUpper, sLower, sBasis];
                 indicatorSeriesRef.current.set(id, seriesSet);
             } else {
                 seriesSet.forEach(s => s.applyOptions({ color: color }));
                 seriesSet[2].applyOptions({ priceLineVisible: visibility.priceLines });
             }

             seriesSet[0].setData(calculatedData.upper);
             seriesSet[1].setData(calculatedData.lower);
             seriesSet[2].setData(calculatedData.basis);

         } else {
             // RENDU LIGNE SIMPLE
             let series = indicatorSeriesRef.current.get(id);
             if (!series) {
                 series = chart.addSeries(LineSeries, { 
                   color: color, lineWidth: 2, 
                   crosshairMarkerVisible: false,
                   ...indOptions 
                 });
                 indicatorSeriesRef.current.set(id, series);
             } else {
                 series.applyOptions({ color: color, priceLineVisible: visibility.priceLines });
             }
             series.setData(calculatedData);
         }
    };

    indicatorsToShow.forEach(ind => {
      if (previewSeries && ind.id === previewSeries.id) return;
      
      const p = ind.param || ind.period;
      // === MODIFICATION ICI : RECUPERATION DE LA GRANULARITE ===
      const gran = ind.granularity || 'days'; 

      let dataPoints;

      // === MODIFICATION ICI : PASSAGE DE 'gran' AUX FONCTIONS ===
      if (ind.type === 'SMA') dataPoints = calculateSMA(data, dailyData, p, gran);
      else if (ind.type === 'EMA') dataPoints = calculateEMA(data, dailyData, p, gran);
      else if (ind.type === 'ENV') dataPoints = calculateEnvelope(data, dailyData, p, 20, gran);
      else if (ind.type === 'BB')  dataPoints = calculateBollinger(data, dailyData, p, 20, gran);
      
      const style = ind.style || (ind.type === 'ENV' || ind.type === 'BB' ? 'BAND' : 'LINE');
      if (dataPoints) drawIndicator(ind.id, style, ind.color, dataPoints);
    });

    if (previewSeries) {
        const style = previewSeries.style || (previewSeries.type === 'ENV' || previewSeries.type === 'BB' ? 'BAND' : 'LINE');
        drawIndicator(previewSeries.id, style, previewSeries.color, previewSeries.data);
    }

    // Legend Update
    if (mainData.length > 0) {
       const last = mainData[mainData.length - 1];
       const val = last.close !== undefined ? last.close : last.value;
       const isUp = (last.close || val) >= (last.open || val);
       setLegend({
         open: last.open || val, high: last.high || val, low: last.low || val, close: val,
         volume: volumeData[volumeData.length-1]?.value || 0,
         color: isUp ? 'text-neon-green' : 'text-neon-red'
       });
    }

  }, [data, dailyData, chartType, indicators, previewSeries, visibility.priceLines]);

  // -----------------------------------------------------------------------
  // 4. LOGIC : LIVE UPDATE (WEBSOCKET INJECTION)
  // -----------------------------------------------------------------------
  useEffect(() => {
    // Si pas de prix, pas de série ou pas de données initiales, on ne fait rien
    if (!livePrice || !mainSeriesRef.current || !lastCandleRef.current) return;

    const current = lastCandleRef.current;
    
    // Création de la bougie mise à jour
    const updatedCandle = {
        ...current,
        // On update le Close
        close: livePrice,
        // On update High/Low si nécessaire
        high: Math.max(current.high !== undefined ? current.high : current.value, livePrice),
        low: Math.min(current.low !== undefined ? current.low : current.value, livePrice),
    };

    // Cas spécifique Line Chart (structure { time, value }) vs Candle Chart
    if (chartType === 'line') {
        updatedCandle.value = livePrice;
    }

    // Mise à jour visuelle immédiate via l'API interne (très performant)
    mainSeriesRef.current.update(updatedCandle);
    
    // Mise à jour de la mémoire pour le prochain tick
    lastCandleRef.current = updatedCandle;

    // Mise à jour de la légende en temps réel
    if (chartType === 'candle') {
        setLegend(prev => ({
            ...prev,
            close: livePrice,
            high: updatedCandle.high,
            low: updatedCandle.low,
            color: livePrice >= updatedCandle.open ? 'text-neon-green' : 'text-neon-red'
        }));
    } else {
        setLegend(prev => ({ ...prev, close: livePrice }));
    }

  }, [livePrice, chartType]);


  // --- 5. LOGIC : ZOOM STRATEGY ---
  useEffect(() => {
    if (!chartInstance.current || !data || data.length === 0) return;
    if (!shouldZoomRef.current) return;

    const chart = chartInstance.current;
    const totalPoints = data.length;
    let visiblePoints = totalPoints; 

    if (meta?.period) {
        switch (meta.period) {
            case '1d': visiblePoints = 80; break;
            case '5d': visiblePoints = 130; break;
            case '1mo': visiblePoints = 22; break;
            case '3mo': visiblePoints = 66; break;
            case '6mo': visiblePoints = 132; break;
            case '1y': visiblePoints = 252; break;
            case '2y': visiblePoints = 504; break;
            case '5y': visiblePoints = 1260; break;
            case 'ytd':
                const currentYear = new Date().getFullYear();
                const startOfYear = new Date(currentYear, 0, 1).getTime() / 1000;
                const countYTD = data.filter(d => (new Date(d.date).getTime() / 1000) >= startOfYear).length;
                visiblePoints = countYTD > 0 ? countYTD : 252;
                break;
            case 'max':
            default: visiblePoints = totalPoints;
        }
    }

    if (totalPoints > visiblePoints && visiblePoints > 0) {
        const fromIndex = totalPoints - visiblePoints;
        const fromTime = new Date(data[fromIndex].date).getTime() / 1000;
        const toTime = new Date(data[totalPoints - 1].date).getTime() / 1000;
        chart.timeScale().setVisibleRange({ from: fromTime, to: toTime });
    } else {
        chart.timeScale().fitContent();
    }

    shouldZoomRef.current = false;

  }, [data, meta]);
  
  useEffect(() => {
    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.applyOptions({ visible: visibility.volume });
    }
  }, [visibility.volume]);

  // --- RENDER ---
  const formatPrice = (p) => p?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatVol = (v) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v/1_000).toFixed(1)}K` : v;

  const renderLegendItem = (key, label, value, colorClass = 'text-slate-500') => {
    if (!visibility[key]) return null;
    return (
      <span className="mr-4 flex items-baseline gap-2">
        <span className="text-[10px] uppercase text-slate-600 font-bold tracking-wider">{label}</span>
        <span className={`font-mono ${colorClass}`}>{value}</span>
      </span>
    );
  };

  return (
    <div className="bg-[#050505] w-full h-[600px] flex flex-col relative group/chart select-none">
       {/* TOOLBAR */}
      <div className="flex flex-wrap justify-between items-center px-2 py-2 border-b border-slate-800 bg-black z-20">
        
        {/* Périodes */}
        <div className="flex items-center">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => onPeriodChange(p.value)}
              className={`
                px-3 py-1 text-[10px] font-bold transition-all duration-300 border border-slate-800 -ml-[1px] first:ml-0
                hover:z-20
                ${activePeriod === p.value 
                  ? 'bg-slate-900 text-neon-blue border-neon-blue shadow-[0_0_8px_rgba(0,243,255,0.2)] z-10' 
                  : 'bg-black text-slate-500 hover:text-white hover:bg-slate-900 hover:border-slate-600'
                }
              `}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          
          {/* Toggles */}
          <div className="flex items-center gap-1">
             {TOGGLES_CONFIG.map((toggle) => {
               if (chartType === 'line' && ['open', 'high', 'low'].includes(toggle.key)) return null;
               const isActive = visibility[toggle.key];
               const Icon = toggle.icon; 

               return (
                 <button
                   key={toggle.key}
                   onClick={() => toggleVisibility(toggle.key)}
                   title={toggle.tooltip}
                   className={`
                     w-6 h-6 flex items-center justify-center text-[10px] font-bold border transition-all duration-300
                     ${isActive 
                       ? 'bg-slate-900 border-neon-blue text-neon-blue shadow-[0_0_5px_rgba(0,243,255,0.2)]' 
                       : 'bg-transparent border-slate-800 text-slate-700 hover:border-slate-500 hover:text-slate-400'
                     }
                   `}
                 >
                   {Icon ? <Icon size={14} /> : toggle.label.charAt(0)}
                 </button>
               )
             })}
          </div>

          {/* Type Graphique */}
          <div className="flex border border-slate-800">
            <button 
              onClick={() => setChartType('candle')}
              className={`p-1.5 transition-all duration-300 ${chartType === 'candle' ? 'bg-slate-800 text-neon-blue shadow-[inset_0_0_5px_rgba(0,243,255,0.2)]' : 'text-slate-600 hover:text-white'}`}
            >
              <BarChart2 size={14} />
            </button>
            <div className="w-[1px] bg-slate-800"></div>
            <button 
              onClick={() => setChartType('line')}
              className={`p-1.5 transition-all duration-300 ${chartType === 'line' ? 'bg-slate-800 text-neon-blue shadow-[inset_0_0_5px_rgba(0,243,255,0.2)]' : 'text-slate-600 hover:text-white'}`}
            >
              <TrendingUp size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* CHART AREA */}
      <div className="flex-1 relative w-full h-full">
        
        {/* LÉGENDE FLOTTANTE */}
        <div className="absolute top-2 left-2 z-10 pointer-events-none font-mono text-xs hidden md:block">
           <div className="flex items-center bg-black/90 backdrop-blur-md px-3 py-1.5 border border-slate-800 shadow-xl">
             <Zap size={12} className="text-neon-orange mr-3 animate-pulse" />
             {chartType === 'candle' ? (
               <>
                 {renderLegendItem('open', 'OPN', formatPrice(legend?.open), legend?.color)}
                 {renderLegendItem('high', 'HGH', formatPrice(legend?.high), legend?.color)}
                 {renderLegendItem('low', 'LOW', formatPrice(legend?.low), legend?.color)}
                 {renderLegendItem('close', 'CLS', formatPrice(legend?.close), legend?.color)}
               </>
             ) : (
               renderLegendItem('close', 'VAL', formatPrice(legend?.close), 'text-neon-blue')
             )}
             
             {visibility.volume && (
                 <span className="text-slate-600 border-l border-slate-800 pl-3 ml-1 flex items-baseline gap-2">
                   <span className="text-[10px] font-bold">VOL</span> 
                   <span className="text-slate-400">{formatVol(legend?.volume)}</span>
                 </span>
             )}
           </div>
        </div>

        {loading && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2">
            <div className="w-16 h-0.5 bg-slate-800 overflow-hidden">
                <div className="h-full bg-neon-blue animate-[loading_1s_ease-in-out_infinite]"></div>
            </div>
            <span className="text-[10px] text-neon-blue font-mono tracking-[0.2em] animate-pulse">DECRYPTING_DATA</span>
          </div>
        )}

        {/* FEEDBACK VISUEL MESURE (Optionnel) */}
        {measurementRef.current?.active && (
           <div className="absolute top-4 right-4 z-40 bg-black/80 border border-slate-700 text-white px-2 py-1 text-[10px] font-mono animate-pulse flex items-center gap-2">
               <Ruler size={12} />
               MEASURING...
           </div>
        )}

        <div ref={chartContainerRef} className="w-full h-full cursor-crosshair" />
      </div>
    </div>
  );
}