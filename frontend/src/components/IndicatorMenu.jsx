import { useState } from 'react';
import { Settings2, Wand2, Palette, Activity, ChevronRight, ChevronLeft, LineChart, Layers, Percent } from 'lucide-react';
import { marketApi } from '../api/client';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#fda4af', '#fdba74', '#fde047', '#bef264', '#86efac', '#6ee7b7', '#5eead4',
  '#67e8f9', '#7dd3fc', '#93c5fd', '#a5b4fc', '#c4b5fd', '#d8b4fe', '#f0abfc', '#f9a8d4'
];

const AVAILABLE_INDICATORS = [
  { id: 'SMA', name: 'Moyenne Mobile (SMA)', icon: LineChart, desc: 'Tendance lissée simple', type: 'LINE' },
  { id: 'EMA', name: 'Exponentielle (EMA)', icon: Activity, desc: 'Réactive aux prix récents', type: 'LINE' },
  { id: 'ENV', name: 'Enveloppe', icon: Layers, desc: 'Canal de volatilité (%)', type: 'BAND' },
  { id: 'BB',  name: 'Bollinger Bands', icon: Activity, desc: 'StdDev Volatility', type: 'BAND' },
];

export default function IndicatorMenu({ ticker, onAddIndicator }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedInd, setSelectedInd] = useState(null); // Stocke l'objet indicateur complet
  const [mode, setMode] = useState('manual');
  const [loading, setLoading] = useState(false);

  // Form States
  const [color, setColor] = useState('#3b82f6');
  const [customName, setCustomName] = useState('');
  
  // Paramètre générique (Période N ou Facteur K/%)
  const [param, setParam] = useState(20); 
  
  // Nouveau state pour la granularité
  const [granularity, setGranularity] = useState('days'); // 'days' ou 'data'
  
  // Smart Params
  const [smartTarget, setSmartTarget] = useState(50);
  const [smartLookback, setSmartLookback] = useState(365);

  const resetMenu = () => {
    setIsOpen(false);
    setTimeout(() => {
        setSelectedInd(null);
        setParam(20);
        setMode('manual');
        setGranularity('days'); // Reset granularité
    }, 200);
  };

  const handleSelect = (ind) => {
    setSelectedInd(ind);
    
    // Initialisation des valeurs par défaut selon le type
    if (ind.id === 'ENV') setParam(5); // 5% par défaut
    else if (ind.id === 'BB') setParam(2.0); // 2.0 StdDev par défaut
    else setParam(20); // 20 jours par défaut pour SMA/EMA

    // Initialisation Smart Target (50% pour Trend, 80% pour Bandes)
    if (ind.type === 'BAND') setSmartTarget(80);
    else setSmartTarget(50);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let finalParam = param;
      let displayName = customName;

      // --- LOGIQUE SMART ---
      if (mode === 'smart') {
        const decimalTarget = smartTarget / 100;
        let res;

        // Appel API selon le type
        if (selectedInd.id === 'SMA') {
            res = await marketApi.calculateSmartSMA(ticker, decimalTarget, smartLookback);
            finalParam = res.data.optimal_n;
        } 
        else if (selectedInd.id === 'EMA') {
            res = await marketApi.calculateSmartEMA(ticker, decimalTarget, smartLookback);
            finalParam = res.data.optimal_n;
        } 
        else if (selectedInd.id === 'ENV') {
            res = await marketApi.calculateSmartEnvelope(ticker, decimalTarget, smartLookback);
            finalParam = res.data.optimal_k; // Retourne le % optimal
        } 
        else if (selectedInd.id === 'BB') {
            res = await marketApi.calculateSmartBollinger(ticker, decimalTarget, smartLookback);
            finalParam = res.data.optimal_k; // Retourne le multiplicateur optimal
        }
      }

      // --- NOMMAGE AUTOMATIQUE ---
      if (!displayName) {
        const smartTag = mode === 'smart' ? ` [Smart ${smartTarget}%]` : '';
        const granTag = granularity === 'data' ? ' (Intraday)' : ''; // Petit tag si mode Data

        if (selectedInd.id === 'SMA') displayName = `SMA ${finalParam}${smartTag}${granTag}`;
        if (selectedInd.id === 'EMA') displayName = `EMA ${finalParam}${smartTag}${granTag}`;
        if (selectedInd.id === 'ENV') displayName = `Env ${finalParam}%${smartTag}${granTag}`;
        if (selectedInd.id === 'BB')  displayName = `BB (${finalParam}σ)${smartTag}${granTag}`;
      }

      // --- CREATION DE L'OBJET ---
      onAddIndicator({
        id: Date.now(),
        type: selectedInd.id, // SMA, EMA, ENV, BB
        style: selectedInd.type, // LINE ou BAND
        
        // Pour les bandes, la période de base est souvent fixe (20) et on joue sur l'écart (param)
        // Pour les lignes, la période EST le paramètre.
        period: (selectedInd.id === 'ENV' || selectedInd.id === 'BB') ? 20 : Math.floor(finalParam),
        param: finalParam, // C'est la valeur qui sera éditable dans le slider (N, %, ou K)
        
        granularity: granularity, // Ajout de la granularité

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

  // Helper pour le label du champ principal
  const getParamLabel = () => {
      if (!selectedInd) return '';
      if (selectedInd.id === 'ENV') return 'Écart (%)';
      if (selectedInd.id === 'BB') return 'Multiplicateur (StdDev)';
      return 'Période (N)';
  };

  // Helper pour le step de l'input
  const getStep = () => {
      if (!selectedInd) return 1;
      return (selectedInd.id === 'ENV' || selectedInd.id === 'BB') ? 0.1 : 1;
  };

  // --- CORRECTION : Helper pour le min de l'input ---
  const getMin = () => {
      if (!selectedInd) return 1;
      // Pour les bandes (décimales), on commence à 0.1
      if (selectedInd.id === 'ENV' || selectedInd.id === 'BB') return 0.1;
      // Pour les SMA/EMA (entiers), on commence à 1
      return 1;
  };

  return (
    // Z-INDEX BOOSTED (z-50) et relative pour servir de référent
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
            
            {!selectedInd ? (
              <div className="p-2 space-y-1">
                <div className="px-2 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800 mb-1">
                  Choisir un indicateur
                </div>
                {AVAILABLE_INDICATORS.map((ind) => (
                  <button
                    key={ind.id}
                    onClick={() => handleSelect(ind)}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-800 group transition text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-800 group-hover:bg-slate-700 text-emerald-400 transition">
                        <ind.icon size={18} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-200">{ind.name}</div>
                        <div className="text-[10px] text-slate-500">{ind.desc}</div>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-slate-600 group-hover:text-white" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="animate-in slide-in-from-right-10 duration-200">
                <div className="flex items-center gap-2 p-2 border-b border-slate-800 bg-slate-800/30">
                  <button 
                    onClick={() => setSelectedInd(null)}
                    className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs font-bold text-white uppercase tracking-wider">{selectedInd.name}</span>
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
                        <div className="space-y-2">
                            <label className="text-xs text-slate-400 font-bold uppercase">{getParamLabel()}</label>
                            <input 
                                type="number" 
                                min={getMin()} /* Utilisation du helper dynamique */
                                max="500" 
                                step={getStep()}
                                value={param}
                                onChange={(e) => setParam(parseFloat(e.target.value))}
                                className="w-full bg-slate-950 border border-slate-700 p-2 text-sm text-white focus:border-emerald-500 outline-none"
                            />
                        </div>

                        {/* --- AJOUT DU SÉLECTEUR DE GRANULARITÉ --- */}
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
                                    className={`flex-1 text-[10px] font-bold py-1 uppercase transition ${granularity === 'data' ? 'bg-neon-blue text-black shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    Chart (Data)
                                </button>
                            </div>
                        </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-3 bg-indigo-900/20 border border-indigo-900/50 text-xs text-indigo-200 leading-relaxed">
                        {selectedInd.type === 'BAND' 
                             ? `L'IA optimise la largeur pour contenir ${smartTarget}% des bougies.` 
                             : `L'IA optimise N pour que ${smartTarget}% des prix soient sup. à l'indicateur.`
                        }
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <label className="text-xs text-slate-400 font-bold uppercase">
                              Cible % {selectedInd.type === 'BAND' ? 'Inside' : 'Up'}
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

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 font-bold uppercase">Nom (Optionnel)</label>
                      <input 
                        type="text" 
                        placeholder={mode === 'manual' ? `ex: ${selectedInd.id} ${param}` : "ex: Support Dynamique"}
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