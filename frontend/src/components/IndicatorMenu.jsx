/* frontend/src/components/IndicatorMenu.jsx */
import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Settings2, Wand2, Palette, Activity, ChevronRight, ChevronLeft, 
  Layers, BarChart3, Zap, Anchor, TrendingUp, ArrowLeft, CalendarClock, LineChart, Cpu 
} from 'lucide-react';
import { marketApi } from '../api/client';
import { getAvailableIndicators, getIndicatorConfig, default as INDICATORS } from '../indicators/registry';
import { useIndicatorWorker } from '../hooks/useIndicatorWorker';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#fda4af', '#fdba74', '#fde047', '#bef264', '#86efac', '#6ee7b7', '#5eead4',
  '#67e8f9', '#7dd3fc', '#93c5fd', '#a5b4fc', '#c4b5fd', '#d8b4fe', '#f0abfc', '#f9a8d4'
];

const CATEGORIES = [
  { id: 'INERTIA', label: 'Inertia', icon: TrendingUp, color: 'text-neon-blue', borderColor: 'group-hover:border-neon-blue/50', desc: 'Trend Following & Momentum', filter: (tags) => tags.includes('Trend') && !tags.includes('Stop') && !tags.includes('Reversal') },
  { id: 'ENERGY', label: 'Energy', icon: Zap, color: 'text-neon-orange', borderColor: 'group-hover:border-neon-orange/50', desc: 'Volatility & Bands', filter: (tags) => tags.includes('Volatility') || tags.includes('Band') },
  { id: 'GRAVITY', label: 'Gravity', icon: Anchor, color: 'text-neon-purple', borderColor: 'group-hover:border-neon-purple/50', desc: 'Stops, Reversals & Exits', filter: (tags) => tags.includes('Stop') || tags.includes('Reversal') }
];

// --- HELPER CRITIQUE : NORMALISATION DES DONNÉES ---
const normalizeData = (data) => {
  if (!Array.isArray(data)) return [];
  return data.map(d => {
    if (d.time !== undefined && !Number.isNaN(Number(d.time))) return d;
    if (d.date) {
       const t = new Date(d.date).getTime() / 1000;
       return { ...d, time: t };
    }
    return d;
  });
};

// --- HELPER RBI : MAPPING VIEW -> RESOLUTION ---
const getResolutionFromPeriod = (period) => {
    if (period === '1d') return '1m';
    if (period === '5d') return '5m';
    if (period === '1mo') return '1h';
    // Si on est en vue macro (3mo+), le "Chart Source" EST du Daily
    if (['3mo', '6mo', 'ytd', '1y', '2y', '5y', 'max'].includes(period)) return '1d';
    return '1d';
};

export default function IndicatorMenu({ ticker, chartData, dailyData, activePeriod, onAddIndicator, onPreview }) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Navigation State
  const [activeCategory, setActiveCategory] = useState(null); 
  const [selectedId, setSelectedId] = useState(null); 
  
  const [mode, setMode] = useState('manual');
  const [loading, setLoading] = useState(false);

  // Form States Dynamiques
  const [color, setColor] = useState('#3b82f6');
  const [customName, setCustomName] = useState('');
  const [formParams, setFormParams] = useState({}); 
  const [granularity, setGranularity] = useState('days'); // 'days' = Macro, 'data' = Intraday
  const [smartTarget, setSmartTarget] = useState(50);
  const [smartLookback, setSmartLookback] = useState(365);

  const calcTimeoutRef = useRef(null);

  // --- OPTIMISATION CRITIQUE : STATIC DATA SNAPSHOT ---
  const staticChartData = useRef([]);
  const staticDailyData = useRef([]);

  useEffect(() => {
      if (isOpen) {
          if (staticChartData.current.length === 0 && chartData.length > 0) {
              staticChartData.current = normalizeData(chartData);
              staticDailyData.current = normalizeData(dailyData);
          }
      } else {
          staticChartData.current = [];
          staticDailyData.current = [];
      }
  }, [isOpen, chartData, dailyData]); 

  const allIndicators = useMemo(() => getAvailableIndicators(), []);

  const filteredIndicators = useMemo(() => {
    if (!activeCategory) return [];
    const catDef = CATEGORIES.find(c => c.id === activeCategory);
    return allIndicators.filter(ind => catDef.filter(ind.tags || []));
  }, [activeCategory, allIndicators]);

  const currentDef = selectedId ? INDICATORS[selectedId] : null;

  const { compute } = useIndicatorWorker();

  // --- EFFET DE PREVIEW (OPTIMISÉ WORKER 40ms) ---
  useEffect(() => {
      if (!isOpen || !selectedId) {
          if (onPreview) onPreview(null);
          return;
      }

      if (!currentDef) return; 

      if (calcTimeoutRef.current) clearTimeout(calcTimeoutRef.current);

      calcTimeoutRef.current = setTimeout(async () => {
          try {
              let cSource = staticChartData.current;
              let dSource = staticDailyData.current;

              if (cSource.length === 0 && chartData.length > 0) {
                  cSource = normalizeData(chartData);
                  staticChartData.current = cSource;
                  dSource = normalizeData(dailyData);
                  staticDailyData.current = dSource;
              }

              if (cSource.length === 0) return;

              // CALCUL RÉSOLUTION POUR LA PREVIEW (FIX RBI)
              // Si mode 'data', on calcule la résolution réelle (ex: 1m) pour que le worker sache quoi faire
              const previewResolution = granularity === 'days' ? '1d' : getResolutionFromPeriod(activePeriod);

              const dataToPreview = await compute(
                  { id: selectedId, params: formParams, granularity, resolution: previewResolution },
                  cSource, 
                  dSource, 
                  true 
              );

              if (dataToPreview && onPreview) {
                  onPreview({
                      id: 'MENU_PREVIEW_TEMP', 
                      type: selectedId,
                      name: customName || currentDef.name,
                      color: color,
                      style: currentDef.type === 'BAND' ? 'BAND' : 'LINE',
                      granularity: granularity,
                      resolution: previewResolution, // Important pour Overlays.jsx
                      params: formParams,
                      data: dataToPreview,
                      isPreview: true,
                      visible: true
                  });
              }
          } catch (e) {
              console.error("Menu Preview Worker Error:", e);
          }
      }, 40);

      return () => { if (calcTimeoutRef.current) clearTimeout(calcTimeoutRef.current); };
  }, [selectedId, formParams, color, granularity, activePeriod, customName, isOpen, compute]);


  const resetMenu = () => {
    setIsOpen(false);
    if (onPreview) onPreview(null); 
    setTimeout(() => {
        setSelectedId(null);
        setActiveCategory(null);
        setFormParams({});
        setMode('manual');
        setGranularity('days');
        setCustomName('');
    }, 200);
  };

  const handleSelectIndicator = (ind) => {
    setSelectedId(ind.id);
    const config = getIndicatorConfig(ind.id);
    setFormParams(config.params);
    setColor(config.color || '#3b82f6');
    setGranularity(config.granularity || 'days');
    if (ind.type === 'BAND') setSmartTarget(80);
    else setSmartTarget(50);
  };

  const handleParamChange = (key, value) => {
    setFormParams(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let finalParams = { ...formParams };
      let displayName = customName;

      if (mode === 'smart') {
        const decimalTarget = smartTarget / 100;
        let res;
        
        if (selectedId === 'SMA') res = await marketApi.calculateSmartSMA(ticker, decimalTarget, smartLookback);
        else if (selectedId === 'EMA') res = await marketApi.calculateSmartEMA(ticker, decimalTarget, smartLookback);
        else if (selectedId === 'ENV') res = await marketApi.calculateSmartEnvelope(ticker, decimalTarget, smartLookback);
        else if (selectedId === 'BB') res = await marketApi.calculateSmartBollinger(ticker, decimalTarget, smartLookback);
        else await new Promise(r => setTimeout(r, 500));

        if(res?.data) {
             if (res.data.optimal_n) finalParams.period = res.data.optimal_n;
             if (res.data.optimal_k) {
                 if(selectedId==='ENV') finalParams.deviation = res.data.optimal_k;
                 else finalParams.stdDev = res.data.optimal_k;
             }
        }
      }

      // --- LOGIQUE RBI : DÉTERMINATION DE LA RÉSOLUTION ---
      // Si l'utilisateur choisit "Chart Source" (data), on fige la résolution actuelle.
      let finalResolution = '1d';

      if (granularity === 'days') {
          finalResolution = '1d';
      } else {
          // Mapping strict : ActivePeriod -> Resolution Stockée
          // C'est ça qui manquait : on capture l'instant T
          switch (activePeriod) {
              case '1d': finalResolution = '1m'; break;
              case '5d': finalResolution = '5m'; break; // ou 15m selon tes préférences
              case '1mo': finalResolution = '1h'; break;
              case '3mo': finalResolution = '1d'; break;
              default: finalResolution = '1d'; // Macro views default to daily
          }
      }

      if (!displayName) {
        const smartTag = mode === 'smart' ? ` [AI ${smartTarget}%]` : '';
        const resTag = granularity === 'days' ? ' (Daily)' : ` (${finalResolution})`;
        const mainParamKey = Object.keys(finalParams)[0]; 
        const mainParamVal = finalParams[mainParamKey];
        displayName = `${currentDef.name} (${mainParamVal})${smartTag}${resTag}`;
      }

      onAddIndicator({
        id: Date.now(),
        type: selectedId,
        style: { 
            color: color, 
            type: currentDef.type === 'BAND' ? 'BAND' : 'LINE' 
        },
        params: finalParams,
        granularity: granularity, 
        resolution: finalResolution, // <--- ENVOI DE LA RÉSOLUTION RÉELLE
        period: activePeriod, // Juste pour info contextuelle
        color: color,
        name: displayName,
        isSmart: mode === 'smart',
        smartParams: mode === 'smart' ? { target: smartTarget, lookback: smartLookback } : null
      });

      resetMenu();
    } catch (err) {
      console.error(err);
      alert("Erreur calcul Smart Indicator");
    } finally {
      setLoading(false);
    }
  };

  // --- SÉLECTEUR DE GRANULARITÉ AMÉLIORÉ ---
  const currentChartRes = getResolutionFromPeriod(activePeriod);

  const GranularitySelector = () => (
    <div className="space-y-2">
        <label className="text-[10px] uppercase text-slate-400 font-bold flex items-center gap-1">
            <Layers size={10} /> Timeframe Source (RBI)
        </label>
        <div className="flex flex-col gap-1.5">
            {/* OPTION MACRO */}
            <button
                type="button"
                onClick={() => setGranularity('days')}
                className={`flex items-center justify-between px-2 py-2 text-[9px] font-bold uppercase transition-all rounded border ${granularity === 'days' ? 'bg-slate-700 border-slate-500 text-white shadow-lg' : 'border-slate-800 text-slate-500 hover:border-slate-600'}`}
            >
                <div className="flex items-center gap-2">
                    <CalendarClock size={12}/> 
                    <div className="flex flex-col items-start leading-none">
                        <span>Daily (Macro)</span>
                        <span className="text-[8px] opacity-60 font-normal mt-0.5">Calculé sur 24h</span>
                    </div>
                </div>
                {granularity === 'days' && <div className="w-1.5 h-1.5 bg-neon-green rounded-full shadow-[0_0_5px_#00ff41]"></div>}
            </button>

            {/* OPTION MICRO (DYNAMIQUE) */}
            <button
                type="button"
                onClick={() => setGranularity('data')}
                className={`flex items-center justify-between px-2 py-2 text-[9px] font-bold uppercase transition-all rounded border ${granularity === 'data' ? 'bg-neon-blue/10 border-neon-blue text-neon-blue shadow-lg' : 'border-slate-800 text-slate-500 hover:border-slate-600'}`}
            >
                <div className="flex items-center gap-2">
                    <LineChart size={12}/> 
                    <div className="flex flex-col items-start leading-none">
                        <span>Chart ({currentChartRes})</span>
                        <span className="text-[8px] opacity-60 font-normal mt-0.5">Calculé sur la vue active</span>
                    </div>
                </div>
                {granularity === 'data' && <div className="w-1.5 h-1.5 bg-neon-blue rounded-full shadow-[0_0_5px_#00f3ff]"></div>}
            </button>
        </div>
    </div>
  );

  return (
    <div className="relative z-50">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 border px-3 py-1.5 rounded-none transition-all text-xs font-bold uppercase tracking-wider
          ${isOpen 
            ? 'bg-slate-900 border-neon-blue text-neon-blue shadow-[0_0_15px_rgba(0,243,255,0.2)]' 
            : 'bg-slate-950/50 hover:bg-slate-900 border-slate-800 text-slate-300'
          }`}
      >
        <Activity size={14} className={isOpen ? "text-neon-blue" : "text-emerald-400"}/> Indicateurs
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={resetMenu}></div>
          <div className="absolute top-full left-0 mt-2 w-80 bg-slate-950/90 backdrop-blur-xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col z-50 rounded-lg">
            
            {!activeCategory && !selectedId && (
                <div className="p-2 space-y-2">
                    <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 mb-1 flex justify-between">
                        <span>Systems Select</span>
                        <span className="text-neon-blue">v4.2</span>
                    </div>
                    {CATEGORIES.map((cat) => {
                        const Icon = cat.icon;
                        return (
                            <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`w-full relative group overflow-hidden border border-slate-800/50 bg-black/20 p-4 text-left hover:border-slate-600 transition-all rounded-md ${cat.borderColor}`}>
                                <div className={`absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-transform ${cat.color}`}><Icon size={64} /></div>
                                <div className="relative z-10 flex items-center gap-3">
                                    <div className={`p-2 rounded bg-slate-900/80 ${cat.color} group-hover:text-white transition-colors border border-slate-800`}><Icon size={20} /></div>
                                    <div>
                                        <div className={`text-sm font-bold tracking-widest uppercase ${cat.color} group-hover:text-white`}>{cat.label}</div>
                                        <div className="text-[10px] text-slate-500 mt-0.5">{cat.desc}</div>
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                </div>
            )}

            {activeCategory && !selectedId && (
              <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-200">
                  <div className="flex items-center gap-2 p-3 border-b border-white/5 bg-white/5">
                      <button onClick={() => setActiveCategory(null)} className="text-slate-400 hover:text-white transition hover:scale-110"><ArrowLeft size={16} /></button>
                      <span className={`text-xs font-bold uppercase tracking-wider ${CATEGORIES.find(c => c.id === activeCategory).color}`}>{CATEGORIES.find(c => c.id === activeCategory).label} Nodes</span>
                  </div>
                  <div className="p-1 max-h-[400px] overflow-y-auto custom-scrollbar">
                      {filteredIndicators.map((ind) => (
                          <button key={ind.id} onClick={() => handleSelectIndicator(ind)} className="w-full flex items-center justify-between p-3 hover:bg-white/5 group transition text-left border-b border-white/5 last:border-0">
                              <div className="flex items-center gap-3"><div className="text-xs font-bold text-slate-300 group-hover:text-neon-blue transition-colors">{ind.name}</div></div>
                              <ChevronRight size={14} className="text-slate-600 group-hover:text-white" />
                          </button>
                      ))}
                  </div>
              </div>
            )}

            {selectedId && (
              <div className="animate-in slide-in-from-right-4 duration-200">
                <div className="flex items-center gap-2 p-3 border-b border-white/5 bg-white/5">
                  <button onClick={() => setSelectedId(null)} className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition"><ChevronLeft size={16} /></button>
                  <span className="text-xs font-bold text-white uppercase tracking-wider">{currentDef?.name}</span>
                </div>

                <div className="flex p-1 bg-black/20 border-b border-white/5">
                  <button onClick={() => setMode('manual')} className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 rounded transition-all ${mode === 'manual' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}><Settings2 size={12} /> Manuel</button>
                  <button onClick={() => setMode('smart')} className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 rounded transition-all ${mode === 'smart' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-500 hover:text-indigo-400'}`}><Wand2 size={12} /> Smart</button>
                </div>

                <div className="p-4 space-y-5 max-h-[400px] overflow-y-auto custom-scrollbar">
                  {mode === 'manual' ? (
                    <>
                        {currentDef && Object.entries(currentDef.params).map(([key, field]) => (
                             <div key={key} className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] text-slate-400 font-bold uppercase">{field.label}</label>
                                    {field.type !== 'select' && (<span className="text-[9px] text-slate-600 font-mono">[{field.min}-{field.max}]</span>)}
                                </div>
                                {field.type === 'select' ? (
                                    <select value={formParams[key]} onChange={(e) => handleParamChange(key, e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2 text-xs text-white focus:border-neon-blue outline-none rounded">{field.options.map(opt => (<option key={opt} value={opt}>{opt.toUpperCase()}</option>))}</select>
                                ) : (
                                    <div className="flex items-center gap-3 bg-slate-900/50 p-1 rounded border border-slate-800 focus-within:border-slate-600 transition-colors">
                                        <input type="range" min={field.min} max={field.max} step={field.step || 1} value={formParams[key]} onChange={(e) => handleParamChange(key, parseFloat(e.target.value))} className="flex-1 h-1 bg-slate-700 rounded-full appearance-none cursor-pointer accent-neon-blue hover:accent-white transition-all ml-2" />
                                        <div className="w-[1px] h-4 bg-slate-700"></div>
                                        <input type="number" min={field.min} max={field.max} step={field.step || 1} value={formParams[key]} onChange={(e) => handleParamChange(key, parseFloat(e.target.value))} className="w-14 bg-transparent text-right text-xs font-mono font-bold text-white focus:outline-none p-1" />
                                    </div>
                                )}
                             </div>
                        ))}
                        <hr className="border-white/10" />
                        <GranularitySelector />
                    </>
                  ) : (
                    <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                      <div className="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-2 opacity-10"><Cpu size={48} /></div>
                          <h4 className="text-indigo-300 font-bold text-[10px] uppercase tracking-widest mb-1 flex items-center gap-2"><Wand2 size={10} /> Optimization Core</h4>
                          <p className="text-[9px] text-indigo-200/70 leading-relaxed">
                            {currentDef.type === 'BAND' ? `Largeur ajustée pour contenir ${smartTarget}% du prix.` : `Période ajustée pour ${smartTarget}% de signaux positifs.`}
                          </p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between"><label className="text-[10px] text-slate-400 font-bold uppercase">Target Accuracy</label><span className="text-xs font-mono font-bold text-indigo-400">{smartTarget}%</span></div>
                        <input type="range" min="10" max="95" step="5" value={smartTarget} onChange={(e) => setSmartTarget(parseInt(e.target.value))} className="w-full h-1 bg-slate-800 rounded-full appearance-none cursor-pointer accent-indigo-500" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-400 font-bold uppercase">Learning Lookback</label>
                        <select value={smartLookback} onChange={(e) => setSmartLookback(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-700 p-2 text-xs text-white focus:border-indigo-500 outline-none rounded">
                          <option value="30">1 Mois (Réactif)</option>
                          <option value="90">3 Mois (Court Terme)</option>
                          <option value="180">6 Mois (Moyen Terme)</option>
                          <option value="365">1 An (Standard)</option>
                        </select>
                      </div>
                      <hr className="border-white/10" />
                      <GranularitySelector />
                    </div>
                  )}
                  <hr className="border-white/10" />
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold uppercase">Nom (Optionnel)</label>
                      <input type="text" placeholder={mode === 'manual' ? `ex: ${currentDef.name}` : "ex: Support Dynamique"} value={customName} onChange={(e) => setCustomName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2 text-xs text-white focus:border-slate-500 outline-none rounded" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-2"><Palette size={10} /> Couleur</label>
                      <div className="grid grid-cols-8 gap-1">
                        {PRESET_COLORS.map(c => (
                          <button key={c} type="button" onClick={() => setColor(c)} className={`w-5 h-5 rounded-[2px] transition-all ${color === c ? 'ring-1 ring-white shadow-sm scale-110' : 'opacity-50 hover:opacity-100 hover:scale-110'}`} style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-white/10 bg-black/40">
                    <button type="button" onClick={handleSubmit} disabled={loading} className={`w-full py-2.5 text-xs font-bold text-white transition-all shadow-lg rounded uppercase tracking-wider ${mode === 'manual' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500'} ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-95'}`}>
                        {loading ? 'Calcul...' : 'Ajouter'}
                    </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}