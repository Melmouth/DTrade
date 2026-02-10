import { useState, useEffect, useMemo } from 'react';
import { X, Save, Activity, RotateCw, Palette, Layers, BarChart3, SlidersHorizontal } from 'lucide-react';
import { calculateIndicator, default as INDICATORS } from '../indicators/registry';

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', 
  '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e', '#ffffff'
];

export default function IndicatorEditor({ indicator, chartData, dailyData, onClose, onSave, onPreview }) {
  const [isVisualLoading, setIsVisualLoading] = useState(false);
  
  // On récupère la définition complète depuis le registre
  const definition = INDICATORS[indicator.type];

  // Identification du paramètre principal pour le "Gros Slider" (le premier paramètre numérique)
  const mainParamKey = useMemo(() => {
    if (!definition) return null;
    return Object.keys(definition.params).find(k => definition.params[k].type === 'number');
  }, [definition]);

  const mainParamConfig = definition ? definition.params[mainParamKey] : {};

  // État local des paramètres (tous les params : period, stdDev, source, etc.)
  const [localParams, setLocalParams] = useState(indicator.params || {});
  const [color, setColor] = useState(indicator.color);
  const [name, setName] = useState(indicator.name);
  const [granularity, setGranularity] = useState(indicator.granularity || 'days');

  // Valeur actuelle pour le slider principal
  const sliderValue = localParams[mainParamKey] || mainParamConfig.default || 20;

  // 1. LIVE PREVIEW (Calcul à la volée pour réactivité totale)
  useEffect(() => {
    if (!definition) return;

    // Petit délai pour éviter de spammer le calcul si on tape vite
    const timer = setTimeout(() => {
        setIsVisualLoading(true);
        requestAnimationFrame(() => {
            try {
                // On recalcule avec l'ensemble des paramètres actuels (localParams)
                const dataToPreview = calculateIndicator(
                    { id: indicator.type, params: localParams, granularity },
                    chartData,
                    dailyData
                );

                if (dataToPreview) {
                    onPreview({
                        ...indicator,
                        name: name,
                        color: color,
                        granularity: granularity,
                        params: localParams, // On renvoie tout l'objet params
                        data: dataToPreview 
                    });
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsVisualLoading(false);
            }
        });
    }, 50); // Debounce très court (50ms)

    return () => clearTimeout(timer);
  }, [localParams, color, name, granularity, indicator, chartData, dailyData, definition]);


  // Handler générique pour tous les inputs
  const handleParamChange = (key, value) => {
      setLocalParams(prev => ({
          ...prev,
          [key]: value
      }));
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
        
        {/* Header Line */}
        <div className="h-0.5 w-full bg-gradient-to-r from-neon-blue via-neon-purple to-neon-blue"></div>
        
        {/* Title Bar */}
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
            
            {/* 1. ZONE QUICK TUNE (Slider Principal) */}
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

            {/* 2. ZONE FINE TUNING (Tous les paramètres) */}
            <div className="space-y-3">
                <div className="text-[10px] uppercase text-slate-500 font-bold border-b border-white/5 pb-1">Paramètres Détaillés</div>
                
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
                                {/* Petit texte d'aide pour les bornes */}
                                <span className="text-[9px] text-slate-600 font-mono">
                                    [{config.min}-{config.max}]
                                </span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <hr className="border-white/10" />

            {/* 3. GRANULARITÉ & APPARENCE */}
            <div className="grid grid-cols-2 gap-4">
                {/* Granularité */}
                <div className="space-y-2">
                    <label className="text-[10px] uppercase text-slate-400 font-bold flex items-center gap-1">
                        <Layers size={10} /> Mode
                    </label>
                    <div className="flex flex-col gap-1">
                        <button
                            onClick={() => setGranularity('days')}
                            className={`px-2 py-1 text-[9px] font-bold uppercase transition-all rounded border ${granularity === 'days' ? 'bg-slate-700 border-slate-500 text-white' : 'border-slate-800 text-slate-500 hover:border-slate-600'}`}
                        >
                            Daily (J)
                        </button>
                        <button
                            onClick={() => setGranularity('data')}
                            className={`px-2 py-1 text-[9px] font-bold uppercase transition-all rounded border ${granularity === 'data' ? 'bg-neon-blue/20 border-neon-blue text-neon-blue' : 'border-slate-800 text-slate-500 hover:border-slate-600'}`}
                        >
                            Chart (D)
                        </button>
                    </div>
                </div>

                {/* Couleur */}
                <div className="space-y-2">
                    <label className="text-[10px] uppercase text-slate-400 font-bold flex items-center gap-1">
                        <Palette size={10} /> Couleur
                    </label>
                    <div className="grid grid-cols-5 gap-1">
                        {COLORS.slice(0, 10).map(c => (
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

            {/* Nom Custom */}
             <div className="space-y-1 pt-2">
                <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nom personnalisé..."
                    className="w-full bg-transparent border-b border-slate-700 py-1 text-xs text-slate-300 focus:border-neon-blue outline-none transition-colors placeholder:text-slate-700"
                />
            </div>

            {/* FOOTER */}
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