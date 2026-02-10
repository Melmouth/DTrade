import { useState, useMemo } from 'react';
import { Settings2, Wand2, Palette, Activity, ChevronRight, ChevronLeft, LineChart, Layers, BarChart3 } from 'lucide-react';
import { marketApi } from '../api/client';

// Import du Registre et des Définitions
import { getAvailableIndicators, getIndicatorConfig, default as INDICATORS } from '../indicators/registry';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#fda4af', '#fdba74', '#fde047', '#bef264', '#86efac', '#6ee7b7', '#5eead4',
  '#67e8f9', '#7dd3fc', '#93c5fd', '#a5b4fc', '#c4b5fd', '#d8b4fe', '#f0abfc', '#f9a8d4'
];

export default function IndicatorMenu({ ticker, onAddIndicator }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null); // Juste l'ID
  const [mode, setMode] = useState('manual');
  const [loading, setLoading] = useState(false);

  // Form States Dynamiques
  const [color, setColor] = useState('#3b82f6');
  const [customName, setCustomName] = useState('');
  
  // NOUVEAU : On stocke tous les paramètres dans un objet (ex: { period: 20, stdDev: 2 })
  const [formParams, setFormParams] = useState({}); 
  
  // Granularité
  const [granularity, setGranularity] = useState('days');
  
  // Smart Params
  const [smartTarget, setSmartTarget] = useState(50);
  const [smartLookback, setSmartLookback] = useState(365);

  // Récupération de la liste depuis le registre
  const availableIndicators = useMemo(() => getAvailableIndicators(), []);

  // Récupération de la définition complète de l'indicateur sélectionné (pour construire le UI)
  const currentDef = selectedId ? INDICATORS[selectedId] : null;

  const resetMenu = () => {
    setIsOpen(false);
    setTimeout(() => {
        setSelectedId(null);
        setFormParams({});
        setMode('manual');
        setGranularity('days');
        setCustomName('');
    }, 200);
  };

  const handleSelect = (ind) => {
    setSelectedId(ind.id);
    
    // 1. Charger la config par défaut depuis le registre
    const config = getIndicatorConfig(ind.id);
    setFormParams(config.params);
    setColor(config.color || '#3b82f6');
    setGranularity(config.granularity || 'days');

    // 2. Initialisation Smart Target par défaut selon le type
    if (ind.type === 'BAND') setSmartTarget(80);
    else setSmartTarget(50);
  };

  const handleParamChange = (key, value) => {
    setFormParams(prev => ({
        ...prev,
        [key]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let finalParams = { ...formParams };
      let displayName = customName;

      // --- LOGIQUE SMART (Adaptée au registre) ---
      // On garde les appels API existants, mais on mappe le résultat vers le bon paramètre
      if (mode === 'smart') {
        const decimalTarget = smartTarget / 100;
        let res;

        // Note: L'API attend toujours des endpoints spécifiques pour le moment
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
            finalParams.deviation = res.data.optimal_k; // Mappé vers 'deviation' (défini dans volatility.js)
        } 
        else if (selectedId === 'BB') {
            res = await marketApi.calculateSmartBollinger(ticker, decimalTarget, smartLookback);
            finalParams.stdDev = res.data.optimal_k; // Mappé vers 'stdDev' (défini dans volatility.js)
        }
      }

      // --- NOMMAGE AUTOMATIQUE GÉNÉRIQUE ---
      if (!displayName) {
        const smartTag = mode === 'smart' ? ` [Smart ${smartTarget}%]` : '';
        const granTag = granularity === 'data' ? ' (Intraday)' : '';
        
        // On construit le nom basé sur les params principaux (le premier paramètre défini)
        const mainParamKey = Object.keys(finalParams)[0]; 
        const mainParamVal = finalParams[mainParamKey];
        
        displayName = `${currentDef.name} (${mainParamVal})${smartTag}${granTag}`;
      }

      // --- CREATION DE L'OBJET FINAL ---
      onAddIndicator({
        id: Date.now(),
        type: selectedId, // Clé du registre (SMA, BB...)
        style: currentDef.type, // LINE ou BAND (info venant de la définition)
        
        // Payload principal
        params: finalParams,
        granularity: granularity,
        color: color,
        name: displayName,

        // Meta-data pour l'UI
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

  // Helper pour choisir l'icône dynamiquement
  const getIcon = (type) => {
      if (type === 'BAND') return Layers;
      return LineChart;
  };

  return (
    <div className="relative z-50">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 border px-3 py-1.5 rounded-none transition-all text-xs font-bold uppercase tracking-wider
          ${isOpen 
            ? 'bg-slate-800 border-neon-blue text-neon-blue shadow-[0_0_10px_rgba(0,243,255,0.2)]' 
            : 'bg-slate-900/50 hover:bg-slate-800 border-slate-700 text-slate-300'
          }`}
      >
        <Activity size={14} className={isOpen ? "text-neon-blue" : "text-emerald-400"}/> Indicateurs
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={resetMenu}></div>
          
          <div className="absolute top-full left-0 mt-2 w-80 bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col z-50">
            
            {!selectedId ? (
              /* --- LISTE DES INDICATEURS (GÉNÉRÉE DEPUIS LE REGISTRE) --- */
              <div className="p-2 space-y-1 max-h-[400px] overflow-y-auto custom-scrollbar">
                <div className="px-2 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800 mb-1">
                  Bibliothèque
                </div>
                {availableIndicators.map((ind) => {
                  const Icon = getIcon(ind.type);
                  return (
                    <button
                        key={ind.id}
                        onClick={() => handleSelect(ind)}
                        className="w-full flex items-center justify-between p-3 hover:bg-slate-800 group transition text-left"
                    >
                        <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-800 group-hover:bg-slate-700 text-emerald-400 transition">
                            <Icon size={18} />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-slate-200">{ind.name}</div>
                            <div className="text-[10px] text-slate-500 flex gap-2">
                                {ind.tags?.map(t => <span key={t} className="bg-slate-800 px-1 rounded">{t}</span>)}
                            </div>
                        </div>
                        </div>
                        <ChevronRight size={14} className="text-slate-600 group-hover:text-white" />
                    </button>
                  );
                })}
              </div>
            ) : (
              /* --- FORMULAIRE DE CONFIGURATION --- */
              <div className="animate-in slide-in-from-right-10 duration-200">
                <div className="flex items-center gap-2 p-2 border-b border-slate-800 bg-slate-800/30">
                  <button 
                    onClick={() => setSelectedId(null)}
                    className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs font-bold text-white uppercase tracking-wider">{currentDef?.name}</span>
                </div>

                <div className="flex border-b border-slate-800">
                  <button 
                    onClick={() => setMode('manual')}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition ${mode === 'manual' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-800/50'}`}
                  >
                    <Settings2 size={14} /> Manuel
                  </button>
                  <button 
                    onClick={() => setMode('smart')}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition ${mode === 'smart' ? 'bg-indigo-900/30 text-indigo-400' : 'text-slate-500 hover:bg-slate-800/50'}`}
                  >
                    <Wand2 size={14} /> Smart
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                  {mode === 'manual' ? (
                    <>
                        {/* --- GÉNÉRATION DYNAMIQUE DES INPUTS --- */}
                        {currentDef && Object.entries(currentDef.params).map(([key, field]) => (
                             <div key={key} className="space-y-2">
                                <label className="text-xs text-slate-400 font-bold uppercase">{field.label}</label>
                                {field.type === 'select' ? (
                                    <select
                                        value={formParams[key]}
                                        onChange={(e) => handleParamChange(key, e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 p-2 text-sm text-white focus:border-emerald-500 outline-none"
                                    >
                                        {field.options.map(opt => (
                                            <option key={opt} value={opt}>{opt.toUpperCase()}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input 
                                        type="number"
                                        min={field.min}
                                        max={field.max}
                                        step={field.step || 1}
                                        value={formParams[key]}
                                        onChange={(e) => handleParamChange(key, parseFloat(e.target.value))}
                                        className="w-full bg-slate-950 border border-slate-700 p-2 text-sm text-white focus:border-emerald-500 outline-none"
                                    />
                                )}
                             </div>
                        ))}

                        {/* --- SÉLECTEUR DE GRANULARITÉ --- */}
                        <div className="space-y-2">
                            <label className="text-xs text-slate-400 font-bold uppercase">Granularité</label>
                            <div className="flex bg-slate-950 border border-slate-700 rounded p-1">
                                <button
                                    type="button"
                                    onClick={() => setGranularity('days')}
                                    className={`flex-1 text-[10px] font-bold py-1 uppercase transition ${granularity === 'days' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    Jours (1D)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setGranularity('data')}
                                    className={`flex-1 flex items-center justify-center gap-1 text-[10px] font-bold py-1 uppercase transition ${granularity === 'data' ? 'bg-neon-blue text-black shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <BarChart3 size={10} /> Chart (Data)
                                </button>
                            </div>
                        </div>
                    </>
                  ) : (
                    /* --- MODE SMART (UNCHANGED) --- */
                    <div className="space-y-4">
                      <div className="p-3 bg-indigo-900/20 border border-indigo-900/50 text-xs text-indigo-200 leading-relaxed">
                        {currentDef.type === 'BAND' 
                             ? `L'IA optimise la largeur pour contenir ${smartTarget}% des bougies.` 
                             : `L'IA optimise la période pour que ${smartTarget}% des prix soient au-dessus.`
                        }
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <label className="text-xs text-slate-400 font-bold uppercase">
                              Cible % {currentDef.type === 'BAND' ? 'Inside' : 'Up'}
                          </label>
                          <span className="text-xs font-mono text-indigo-400">{smartTarget}%</span>
                        </div>
                        <input 
                          type="range" min="10" max="95"
                          value={smartTarget}
                          onChange={(e) => setSmartTarget(parseInt(e.target.value))}
                          className="w-full h-1 bg-slate-700 appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-slate-400 font-bold uppercase">Historique (Jours)</label>
                        <select 
                          value={smartLookback}
                          onChange={(e) => setSmartLookback(parseInt(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-700 p-2 text-sm text-white focus:border-indigo-500 outline-none"
                        >
                          <option value="30">1 Mois</option>
                          <option value="90">3 Mois</option>
                          <option value="180">6 Mois</option>
                          <option value="365">1 An</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <hr className="border-slate-800" />

                  {/* --- GLOBAL SETTINGS (NOM & COULEUR) --- */}
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 font-bold uppercase">Nom (Optionnel)</label>
                      <input 
                        type="text" 
                        placeholder={mode === 'manual' ? `ex: ${currentDef.name}` : "ex: Support Dynamique"}
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 p-2 text-xs text-white focus:border-slate-500 outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400 font-bold uppercase flex items-center gap-2"><Palette size={12} /> Couleur</label>
                      <div className="grid grid-cols-8 gap-1">
                        {PRESET_COLORS.map(c => (
                          <button
                            key={c} type="button" onClick={() => setColor(c)}
                            className={`w-6 h-6 border-2 transition ${color === c ? 'border-white scale-110' : 'border-transparent hover:scale-110'}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <button 
                    type="submit" disabled={loading}
                    className={`w-full py-2 text-sm font-bold text-white transition shadow-lg
                      ${mode === 'manual' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500'}
                      ${loading ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    {loading ? 'Calcul...' : 'Ajouter'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}