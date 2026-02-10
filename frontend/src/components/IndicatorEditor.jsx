import { useState, useEffect } from 'react';
import { X, Save, Activity, Cpu, RotateCw, Palette, Layers, BarChart3 } from 'lucide-react';
import { calculateSMA, calculateEMA, calculateEnvelope, calculateBollinger } from '../utils/math';

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', 
  '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e', '#ffffff'
];

// Configuration dynamique selon le type d'indicateur
const CONFIGS = {
    'SMA': { min: 5, max: 300, step: 1, label: 'Période (N)', fast: 'FAST (5)', slow: 'SLOW (300)' },
    'EMA': { min: 5, max: 200, step: 1, label: 'Période (N)', fast: 'REACTIVE (5)', slow: 'SMOOTH (200)' },
    'ENV': { min: 0.5, max: 15, step: 0.1, label: 'Écart (%)', fast: 'TIGHT (0.5%)', slow: 'WIDE (15%)' },
    'BB':  { min: 0.5, max: 5, step: 0.1, label: 'Multiplicateur (σ)', fast: '0.5 σ', slow: '5.0 σ' },
};

export default function IndicatorEditor({ indicator, chartData, dailyData, onClose, onSave, onPreview }) {
  const [loading, setLoading] = useState(true);
  const [cache, setCache] = useState({}); // Stocke toutes les versions pré-calculées
  
  // Paramètre principal générique (Période N ou Facteur K/%)
  // On supporte 'param' (nouveau standard) ou 'period' (legacy SMA)
  const [param, setParam] = useState(indicator.param !== undefined ? indicator.param : indicator.period);
  const [color, setColor] = useState(indicator.color);
  const [name, setName] = useState(indicator.name);

  // Nouvelle option Granularité
  const [granularity, setGranularity] = useState(indicator.granularity || 'days');

  // Sélection de la config
  const config = CONFIGS[indicator.type] || CONFIGS['SMA'];

  // 1. SEQUENCE D'INITIALISATION & PRE-CALCUL INTELLIGENTE
  useEffect(() => {
    setLoading(true);
    
    // Timer pour effet visuel et non-blocage du thread UI
    const timer = setTimeout(() => {
      const newCache = {};
      const { min, max, step } = config;
      
      try {
        // Boucle adaptative : calcul massif de toutes les possibilités du slider
        for (let i = min; i <= max; i += step) {
           // Correction précision flottante pour clés (ex: 2.10000004 -> 2.1)
           const val = parseFloat(i.toFixed(2)); 
           
           // ON PASSE MAINTENANT LA GRANULARITÉ AUX FONCTIONS DE CALCUL
           if (indicator.type === 'SMA') newCache[val] = calculateSMA(chartData, dailyData, val, granularity);
           else if (indicator.type === 'EMA') newCache[val] = calculateEMA(chartData, dailyData, val, granularity);
           else if (indicator.type === 'ENV') newCache[val] = calculateEnvelope(chartData, dailyData, val, 20, granularity); // Base 20
           else if (indicator.type === 'BB')  newCache[val] = calculateBollinger(chartData, dailyData, val, 20, granularity); // Base 20
        }
        setCache(newCache);
        setLoading(false);
      } catch (e) {
        console.error("Calculation error", e);
        setLoading(false);
      }
    }, 800); // Délai pour l'effet "Decrypting"

    return () => clearTimeout(timer);
  }, [indicator.type, chartData, dailyData, granularity]); // Recalcul si la granularité change

  // 2. EFFET TEMPS RÉEL (SLIDER)
  useEffect(() => {
    // On vérifie que le cache contient bien la valeur (float precision safe)
    const safeParam = parseFloat(param.toFixed(2));

    if (!loading && cache[safeParam]) {
      onPreview({
        id: indicator.id,
        type: indicator.type,
        style: indicator.style,
        name: name,
        color: color,
        granularity: granularity, // On renvoie la granularité actuelle
        param: safeParam, // On renvoie la valeur unifiée
        period: (indicator.type === 'ENV' || indicator.type === 'BB') ? 20 : safeParam, // Compatibilité
        data: cache[safeParam] // Payload (Array ou {upper, lower...})
      });
    }
  }, [param, color, name, granularity, loading, cache, indicator.type, indicator.style, indicator.id]);

  // Handler Sauvegarde
  const handleSave = () => {
    onSave({
      ...indicator,
      param: param,
      period: (indicator.type === 'ENV' || indicator.type === 'BB') ? 20 : param,
      granularity,
      color,
      name
    });
    onClose();
  };

  return (
    <div className="absolute top-4 right-4 z-50 w-80 animate-in fade-in zoom-in duration-300">
      {/* Container Glassmorphism Neon */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-neon-blue/50 shadow-[0_0_30px_rgba(0,243,255,0.15)] overflow-hidden relative">
        
        {/* Header Decoration */}
        <div className="h-1 w-full bg-gradient-to-r from-neon-blue via-neon-purple to-neon-blue"></div>
        
        {/* Title Bar */}
        <div className="flex items-center justify-between p-3 border-b border-white/10">
           <div className="flex items-center gap-2 text-neon-blue">
              <Activity size={16} />
              <span className="text-xs font-bold uppercase tracking-widest">Config_{indicator.type}</span>
           </div>
           <button onClick={onClose} className="text-slate-500 hover:text-white transition">
              <X size={16} />
           </button>
        </div>

        {/* LOADING STATE */}
        {loading && (
           <div className="absolute inset-0 z-10 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3">
              <RotateCw size={32} className="text-neon-blue animate-spin duration-[2s]" />
              <div className="flex items-center gap-2 text-xs font-mono text-neon-blue animate-pulse">
                <Cpu size={12} />
                <span>RECALCULATING_VECTORS...</span>
              </div>
           </div>
        )}

        {/* CONTENT (Flouté si loading) */}
        <div className={`p-5 space-y-5 transition-all duration-500 ${loading ? 'blur-sm opacity-50' : 'blur-0 opacity-100'}`}>
            
            {/* 1. SLIDER DYNAMIQUE */}
            <div className="space-y-2">
                <div className="flex justify-between items-end">
                    <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">{config.label}</label>
                    <span className="text-xl font-mono text-neon-blue font-bold">
                        {param}
                        <span className="text-xs text-slate-600 ml-1">{indicator.type === 'ENV' ? '%' : indicator.type === 'BB' ? 'σ' : ''}</span>
                    </span>
                </div>
                <input 
                    type="range" 
                    min={config.min} 
                    max={config.max} 
                    step={config.step}
                    value={param}
                    onChange={(e) => setParam(parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-700 appearance-none cursor-pointer accent-neon-blue hover:accent-white transition-all"
                />
                <div className="flex justify-between text-[9px] text-slate-600 font-mono">
                    <span>{config.fast}</span>
                    <span>{config.slow}</span>
                </div>
            </div>

            <hr className="border-white/10" />

            {/* 2. GRANULARITÉ (NOUVEAU) */}
            <div className="space-y-2">
                <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider flex items-center gap-2">
                    <Layers size={10} /> Mode de calcul
                </label>
                <div className="flex bg-black/40 p-1 rounded border border-slate-700">
                    <button
                        onClick={() => setGranularity('days')}
                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-[10px] font-bold uppercase transition-all rounded ${granularity === 'days' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <Layers size={12} /> Daily (J)
                    </button>
                    <button
                        onClick={() => setGranularity('data')}
                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-[10px] font-bold uppercase transition-all rounded ${granularity === 'data' ? 'bg-neon-blue text-black shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <BarChart3 size={12} /> Chart (D)
                    </button>
                </div>
                <div className="text-[9px] text-slate-500 font-mono text-center">
                    {granularity === 'days' ? "Basé sur les clôtures journalières (Stable)" : "Basé sur les bougies affichées (Intraday)"}
                </div>
            </div>

            <hr className="border-white/10" />

            {/* 3. NAME */}
            <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Label Identifiant</label>
                <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black/50 border border-slate-700 focus:border-neon-blue p-2 text-xs text-white outline-none transition-colors"
                />
            </div>

            {/* 4. COLORS */}
            <div className="space-y-2">
                <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider flex items-center gap-2">
                    <Palette size={32} /> Signature Chromatique
                </label>
                <div className="grid grid-cols-10 gap-1.5">
                    {COLORS.map(c => (
                        <button
                            key={c}
                            onClick={() => setColor(c)}
                            className={`w-5 h-5 rounded-sm border transition-all hover:scale-110 ${color === c ? 'border-white scale-110 shadow-[0_0_10px_currentColor]' : 'border-transparent opacity-50 hover:opacity-100'}`}
                            style={{ backgroundColor: c, color: c }}
                        />
                    ))}
                </div>
            </div>

            {/* FOOTER ACTIONS */}
            <div className="pt-2">
                <button 
                    onClick={handleSave}
                    disabled={loading}
                    className="w-full bg-neon-blue/10 hover:bg-neon-blue/20 border border-neon-blue/50 text-neon-blue py-2 flex items-center justify-center gap-2 transition-all group"
                >
                    <Save size={16} className="group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold tracking-widest">ENREGISTRER</span>
                </button>
            </div>

        </div>
      </div>
    </div>
  );
}