import { useState, useEffect } from 'react';
import { 
  X, Save, Activity, RotateCw, Palette, Layers, 
  CalendarClock, LineChart, Wand2, Settings2, Cpu 
} from 'lucide-react';
import { calculateIndicator, default as INDICATORS } from '../indicators/registry';

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#fda4af', '#fdba74', '#fde047', '#bef264', '#86efac', '#6ee7b7', '#5eead4',
  '#67e8f9', '#7dd3fc', '#93c5fd', '#a5b4fc', '#c4b5fd', '#d8b4fe', '#f0abfc', '#f9a8d4'
];

export default function IndicatorEditor({ indicator, chartData, dailyData, onClose, onSave, onPreview }) {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState('MANUAL'); // 'MANUAL' | 'SMART'
  const [isVisualLoading, setIsVisualLoading] = useState(false);
  const [isSmartComputing, setIsSmartComputing] = useState(false);

  // Configuration locale (Draft)
  const [localParams, setLocalParams] = useState(indicator.params || {});
  const [color, setColor] = useState(indicator.color);
  const [name, setName] = useState(indicator.name);
  const [granularity, setGranularity] = useState(indicator.granularity || 'days');

  // Configuration Smart (Legacy/Future)
  const [smartTarget, setSmartTarget] = useState(indicator.smartParams?.target || 50);
  const [smartLookback, setSmartLookback] = useState(indicator.smartParams?.lookback || 365);

  const definition = INDICATORS[indicator.type];

  // --- PREVIEW EFFECT (DEBOUNCE) ---
  // Calcul local JS pour feedback immédiat (60fps feel)
  useEffect(() => {
    if (!definition) return;
    
    const timer = setTimeout(() => {
        setIsVisualLoading(true);
        // Utilisation de requestAnimationFrame pour ne pas bloquer le thread UI
        requestAnimationFrame(() => {
            try {
                // Calcul "Draft" côté client
                const dataToPreview = calculateIndicator(
                    { id: indicator.type, params: localParams, granularity },
                    chartData,
                    dailyData
                );
                
                if (dataToPreview) {
                    onPreview({
                        ...indicator,
                        name, color, granularity,
                        params: localParams,
                        data: dataToPreview, // Données JS temporaires
                        isPreview: true      // Flag pour le Chart
                    });
                }
            } catch (e) {
                console.error("Preview Calc Error:", e);
            } finally {
                setIsVisualLoading(false);
            }
        });
    }, 50); // Debounce très court pour réactivité slider

    return () => clearTimeout(timer);
  }, [localParams, color, name, granularity, indicator.type, chartData, dailyData, definition, indicator, onPreview]);

  // --- HANDLERS ---
  const handleParamChange = (key, value) => {
      setLocalParams(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    // On renvoie l'objet config PROPRE au parent.
    // Le parent (App.jsx -> useIndicatorManager) se chargera de l'envoyer au Backend.
    onSave({
      ...indicator,
      params: localParams,
      granularity,
      color,
      name,
      smartParams: activeTab === 'SMART' ? { target: smartTarget, lookback: smartLookback } : indicator.smartParams
    });
    onClose();
  };

  // --- SMART OPTIMIZER LOGIC (SIMULATION UI) ---
  const runSmartOptimization = async () => {
    setIsSmartComputing(true);
    try {
        await new Promise(r => setTimeout(r, 800)); 
        
        // Logique simulée pour l'UX (En prod, appel API ici)
        const key = Object.keys(definition.params).find(k => definition.params[k].type === 'number');
        if (key) {
            const current = localParams[key];
            const optimized = Math.floor(current * (0.8 + Math.random() * 0.4));
            handleParamChange(key, optimized);
            
            const typeLabel = definition.type === 'BAND' ? 'Inside' : 'Up';
            setName(`${definition.name} (AI: ${smartTarget}% ${typeLabel})`);
        }
        
        setActiveTab('MANUAL'); 
    } catch (e) {
        console.error("Smart Error", e);
    } finally {
        setIsSmartComputing(false);
    }
  };

  // --- RENDER COMPONENT: GRANULARITY SELECTOR ---
  const GranularitySelector = () => (
    <div className="space-y-2">
        <label className="text-[10px] uppercase text-slate-400 font-bold flex items-center gap-1">
            <Layers size={10} /> Timeframe Source
        </label>
        <div className="flex flex-col gap-1.5">
            <button
                type="button"
                onClick={() => setGranularity('days')}
                className={`flex items-center justify-between px-3 py-2 text-[9px] font-bold uppercase transition-all rounded border ${granularity === 'days' ? 'bg-slate-700 border-slate-500 text-white shadow-lg' : 'border-slate-800 text-slate-500 hover:border-slate-600'}`}
            >
                <span className="flex items-center gap-2"><CalendarClock size={12}/> Daily (Macro)</span>
                {granularity === 'days' && <div className="w-1.5 h-1.5 bg-neon-green rounded-full shadow-[0_0_5px_#00ff41]"></div>}
            </button>
            <button
                type="button"
                onClick={() => setGranularity('data')}
                className={`flex items-center justify-between px-3 py-2 text-[9px] font-bold uppercase transition-all rounded border ${granularity === 'data' ? 'bg-neon-blue/10 border-neon-blue text-neon-blue shadow-lg' : 'border-slate-800 text-slate-500 hover:border-slate-600'}`}
            >
                <span className="flex items-center gap-2"><LineChart size={12}/> Chart (Intraday)</span>
                    {granularity === 'data' && <div className="w-1.5 h-1.5 bg-neon-blue rounded-full shadow-[0_0_5px_#00f3ff]"></div>}
            </button>
        </div>
    </div>
  );

  if (!definition) return null;

  return (
    <div className="absolute top-16 right-4 z-50 w-[340px] animate-in fade-in zoom-in duration-300 origin-top-right">
      
      {/* GLASS CONTAINER */}
      <div className="bg-slate-950/90 backdrop-blur-xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-lg overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* HEADER DECORATION */}
        <div className="h-1 w-full bg-gradient-to-r from-neon-blue via-purple-500 to-neon-blue opacity-80"></div>

        {/* TITLE BAR */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
           <div className="flex items-center gap-2 text-neon-blue drop-shadow-[0_0_5px_rgba(0,243,255,0.5)]">
              <Activity size={18} />
              <span className="text-sm font-bold uppercase tracking-[0.15em] font-mono">
                CONFIG_{definition.id}
              </span>
           </div>
           <div className="flex items-center gap-3">
             {isVisualLoading && <RotateCw size={14} className="text-neon-blue animate-spin" />}
             <button onClick={onClose} className="text-slate-500 hover:text-red-400 transition-colors">
                <X size={18} />
             </button>
           </div>
        </div>

        {/* TABS SWITCHER */}
        <div className="flex p-1 bg-black/40 border-b border-white/5">
            <button 
                onClick={() => setActiveTab('MANUAL')}
                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 rounded transition-all
                ${activeTab === 'MANUAL' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
                <Settings2 size={12} /> Parameters
            </button>
            <button 
                onClick={() => setActiveTab('SMART')}
                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 rounded transition-all
                ${activeTab === 'SMART' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-500 hover:text-indigo-400'}`}
            >
                <Wand2 size={12} /> Smart A.I.
            </button>
        </div>

        {/* SCROLLABLE CONTENT AREA */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
            
            {/* --- TAB: MANUAL --- */}
            {activeTab === 'MANUAL' && (
                <div className="space-y-5">
                    {Object.entries(definition.params).map(([key, config]) => (
                        <div key={key} className="group">
                             <div className="flex justify-between items-center mb-2">
                                <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider group-hover:text-neon-blue transition-colors">
                                    {config.label}
                                </label>
                                <span className="text-[9px] text-slate-600 font-mono">
                                    [{config.min ?? 0} - {config.max ?? 100}]
                                </span>
                             </div>

                             {config.type === 'select' ? (
                                <select
                                    value={localParams[key]}
                                    onChange={(e) => handleParamChange(key, e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white focus:border-neon-blue outline-none"
                                >
                                    {config.options.map(opt => (
                                        <option key={opt} value={opt}>{opt.toUpperCase()}</option>
                                    ))}
                                </select>
                             ) : (
                                <div className="flex items-center gap-3 bg-slate-900/50 p-1 rounded border border-slate-800 focus-within:border-slate-600 transition-colors">
                                    <input 
                                        type="range"
                                        min={config.min} max={config.max} step={config.step || 1}
                                        value={localParams[key]}
                                        onChange={(e) => handleParamChange(key, parseFloat(e.target.value))}
                                        className="flex-1 h-1 bg-slate-700 rounded-full appearance-none cursor-pointer accent-neon-blue hover:accent-white transition-all ml-2"
                                    />
                                    <div className="w-[1px] h-4 bg-slate-700"></div>
                                    <input 
                                        type="number"
                                        min={config.min} max={config.max} step={config.step || 1}
                                        value={localParams[key]}
                                        onChange={(e) => handleParamChange(key, parseFloat(e.target.value))}
                                        className="w-16 bg-transparent text-right text-xs font-mono font-bold text-white focus:outline-none p-1"
                                    />
                                </div>
                             )}
                        </div>
                    ))}

                    <hr className="border-white/10" />

                    <div className="grid grid-cols-1 gap-4">
                        <GranularitySelector />
                        
                        <div className="space-y-2 mt-2">
                            <label className="text-[10px] uppercase text-slate-400 font-bold flex items-center gap-1">
                                <Palette size={10} /> Style & Color
                            </label>
                            <div className="grid grid-cols-8 gap-1.5 content-start p-2 bg-slate-900/50 rounded border border-slate-800">
                                {COLORS.slice(0, 16).map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setColor(c)}
                                        className={`w-full aspect-square rounded-[2px] transition-all hover:scale-110 ${color === c ? 'ring-1 ring-white shadow-[0_0_5px_currentColor]' : 'opacity-40 hover:opacity-100'}`}
                                        style={{ backgroundColor: c, color: c }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- TAB: SMART AI --- */}
            {activeTab === 'SMART' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Cpu size={64} />
                        </div>
                        <h4 className="text-indigo-300 font-bold text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Wand2 size={12} /> Optimization Core
                        </h4>
                        <p className="text-[10px] text-indigo-200/70 leading-relaxed max-w-[90%]">
                            {definition.type === 'BAND' 
                                ? `L'IA ajuste les paramètres pour que le prix reste à l'intérieur des bandes ${smartTarget}% du temps.`
                                : `L'IA ajuste la période pour que le prix de clôture soit au-dessus de l'indicateur ${smartTarget}% du temps.`
                            }
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <label className="text-[10px] text-slate-400 font-bold uppercase">Target Accuracy</label>
                                <span className="text-xs font-mono font-bold text-indigo-400">{smartTarget}%</span>
                            </div>
                            <input 
                                type="range" min="10" max="95" step="5"
                                value={smartTarget}
                                onChange={(e) => setSmartTarget(Number(e.target.value))}
                                className="w-full h-1 bg-slate-800 rounded-full appearance-none cursor-pointer accent-indigo-500"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] text-slate-400 font-bold uppercase">Learning Lookback</label>
                            <select 
                                value={smartLookback}
                                onChange={(e) => setSmartLookback(Number(e.target.value))}
                                className="w-full bg-slate-900 border border-slate-700 p-2 text-xs text-white focus:border-indigo-500 outline-none rounded"
                            >
                                <option value="30">1 Mois (Réactif)</option>
                                <option value="90">3 Mois (Court Terme)</option>
                                <option value="365">1 An (Standard)</option>
                            </select>
                        </div>

                        <hr className="border-white/10" />
                        
                        <GranularitySelector />

                        <button
                            onClick={runSmartOptimization}
                            disabled={isSmartComputing}
                            className="w-full py-4 mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-widest rounded transition-all shadow-lg hover:shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-3"
                        >
                            {isSmartComputing ? (
                                <>
                                    <RotateCw size={14} className="animate-spin" /> Calculating...
                                </>
                            ) : (
                                <>
                                    <Cpu size={14} /> Run Neural Optimize
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>

        {/* FOOTER BAR */}
        <div className="p-4 border-t border-white/10 bg-black/60 backdrop-blur-md space-y-3">
            <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom personnalisé..."
                className="w-full bg-transparent border-b border-slate-700 py-1 text-xs text-slate-300 focus:border-neon-blue outline-none transition-colors placeholder:text-slate-700 mb-2"
            />
            
            <button 
                onClick={handleSave}
                className="w-full bg-neon-blue/10 hover:bg-neon-blue/20 border border-neon-blue/50 text-neon-blue py-3 rounded flex items-center justify-center gap-2 transition-all group active:scale-95 cursor-pointer z-50"
            >
                <Save size={16} className="group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold tracking-[0.2em]">APPLY CHANGES</span>
            </button>
        </div>

      </div>
    </div>
  );
}