import { useState, useEffect, useMemo } from 'react';
import { X, Save, Activity, RotateCw, Palette, Layers, BarChart3, SlidersHorizontal, CalendarClock, LineChart } from 'lucide-react';
import { calculateIndicator, default as INDICATORS } from '../indicators/registry';

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#fda4af', '#fdba74', '#fde047', '#bef264', '#86efac', '#6ee7b7', '#5eead4',
  '#67e8f9', '#7dd3fc', '#93c5fd', '#a5b4fc', '#c4b5fd', '#d8b4fe', '#f0abfc', '#f9a8d4'
];

export default function IndicatorEditor({ indicator, chartData, dailyData, onClose, onSave, onPreview }) {
  const [isVisualLoading, setIsVisualLoading] = useState(false);
  
  const definition = INDICATORS[indicator.type];

  // Identification du paramètre principal
  const mainParamKey = useMemo(() => {
    if (!definition) return null;
    return Object.keys(definition.params).find(k => definition.params[k].type === 'number');
  }, [definition]);

  const mainParamConfig = definition ? definition.params[mainParamKey] : {};

  const [localParams, setLocalParams] = useState(indicator.params || {});
  const [color, setColor] = useState(indicator.color);
  const [name, setName] = useState(indicator.name);
  const [granularity, setGranularity] = useState(indicator.granularity || 'days');

  const sliderValue = localParams[mainParamKey] || mainParamConfig.default || 20;

  // LIVE PREVIEW
  useEffect(() => {
    if (!definition) return;
    const timer = setTimeout(() => {
        setIsVisualLoading(true);
        requestAnimationFrame(() => {
            try {
                const dataToPreview = calculateIndicator(
                    { id: indicator.type, params: localParams, granularity },
                    chartData,
                    dailyData // <-- On passe bien le contexte Daily ici
                );

                if (dataToPreview) {
                    onPreview({
                        ...indicator,
                        name: name,
                        color: color,
                        granularity: granularity,
                        params: localParams,
                        data: dataToPreview 
                    });
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsVisualLoading(false);
            }
        });
    }, 50);

    return () => clearTimeout(timer);
  }, [localParams, color, name, granularity, indicator, chartData, dailyData, definition]);

  const handleParamChange = (key, value) => {
      setLocalParams(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave({
      ...indicator,
      params: localParams,
      granularity,
      color,
      name
    });
    onClose();
  };

  if (!definition) return null;

  return (
    <div className="absolute top-4 right-4 z-50 w-80 animate-in fade-in zoom-in duration-300">
      <div className="bg-slate-900/90 backdrop-blur-xl border border-neon-blue/50 shadow-[0_0_40px_rgba(0,243,255,0.1)] overflow-hidden relative rounded-sm">
        
        <div className="h-0.5 w-full bg-gradient-to-r from-neon-blue via-neon-purple to-neon-blue"></div>
        
        <div className="flex items-center justify-between p-3 border-b border-white/10 bg-black/40">
           <div className="flex items-center gap-2 text-neon-blue">
              <Activity size={16} />
              <span className="text-xs font-bold uppercase tracking-widest">EDIT_{definition.id}</span>
           </div>
           <div className="flex items-center gap-2">
             {isVisualLoading && <RotateCw size={12} className="text-neon-blue animate-spin" />}
             <button onClick={onClose} className="text-slate-500 hover:text-white transition">
                <X size={16} />
             </button>
           </div>
        </div>

        <div className="p-4 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
            
            {mainParamKey && (
                <div className="space-y-2 bg-slate-800/50 p-3 rounded border border-slate-700/50">
                    <div className="flex justify-between items-end mb-1">
                        <label className="text-[10px] uppercase text-neon-blue font-bold tracking-wider flex items-center gap-1">
                            <SlidersHorizontal size={10} /> {mainParamConfig.label} (Quick)
                        </label>
                        <span className="text-lg font-mono text-white font-bold">
                            {sliderValue}
                        </span>
                    </div>
                    <input 
                        type="range" 
                        min={mainParamConfig.min} 
                        max={mainParamConfig.max} 
                        step={mainParamConfig.step || 1}
                        value={sliderValue}
                        onChange={(e) => handleParamChange(mainParamKey, parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-700 appearance-none cursor-pointer accent-neon-blue hover:accent-white transition-all rounded-full"
                    />
                </div>
            )}

            <div className="space-y-3">
                <div className="text-[10px] uppercase text-slate-500 font-bold border-b border-white/5 pb-1">Paramètres</div>
                
                {Object.entries(definition.params).map(([key, config]) => (
                    <div key={key} className="space-y-1">
                        <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wide">{config.label}</label>
                        
                        {config.type === 'select' ? (
                            <select
                                value={localParams[key]}
                                onChange={(e) => handleParamChange(key, e.target.value)}
                                className="w-full bg-black/50 border border-slate-700 p-2 text-xs text-white focus:border-neon-blue outline-none rounded-sm"
                            >
                                {config.options.map(opt => (
                                    <option key={opt} value={opt}>{opt.toUpperCase()}</option>
                                ))}
                            </select>
                        ) : (
                            <div className="flex items-center gap-2">
                                <input 
                                    type="number"
                                    min={config.min}
                                    max={config.max}
                                    step={config.step || 1}
                                    value={localParams[key]}
                                    onChange={(e) => handleParamChange(key, parseFloat(e.target.value))}
                                    className="flex-1 bg-black/50 border border-slate-700 p-1.5 text-xs text-white focus:border-neon-blue outline-none font-mono rounded-sm"
                                />
                                <span className="text-[9px] text-slate-600 font-mono">
                                    [{config.min}-{config.max}]
                                </span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <hr className="border-white/10" />

            <div className="grid grid-cols-2 gap-4">
                {/* Granularité - SECTION REFAITE */}
                <div className="space-y-2">
                    <label className="text-[10px] uppercase text-slate-400 font-bold flex items-center gap-1">
                        <Layers size={10} /> Timeframe Source
                    </label>
                    <div className="flex flex-col gap-1.5">
                        <button
                            onClick={() => setGranularity('days')}
                            className={`flex items-center justify-between px-2 py-1.5 text-[9px] font-bold uppercase transition-all rounded border ${granularity === 'days' ? 'bg-slate-700 border-slate-500 text-white shadow-lg' : 'border-slate-800 text-slate-500 hover:border-slate-600'}`}
                        >
                            <span className="flex items-center gap-2"><CalendarClock size={12}/> Daily (Macro)</span>
                            {granularity === 'days' && <div className="w-1.5 h-1.5 bg-neon-green rounded-full shadow-[0_0_5px_#00ff41]"></div>}
                        </button>
                        <button
                            onClick={() => setGranularity('data')}
                            className={`flex items-center justify-between px-2 py-1.5 text-[9px] font-bold uppercase transition-all rounded border ${granularity === 'data' ? 'bg-neon-blue/10 border-neon-blue text-neon-blue shadow-lg' : 'border-slate-800 text-slate-500 hover:border-slate-600'}`}
                        >
                            <span className="flex items-center gap-2"><LineChart size={12}/> Chart (Intraday)</span>
                             {granularity === 'data' && <div className="w-1.5 h-1.5 bg-neon-blue rounded-full shadow-[0_0_5px_#00f3ff]"></div>}
                        </button>
                    </div>
                </div>

                {/* Couleur */}
                <div className="space-y-2">
                    <label className="text-[10px] uppercase text-slate-400 font-bold flex items-center gap-1">
                        <Palette size={10} /> Couleur
                    </label>
                    <div className="grid grid-cols-5 gap-1 content-start">
                        {COLORS.slice(0, 32).map(c => (
                            <button
                                key={c}
                                onClick={() => setColor(c)}
                                className={`w-4 h-4 rounded-sm border transition-all ${color === c ? 'border-white scale-110 shadow-sm' : 'border-transparent opacity-50 hover:opacity-100'}`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>
                </div>
            </div>

             <div className="space-y-1 pt-2">
                <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nom personnalisé..."
                    className="w-full bg-transparent border-b border-slate-700 py-1 text-xs text-slate-300 focus:border-neon-blue outline-none transition-colors placeholder:text-slate-700"
                />
            </div>

            <div className="pt-2">
                <button 
                    onClick={handleSave}
                    className="w-full bg-neon-blue/10 hover:bg-neon-blue/20 border border-neon-blue/50 text-neon-blue py-2 flex items-center justify-center gap-2 transition-all group rounded-sm"
                >
                    <Save size={16} className="group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold tracking-widest">APPLIQUER</span>
                </button>
            </div>

        </div>
      </div>
    </div>
  );
}