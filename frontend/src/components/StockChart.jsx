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

// --- CHANGEMENT MAJEUR : ON IMPORTE LE REGISTRE AU LIEU DES FONCTIONS MATHS ---
import { calculateIndicator } from '../indicators/registry';
// --- FIX ZERO-DISCREPANCY : Import du formatter d'hydratation ---
import { hydrateBackendData } from '../utils/calculations/formatters'; 

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

export default function StockChart({ 
  data, 
  dailyData, 
  meta, 
  loading, 
  activePeriod, 
  onPeriodChange, 
  indicators = [], 
  previewSeries = null, 
  livePrice = null, 
  isMarketOpen = false 
}) {
  const chartContainerRef = useRef();
  const chartInstance = useRef(null);
  
  // Références aux séries
  const mainSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const indicatorSeriesRef = useRef(new Map());

  // Ref pour gérer le "Zoom Lock"
  const shouldZoomRef = useRef(true); 
  const prevPeriodRef = useRef(activePeriod);

  // Ref pour le Live Update
  const lastCandleRef = useRef(null);

  // Ref pour l'outil de mesure (Ruler)
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

    // Création initiale de la série Volume (pour ne pas la recréer en boucle)
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
      if (!param.point || !mainSeriesRef.current) return; 

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

      // Ruler Logic
      if (measurementRef.current.active && mainSeriesRef.current && param.point) {
        const currentPrice = mainSeriesRef.current.coordinateToPrice(param.point.y);
        if (currentPrice !== null) {
            const startPrice = measurementRef.current.startPrice;
            const diff = currentPrice - startPrice;
            const pct = (diff / startPrice) * 100;
            const isUp = diff >= 0;
            const color = isUp ? '#00ff41' : '#ff003c'; 

            const lineOptions = {
                price: currentPrice,
                color: color,
                lineWidth: 2,
                lineStyle: 0, 
                axisLabelVisible: true,
                title: `${isUp ? '+' : ''}${diff.toFixed(2)} (${isUp ? '+' : ''}${pct.toFixed(2)}%)`,
            };

            if (measurementRef.current.endLine) {
                measurementRef.current.endLine.applyOptions(lineOptions);
            } else {
                measurementRef.current.endLine = mainSeriesRef.current.createPriceLine(lineOptions);
            }
        }
      }
    });

    // --- GESTION DES CLICS (Mesure) ---
    chart.subscribeClick((param) => {
        if (!param.point || !mainSeriesRef.current) return;

        if (measurementRef.current.removeTimer) {
            clearTimeout(measurementRef.current.removeTimer);
            measurementRef.current.removeTimer = null;
        }

        if (!measurementRef.current.active) {
            const price = mainSeriesRef.current.coordinateToPrice(param.point.y);
            if (price === null) return;

            measurementRef.current.active = true;
            measurementRef.current.startPrice = price;

            measurementRef.current.startLine = mainSeriesRef.current.createPriceLine({
                price: price, color: '#ffffff', lineStyle: 2, lineWidth: 1, axisLabelVisible: true, title: 'MEASURE START',
            });
        } else {
            measurementRef.current.active = false;
            measurementRef.current.removeTimer = setTimeout(() => {
                if (mainSeriesRef.current) {
                    if (measurementRef.current.startLine) try { mainSeriesRef.current.removePriceLine(measurementRef.current.startLine); } catch(e){}
                    if (measurementRef.current.endLine) try { mainSeriesRef.current.removePriceLine(measurementRef.current.endLine); } catch(e){}
                    measurementRef.current.startLine = null;
                    measurementRef.current.endLine = null;
                }
            }, 1500);
        }
    });

    return () => {
      resizeObserver.disconnect();
      if (chartInstance.current) {
        chartInstance.current.remove();
        chartInstance.current = null;
      }
      indicatorSeriesRef.current.clear();
      mainSeriesRef.current = null;
      volumeSeriesRef.current = null;
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

  // --- 3. LOGIC : RENDERING DES DONNÉES (CORRIGÉ & SIMPLIFIÉ) ---
  useEffect(() => {
    // SECURITY CHECK
    if (!chartInstance.current) return;
    if (!Array.isArray(data) || data.length === 0) return;

    const chart = chartInstance.current;

    // 1. PREPARATION DES DONNÉES (SORT ONLY)
    const validData = data
        .filter(d => d.date) // On garde seulement si date existe
        .map(d => ({
            time: new Date(d.date).getTime() / 1000,
            open: Number(d.open) || 0,
            high: Number(d.high) || 0,
            low: Number(d.low) || 0,
            close: Number(d.close) || 0,
            value: Number(d.close) || 0 // Pour le mode Ligne
        }))
        .sort((a, b) => a.time - b.time); // Tri vital pour Lightweight Charts

    const volumeData = validData.map(d => {
        // On retrouve le volume original (car map précédent l'a perdu ou non typé)
        const vol = Number(data.find(x => new Date(x.date).getTime()/1000 === d.time)?.volume || 0);
        return {
            time: d.time,
            value: vol,
            color: d.close >= d.open ? 'rgba(0, 255, 65, 0.15)' : 'rgba(255, 0, 60, 0.15)',
        };
    });

    // A. GESTION SÉRIE PRINCIPALE
    if (mainSeriesRef.current && mainSeriesRef.current._chartType !== chartType) {
        try { chart.removeSeries(mainSeriesRef.current); } catch(e){}
        mainSeriesRef.current = null;
    }

    if (!mainSeriesRef.current) {
        const commonOptions = {
            priceLineVisible: visibility.priceLines,
            lastValueVisible: true,
        };
        if (chartType === 'candle') {
            mainSeriesRef.current = chart.addSeries(CandlestickSeries, {
                ...commonOptions,
                upColor: '#00ff41', borderUpColor: '#00ff41', wickUpColor: '#00ff41',
                downColor: '#ff003c', borderDownColor: '#ff003c', wickDownColor: '#ff003c',
            });
        } else {
            mainSeriesRef.current = chart.addSeries(LineSeries, {
                ...commonOptions,
                color: '#00f3ff', lineWidth: 2, 
            });
        }
        mainSeriesRef.current._chartType = chartType; 
    }

    mainSeriesRef.current.setData(validData);
    if (validData.length > 0) {
        lastCandleRef.current = { ...validData[validData.length - 1] };
    }

    if (volumeSeriesRef.current) {
        volumeSeriesRef.current.setData(volumeData);
        volumeSeriesRef.current.applyOptions({ visible: visibility.volume });
    }

    // B. GESTION INDICATEURS (SIMPLIFIÉE & CORRIGÉE)
    let indicatorsToShow = indicators.filter(i => i.visible !== false);
    const activeIds = new Set(indicatorsToShow.map(i => i.id));
    if (previewSeries) activeIds.add(previewSeries.id);

    // Suppression des vieux indicateurs
    indicatorSeriesRef.current.forEach((val, id) => {
      if (!activeIds.has(id)) {
        try {
            if (Array.isArray(val)) val.forEach(s => chart.removeSeries(s));
            else chart.removeSeries(val);
        } catch (e) { console.warn(e) }
        indicatorSeriesRef.current.delete(id);
      }
    });

    // Helper de dessin
    const renderInd = (ind) => {
        let points = null;

        // --- SOURCE DE DONNÉES ---
        // Cas A : Backend (SBC) - Déjà calculé et stocké dans ind.data
        if (ind.data && (Array.isArray(ind.data) || typeof ind.data === 'object')) {
            // FIX ZERO-DISCREPANCY: On hydrate pour aligner la granularité
            // Si data est sparse (Daily) et chart est dense (Intraday), on crée les steps.
            points = hydrateBackendData(ind.data, data, ind.granularity);
        } 
        // Cas B : Frontend (Preview / Fallback) - Calcul local
        else {
            const config = {
                id: ind.type,
                params: ind.params || { period: ind.param || 20 },
                granularity: ind.granularity || 'days'
            };
            points = calculateIndicator(config, data, dailyData);
        }

        if (!points) return;

        // --- RENDU ---
        let series = indicatorSeriesRef.current.get(ind.id);
        
        // Détection auto si c'est une bande (via style OU structure de données)
        const isBandStructure = !Array.isArray(points) || (points.length > 0 && points[0].upper !== undefined);
        const isBand = ind.style === 'BAND' || isBandStructure;

        // Nettoyage si changement de type
        if (series && Array.isArray(series) !== isBand) {
             (Array.isArray(series) ? series : [series]).forEach(s => chart.removeSeries(s));
             series = null;
             indicatorSeriesRef.current.delete(ind.id);
        }

        const indOptions = {
             priceLineVisible: visibility.priceLines,
             lastValueVisible: true,
             priceLineSource: 1, 
             priceLineStyle: 2, 
        };

        if (isBand) {
             // 1. Initialisation Séries Bandes
             if (!series) {
                 const sUpper = chart.addSeries(LineSeries, { color: ind.color, lineWidth: 1, lineType: 2, priceLineVisible: false, lastValueVisible: false }); 
                 const sLower = chart.addSeries(LineSeries, { color: ind.color, lineWidth: 1, lineType: 2, priceLineVisible: false, lastValueVisible: false }); 
                 const sBasis = chart.addSeries(LineSeries, { color: ind.color, lineWidth: 1, lineStyle: 2, lineVisible: true, ...indOptions }); 
                 series = [sUpper, sLower, sBasis];
                 indicatorSeriesRef.current.set(ind.id, series);
             } else {
                 series.forEach(s => s.applyOptions({ color: ind.color }));
                 series[2].applyOptions({ priceLineVisible: visibility.priceLines });
             }

             // 2. Normalisation des données
             let uData=[], lData=[], bData=[];
             
             if (Array.isArray(points)) {
                 const sorted = [...points].sort((a,b) => a.time - b.time);
                 uData = sorted.map(p => ({ time: p.time, value: p.upper })).filter(p => p.value != null);
                 lData = sorted.map(p => ({ time: p.time, value: p.lower })).filter(p => p.value != null);
                 bData = sorted.map(p => ({ time: p.time, value: p.basis })).filter(p => p.value != null);
             } else {
                 uData = points.upper || [];
                 lData = points.lower || [];
                 bData = points.basis || [];
             }

             series[0].setData(uData);
             series[1].setData(lData);
             series[2].setData(bData);

        } else {
             // 1. Initialisation Série Ligne
             if (!series) {
                 series = chart.addSeries(LineSeries, { 
                   color: ind.color, lineWidth: 2, 
                   crosshairMarkerVisible: false,
                   ...indOptions 
                 });
                 indicatorSeriesRef.current.set(ind.id, series);
             } else {
                 series.applyOptions({ color: ind.color, priceLineVisible: visibility.priceLines });
             }

             // 2. Normalisation
             let lineData = [];
             if (Array.isArray(points)) {
                 lineData = [...points].sort((a,b) => a.time - b.time);
             }
             
             series.setData(lineData);
        }
    };

    // Boucle de rendu
    indicatorsToShow.forEach(renderInd);
    if (previewSeries) renderInd(previewSeries);

    // Zoom Handling
    if (shouldZoomRef.current && validData.length > 0) {
        const totalPoints = validData.length;
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
                    const countYTD = validData.filter(d => d.time >= startOfYear).length;
                    visiblePoints = countYTD > 0 ? countYTD : 252;
                    break;
                case 'max': default: visiblePoints = totalPoints;
            }
        }
        if (totalPoints > visiblePoints && visiblePoints > 0) {
            const fromIndex = totalPoints - visiblePoints;
            const fromTime = validData[fromIndex]?.time;
            const toTime = validData[totalPoints - 1]?.time;
            if (fromTime && toTime) {
                chart.timeScale().setVisibleRange({ from: fromTime, to: toTime });
            }
        } else {
            chart.timeScale().fitContent();
        }
        shouldZoomRef.current = false;
    }

  }, [data, dailyData, chartType, indicators, previewSeries, visibility.priceLines]);

  // --- 4. LOGIC : LIVE UPDATE ---
  useEffect(() => {
    if (!livePrice || isNaN(Number(livePrice)) || !mainSeriesRef.current || !lastCandleRef.current) return;
    if (!isMarketOpen) return; 

    const current = lastCandleRef.current;
    const safePrice = Number(livePrice);
    
    const updatedCandle = {
        ...current,
        close: safePrice,
        high: Math.max(Number(current.high !== undefined ? current.high : current.value), safePrice),
        low: Math.min(Number(current.low !== undefined ? current.low : current.value), safePrice),
    };

    if (chartType === 'line') updatedCandle.value = safePrice;

    mainSeriesRef.current.update(updatedCandle);
    lastCandleRef.current = updatedCandle;

    if (chartType === 'candle') {
        setLegend(prev => ({
            ...prev,
            close: safePrice,
            high: updatedCandle.high,
            low: updatedCandle.low,
            color: safePrice >= updatedCandle.open ? 'text-neon-green' : 'text-neon-red'
        }));
    } else {
        setLegend(prev => ({ ...prev, close: safePrice }));
    }
  }, [livePrice, chartType, isMarketOpen]); 
  
  // Visibility changes for Volume
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