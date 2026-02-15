import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Settings2, Wand2, Palette, Activity, ChevronRight, ChevronLeft, 
  Layers, BarChart3, Zap, Anchor, TrendingUp, ArrowLeft, CalendarClock, LineChart, Cpu 
} from 'lucide-react';
import { marketApi } from '../api/client';
import { calculateIndicator, getAvailableIndicators, getIndicatorConfig, default as INDICATORS } from '../indicators/registry';

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

// AJOUT DES PROPS DE DONNÉES ET PREVIEW
export default function IndicatorMenu({ ticker, chartData, dailyData, onAddIndicator, onPreview }) {
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
  const [granularity, setGranularity] = useState('days');
  const [smartTarget, setSmartTarget] = useState(50);
  const [smartLookback, setSmartLookback] = useState(365);

  const calcTimeoutRef = useRef(null);

  const allIndicators = useMemo(() => getAvailableIndicators(), []);

  const filteredIndicators = useMemo(() => {
    if (!activeCategory) return [];
    const catDef = CATEGORIES.find(c => c.id === activeCategory);
    return allIndicators.filter(ind => catDef.filter(ind.tags || []));
  }, [activeCategory, allIndicators]);

  const currentDef = selectedId ? INDICATORS[selectedId] : null;

  // --- EFFET DE PREVIEW (IDENTIQUE À L'ÉDITEUR) ---
  useEffect(() => {
      // Si le menu est fermé ou pas d'indicateur sélectionné, on nettoie le preview
      if (!isOpen || !selectedId) {
          if (onPreview) onPreview(null);
          return;
      }

      if (!currentDef || !chartData) return;

      // Debounce pour ne pas tuer le CPU
      if (calcTimeoutRef.current) clearTimeout(calcTimeoutRef.current);

      calcTimeoutRef.current = setTimeout(() => {
          requestAnimationFrame(() => {
              try {
                  const dataToPreview = calculateIndicator(
                      { id: selectedId, params: formParams, granularity },
                      chartData,
                      dailyData
                  );

                  if (dataToPreview && onPreview) {
                      onPreview({
                          id: 'MENU_PREVIEW_TEMP', // ID Temporaire
                          type: selectedId,
                          name: customName || currentDef.name,
                          color: color,
                          style: currentDef.type === 'BAND' ? 'BAND' : 'LINE',
                          granularity: granularity,
                          params: formParams,
                          data: dataToPreview,
                          isPreview: true,
                          visible: true
                      });
                  }
              } catch (e) {
                  console.error("Menu Preview Calc Error:", e);
              }
          });
      }, 50); // 50ms pour être très réactif

      return () => { if (calcTimeoutRef.current) clearTimeout(calcTimeoutRef.current); };

  }, [selectedId, formParams, color, granularity, customName, chartData, dailyData, isOpen]);


  const resetMenu = () => {
    setIsOpen(false);
    if (onPreview) onPreview(null); // Nettoyage immédiat
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
        // ... (Logique Smart inchangée)
        if (selectedId === 'SMA') {
            res = await marketApi.calculateSmartSMA(ticker, decimalTarget, smartLookback);
            finalParams.period = res.data.optimal_n;
        } 
        else if (selectedId === 'EMA') {
            res = await marketApi.calculateSmartEMA(ticker, decimalTarget, smartLookback);
            finalParams.period = res.data.optimal_n;
        } 
        else if (selectedId === 'ENV') {
            res = await marketApi.calculateSmartEnvelope(ticker, decimalTarget, smartLookback);
            finalParams.deviation = res.data.optimal_k;
        } 
        else if (selectedId === 'BB') {
            res = await marketApi.calculateSmartBollinger(ticker, decimalTarget, smartLookback);
            finalParams.stdDev = res.data.optimal_k;
        } else {
             await new Promise(r => setTimeout(r, 500));
        }
      }

      if (!displayName) {
        const smartTag = mode === 'smart' ? ` [AI ${smartTarget}%]` : '';
        const granTag = granularity === 'data' ? ' (Intraday)' : '';
        const mainParamKey = Object.keys(finalParams)[0]; 
        const mainParamVal = finalParams[mainParamKey];
        displayName = `${currentDef.name} (${mainParamVal})${smartTag}${granTag}`;
      }

      onAddIndicator({
        id: Date.now(),
        type: selectedId,
        // Style object standardisé pour le backend
        style: { 
            color: color, 
            type: currentDef.type === 'BAND' ? 'BAND' : 'LINE' 
        },
        params: finalParams,
        granularity: granularity,
        color: color, // Fallback pour affichage immédiat
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

  const GranularitySelector = () => (
    <div className="space-y-2">
        <label className="text-[10px] uppercase text-slate-400 font-bold flex items-center gap-1">
            <Layers size={10} /> Timeframe Source
        </label>
        <div className="flex flex-col gap-1.5">
            <button
                type="button"
                onClick={() => setGranularity('days')}
                className={`flex items-center justify-between px-2 py-1.5 text-[9px] font-bold uppercase transition-all rounded border ${granularity === 'days' ? 'bg-slate-700 border-slate-500 text-white shadow-lg' : 'border-slate-800 text-slate-500 hover:border-slate-600'}`}
            >
                <span className="flex items-center gap-2"><CalendarClock size={12}/> Daily (Macro)</span>
                {granularity === 'days' && <div className="w-1.5 h-1.5 bg-neon-green rounded-full shadow-[0_0_5px_#00ff41]"></div>}
            </button>
            <button
                type="button"
                onClick={() => setGranularity('data')}
                className={`flex items-center justify-between px-2 py-1.5 text-[9px] font-bold uppercase transition-all rounded border ${granularity === 'data' ? 'bg-neon-blue/10 border-neon-blue text-neon-blue shadow-lg' : 'border-slate-800 text-slate-500 hover:border-slate-600'}`}
            >
                <span className="flex items-center gap-2"><LineChart size={12}/> Chart (Intraday)</span>
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
            
            {/* 1. NIVEAU RACINE : CATÉGORIES */}
            {!activeCategory && !selectedId && (
                <div className="p-2 space-y-2">
                    <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 mb-1 flex justify-between">
                        <span>Systems Select</span>
                        <span className="text-neon-blue">v4.2</span>
                    </div>
                    {CATEGORIES.map((cat) => {
                        const Icon = cat.icon;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={`w-full relative group overflow-hidden border border-slate-800/50 bg-black/20 p-4 text-left hover:border-slate-600 transition-all rounded-md ${cat.borderColor}`}
                            >
                                <div className={`absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-transform ${cat.color}`}>
                                    <Icon size={64} />
                                </div>
                                <div className="relative z-10 flex items-center gap-3">
                                    <div className={`p-2 rounded bg-slate-900/80 ${cat.color} group-hover:text-white transition-colors border border-slate-800`}>
                                        <Icon size={20} />
                                    </div>
                                    <div>
                                        <div className={`text-sm font-bold tracking-widest uppercase ${cat.color} group-hover:text-white`}>
                                            {cat.label}
                                        </div>
                                        <div className="text-[10px] text-slate-500 mt-0.5">{cat.desc}</div>
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                </div>
            )}

            {/* 2. NIVEAU LISTE : INDICATEURS FILTRÉS */}
            {activeCategory && !selectedId && (
              <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-200">
                 {/* Header Catégorie */}
                 <div className="flex items-center gap-2 p-3 border-b border-white/5 bg-white/5">
                    <button onClick={() => setActiveCategory(null)} className="text-slate-400 hover:text-white transition hover:scale-110">
                        <ArrowLeft size={16} />
                    </button>
                    <span className={`text-xs font-bold uppercase tracking-wider ${CATEGORIES.find(c => c.id === activeCategory).color}`}>
                        {CATEGORIES.find(c => c.id === activeCategory).label} Nodes
                    </span>
                 </div>

                 {/* Liste */}
                 <div className="p-1 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {filteredIndicators.map((ind) => (
                        <button
                            key={ind.id}
                            onClick={() => handleSelectIndicator(ind)}
                            className="w-full flex items-center justify-between p-3 hover:bg-white/5 group transition text-left border-b border-white/5 last:border-0"
                        >
                            <div className="flex items-center gap-3">
                                <div className="text-xs font-bold text-slate-300 group-hover:text-neon-blue transition-colors">
                                    {ind.name}
                                </div>
                            </div>
                            <ChevronRight size={14} className="text-slate-600 group-hover:text-white" />
                        </button>
                    ))}
                 </div>
              </div>
            )}

            {/* 3. NIVEAU CONFIGURATION */}
            {selectedId && (
              <div className="animate-in slide-in-from-right-4 duration-200">
                <div className="flex items-center gap-2 p-3 border-b border-white/5 bg-white/5">
                  <button 
                    onClick={() => setSelectedId(null)}
                    className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs font-bold text-white uppercase tracking-wider">{currentDef?.name}</span>
                </div>

                <div className="flex p-1 bg-black/20 border-b border-white/5">
                  <button 
                    onClick={() => setMode('manual')}
                    className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 rounded transition-all ${mode === 'manual' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <Settings2 size={12} /> Manuel
                  </button>
                  <button 
                    onClick={() => setMode('smart')}
                    className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 rounded transition-all ${mode === 'smart' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-500 hover:text-indigo-400'}`}
                  >
                    <Wand2 size={12} /> Smart
                  </button>
                </div>

                <div className="p-4 space-y-5 max-h-[400px] overflow-y-auto custom-scrollbar">
                  {mode === 'manual' ? (
                    <>
                        {/* --- INPUTS DYNAMIQUES --- */}
                        {currentDef && Object.entries(currentDef.params).map(([key, field]) => (
                             <div key={key} className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] text-slate-400 font-bold uppercase">{field.label}</label>
                                    {field.type !== 'select' && (
                                        <span className="text-[9px] text-slate-600 font-mono">[{field.min}-{field.max}]</span>
                                    )}
                                </div>
                                
                                {field.type === 'select' ? (
                                    <select
                                        value={formParams[key]}
                                        onChange={(e) => handleParamChange(key, e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 p-2 text-xs text-white focus:border-neon-blue outline-none rounded"
                                    >
                                        {field.options.map(opt => (
                                            <option key={opt} value={opt}>{opt.toUpperCase()}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="flex items-center gap-3 bg-slate-900/50 p-1 rounded border border-slate-800 focus-within:border-slate-600 transition-colors">
                                        <input 
                                            type="range"
                                            min={field.min} max={field.max} step={field.step || 1}
                                            value={formParams[key]}
                                            onChange={(e) => handleParamChange(key, parseFloat(e.target.value))}
                                            className="flex-1 h-1 bg-slate-700 rounded-full appearance-none cursor-pointer accent-neon-blue hover:accent-white transition-all ml-2"
                                        />
                                        <div className="w-[1px] h-4 bg-slate-700"></div>
                                        <input 
                                            type="number"
                                            min={field.min} max={field.max} step={field.step || 1}
                                            value={formParams[key]}
                                            onChange={(e) => handleParamChange(key, parseFloat(e.target.value))}
                                            className="w-14 bg-transparent text-right text-xs font-mono font-bold text-white focus:outline-none p-1"
                                        />
                                    </div>
                                )}
                             </div>
                        ))}

                        <hr className="border-white/10" />
                        <GranularitySelector />
                    </>
                  ) : (
                    /* --- MODE SMART --- */
                    <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                      
                      <div className="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-2 opacity-10"><Cpu size={48} /></div>
                          <h4 className="text-indigo-300 font-bold text-[10px] uppercase tracking-widest mb-1 flex items-center gap-2">
                              <Wand2 size={10} /> Optimization Core
                          </h4>
                          <p className="text-[9px] text-indigo-200/70 leading-relaxed">
                            {currentDef.type === 'BAND' 
                                ? `Largeur ajustée pour contenir ${smartTarget}% du prix.` 
                                : `Période ajustée pour ${smartTarget}% de signaux positifs.`}
                          </p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <label className="text-[10px] text-slate-400 font-bold uppercase">Target Accuracy</label>
                          <span className="text-xs font-mono font-bold text-indigo-400">{smartTarget}%</span>
                        </div>
                        <input 
                          type="range" min="10" max="95" step="5"
                          value={smartTarget}
                          onChange={(e) => setSmartTarget(parseInt(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-full appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-400 font-bold uppercase">Learning Lookback</label>
                        <select 
                          value={smartLookback}
                          onChange={(e) => setSmartLookback(parseInt(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-700 p-2 text-xs text-white focus:border-indigo-500 outline-none rounded"
                        >
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

                  {/* --- GLOBAL SETTINGS --- */}
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold uppercase">Nom (Optionnel)</label>
                      <input 
                        type="text" 
                        placeholder={mode === 'manual' ? `ex: ${currentDef.name}` : "ex: Support Dynamique"}
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 p-2 text-xs text-white focus:border-slate-500 outline-none rounded"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-2"><Palette size={10} /> Couleur</label>
                      <div className="grid grid-cols-8 gap-1">
                        {PRESET_COLORS.map(c => (
                          <button
                            key={c} type="button" onClick={() => setColor(c)}
                            className={`w-5 h-5 rounded-[2px] transition-all ${color === c ? 'ring-1 ring-white shadow-sm scale-110' : 'opacity-50 hover:opacity-100 hover:scale-110'}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-white/10 bg-black/40">
                    <button 
                        type="button" 
                        onClick={handleSubmit} 
                        disabled={loading}
                        className={`w-full py-2.5 text-xs font-bold text-white transition-all shadow-lg rounded uppercase tracking-wider
                        ${mode === 'manual' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500'}
                        ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-95'}
                        `}
                    >
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