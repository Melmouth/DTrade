import { useState, useEffect, useMemo } from 'react';
import { Activity, Search, Settings, X, Eye, Edit2, Terminal, Cpu, Radio, ShieldCheck, Wifi, ScanEye } from 'lucide-react';

// --- COMPONENTS ---
import SettingsModal from './components/SettingsModal';
import Sidebar from './components/Sidebar';
import StockChart from './components/StockChart';
import AddToPortfolio from './components/AddToPortfolio';
import IndicatorMenu from './components/IndicatorMenu';
import IndicatorEditor from './components/IndicatorEditor';
import BootSequence from './components/BootSequence';
import CompanyInfo from './components/CompanyInfo';
import MarketStatus from './components/MarketStatus';

// --- CUSTOM HOOKS (Le Refactoring) ---
import { useIndicatorManager } from './hooks/useIndicatorManager';
import { useMarketData } from './hooks/useMarketData';
import { useLiveFeed } from './hooks/useLiveFeed';
import { marketApi } from './api/client';

const DEFAULT_SETTINGS = { wsInterval: 15, historyPeriod: '1mo' };
const STORAGE_KEYS = { SETTINGS: 'trading_settings' };

function App() {
  // --- 1. ÉTATS UI GLOBAUX ---
  const [booted, setBooted] = useState(false);
  const [ticker, setTicker] = useState('MSFT');
  const [showSettings, setShowSettings] = useState(false);
  const [showCompanyInfo, setShowCompanyInfo] = useState(false);
  
  // États de l'éditeur d'indicateur (Restent dans App car ce sont des états UI éphémères)
  const [editingIndicator, setEditingIndicator] = useState(null);
  const [previewSeries, setPreviewSeries] = useState(null);

  // Sidebar Data (Léger, on le garde ici pour l'instant)
  const [sidebarData, setSidebarData] = useState([]);

  // Settings App
  const [appSettings, setAppSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });

  // --- 2. INTEGRATION DES HOOKS ---
  
  // Gestion des Données Historiques & Périodes
  const { 
    chartData, 
    dailyData, 
    meta: chartMeta, 
    loading, 
    error, 
    activePeriod: currentPeriod, 
    setPeriod: handlePeriodChange, 
    refetch,
    nukeViews 
  } = useMarketData(ticker, appSettings.historyPeriod);

  // Gestion des Indicateurs (CRUD + Persistance)
  const { 
    indicators: currentIndicators, 
    addIndicator: handleAddIndicator, 
    removeIndicator, 
    toggleVisibility: toggleIndicatorVisibility, 
    updateIndicator: hookUpdateIndicator, 
    nukeIndicators 
  } = useIndicatorManager(ticker);

  // Gestion du Flux Live (WebSocket)
  const { 
    quote: liveQuote, 
    livePrice, 
    isConnected 
  } = useLiveFeed(ticker, appSettings.wsInterval);

  // --- 3. LOGIQUE & EFFETS DE BORD ---

  // Chargement Sidebar
  useEffect(() => {
    loadSidebar();
  }, []);

  const loadSidebar = async () => {
    try {
      const res = await marketApi.getSidebarData();
      setSidebarData(res.data);
    } catch (err) { console.error("Sidebar load error", err); }
  };

  // Handler Search (Force le refetch si on tape entrée sur le même ticker)
  const handleSearch = (e) => {
    e.preventDefault();
    refetch(); 
  };

  // Handler Settings Save
  const handleSettingsSave = (newSettings) => {
    setAppSettings(newSettings);
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings));
    // Si la période historique par défaut change, le hook useMarketData s'adaptera au prochain mount ou changement de ticker
  };

  // Handler Nuke (Reset Total)
  const handleNuke = () => {
    setTicker('MSFT');
    nukeIndicators();
    nukeViews();
    loadSidebar();
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    setAppSettings(DEFAULT_SETTINGS);
  };

  // Wrappers pour l'éditeur d'indicateur
  const updateIndicator = (updatedInd) => {
    hookUpdateIndicator(updatedInd);
    setEditingIndicator(null);
    setPreviewSeries(null);
  };

  const handleEditClick = (ind) => {
    setEditingIndicator(ind);
    setPreviewSeries(null);
  };

  const handleEditorClose = () => {
    setEditingIndicator(null);
    setPreviewSeries(null);
  };

  // --- 4. LOGIQUE D'AFFICHAGE PRIX (Fallback Historique si Live pas encore là) ---
  // Pour éviter le "0.00" ou "---" au chargement avant que le WS ne connecte
  const displayPrice = useMemo(() => {
    if (livePrice) return livePrice;
    if (chartData && chartData.length > 0) return chartData[chartData.length - 1].close;
    return null;
  }, [livePrice, chartData]);

  // --- 5. RENDER ---
  if (!booted) {
    return <BootSequence onComplete={() => setBooted(true)} />;
  }

  return (
    <div className="h-screen bg-black text-slate-300 font-mono flex flex-col overflow-hidden relative selection:bg-neon-blue selection:text-black">
      
      {/* --- CRT GRIDLINES (OVERLAY) --- */}
      <div className="fixed inset-0 z-[100] pointer-events-none" 
           style={{ 
             background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 243, 255, 0.03) 3px)',
             backgroundSize: '100% 100%'
           }}>
      </div>
      
      {/* Vignette d'écran sombre */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.5)_100%)]"></div>

      {/* HEADER */}
      <header className="h-14 border-b border-slate-800 bg-black/80 backdrop-blur-md flex items-center justify-between px-4 shrink-0 z-40 relative">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 border border-neon-blue/30 px-2 py-1 bg-neon-blue/5">
              <div className={`w-2 h-2 ${isConnected ? 'bg-neon-blue animate-pulse shadow-[0_0_10px_#00f3ff]' : 'bg-red-500'} rounded-full`}></div>
              <span className={`text-[10px] font-bold tracking-widest ${isConnected ? 'text-neon-blue' : 'text-red-500'}`}>
                {isConnected ? 'ONLINE' : 'OFFLINE'}
              </span>
          </div>
          <h1 className="text-xl font-bold tracking-[0.2em] text-white">
            DEIMOS <span className="text-slate-600 text-sm">//</span> <span className="text-slate-500 text-sm">TERMINAL v4.2</span>
          </h1>
        </div>
        
        <div className="flex gap-6 items-center">
          <div className="hidden lg:flex items-center gap-4 text-[10px] text-slate-500 font-bold tracking-wider">
              <div className="flex items-center gap-1"><ShieldCheck size={12}/> SECURE_CONN</div>
              <div className="flex items-center gap-1"><Wifi size={12}/> {appSettings.wsInterval * 10}ms</div>
          </div>

          <form onSubmit={handleSearch} className="flex gap-0 group relative">
            <div className="relative flex">
                <div className="bg-slate-900 border border-slate-700 border-r-0 px-2 flex items-center text-slate-500 group-hover:text-neon-blue transition-colors">
                    <Terminal size={14} />
                </div>
                <input 
                type="text" 
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                className="bg-black border border-slate-700 border-x-0 w-24 md:w-32 text-sm text-white focus:outline-none focus:bg-slate-900/50 placeholder:text-slate-700 uppercase tracking-wider"
                placeholder="TICKER"
                />
                <button type="submit" className="bg-slate-900 border border-slate-700 border-l-0 px-3 hover:bg-neon-blue hover:text-black transition-all duration-300 text-slate-400 font-bold">
                    <Search size={14} />
                </button>
            </div>
          </form>
          
          <div className="h-6 w-[1px] bg-slate-800 mx-2"></div>

          <button onClick={() => setShowSettings(true)} className="text-slate-500 hover:text-neon-blue transition-all duration-300 hover:rotate-90 hover:shadow-[0_0_15px_rgba(0,243,255,0.4)] rounded-full p-1">
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <div className="flex-1 flex overflow-hidden relative z-0">
        
        <aside className="w-64 shrink-0 hidden md:block border-r border-slate-800 bg-black/90 backdrop-blur-sm z-10">
          <Sidebar 
            data={sidebarData} 
            currentTicker={ticker}
            onSelectTicker={setTicker}
            onReload={loadSidebar}
          />
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden relative z-0">
          <div className="flex-1 p-0 md:p-6 overflow-y-auto">
            <div className="max-w-[1600px] mx-auto space-y-6">
              
              {/* INFO BAR */}
              <div className="flex flex-wrap items-end justify-between gap-6 border-b border-slate-800/80 pb-6 relative">
                 <div className="absolute -bottom-[1px] left-0 w-20 h-[2px] bg-neon-blue shadow-[0_0_10px_#00f3ff]"></div>
                 <div className="absolute -bottom-[1px] right-0 w-4 h-[2px] bg-slate-600"></div>

                 <div>
                    <div className="flex items-center gap-2 text-neon-blue/70 text-xs tracking-[0.2em] mb-2 font-bold">
                        <Cpu size={14} className="animate-spin-slow" /> TARGET_ASSET_LOCKED
                    </div>
                    <div className="flex items-center gap-4 group">
                           <h2 className="text-5xl md:text-6xl font-bold tracking-tighter text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.15)] glitch-effect">
                               {ticker}
                           </h2>
                           <button 
                               onClick={() => setShowCompanyInfo(true)}
                               className="opacity-50 group-hover:opacity-100 transition-all duration-300 hover:scale-110 mt-2"
                               title="ANALYSE FONDAMENTALE"
                           >
                               <div className="p-2 border border-neon-blue/30 bg-neon-blue/5 hover:bg-neon-blue/20 rounded-lg text-neon-blue shadow-[0_0_10px_rgba(0,243,255,0.1)] hover:shadow-[0_0_20px_rgba(0,243,255,0.4)]">
                                   <ScanEye size={24} />
                               </div>
                           </button>
                    </div>
                 </div>
                 
                 <div className="mb-2 md:mb-0 md:ml-auto md:mr-6">
                    <MarketStatus ticker={ticker} type="full" />
                 </div>

                 <div className="text-right">
                    <div className="text-[10px] text-slate-500 tracking-[0.3em] uppercase mb-1">Current Price Assessment</div>
                    <div className="flex items-baseline gap-3 justify-end">
                       <Radio size={12} className="text-red-500 animate-pulse" />
                       <span className="text-5xl font-bold text-neon-blue font-mono tabular-nums tracking-tight text-shadow-neon">
                          {displayPrice ? displayPrice.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "---.--"}
                       </span>
                       <span className="text-sm font-bold text-slate-500">USD</span>
                    </div>
                 </div>
              </div>

              {/* CONTROLS BAR */}
              <div className="flex items-center justify-between bg-slate-900/40 border border-slate-800 p-3 backdrop-blur-sm relative z-20">
                 <div className="absolute top-0 left-0 w-1 h-full bg-neon-blue"></div>
                 <IndicatorMenu ticker={ticker} onAddIndicator={handleAddIndicator} />
                 <AddToPortfolio ticker={ticker} portfolios={sidebarData} onUpdate={loadSidebar} />
              </div>

              {/* LISTE INDICATEURS */}
              {currentIndicators.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {currentIndicators.map(ind => (
                    <div key={ind.id} className={`relative flex items-center gap-2 px-3 py-1.5 text-[10px] border tracking-wider transition-all uppercase group ${ind.visible ? 'bg-slate-900/90 border-neon-blue/30 text-neon-blue shadow-[0_0_10px_rgba(0,243,255,0.1)]' : 'bg-transparent border-slate-800 text-slate-600 dashed opacity-70'}`}>
                      <div className={`w-1.5 h-1.5 shadow-[0_0_5px_currentColor] ${!ind.visible && 'opacity-20'}`} style={{ backgroundColor: ind.color }}></div>
                      <span className="font-bold">{ind.name}</span>
                      
                      {/* BOUTONS D'ACTION */}
                      <div className="flex gap-2 ml-2 pl-2 border-l border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                             onClick={() => handleEditClick(ind)} 
                             className="hover:text-white hover:scale-110 transition text-neon-orange"
                             title="Configurer"
                          >
                             <Edit2 size={12} />
                          </button>
                          
                          <button onClick={() => toggleIndicatorVisibility(ind.id)} className="hover:text-white hover:scale-110 transition">
                            {ind.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                          </button>
                          <button onClick={() => removeIndicator(ind.id)} className="hover:text-red-500 hover:scale-110 transition"><X size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                  <div className="p-4 border border-red-900/80 bg-red-950/20 text-red-500 text-xs font-mono flex items-center gap-3 shadow-[inset_0_0_20px_rgba(255,0,0,0.1)]">
                      <span className="w-2 h-2 bg-red-500 animate-ping"></span>
                      <span className="font-bold tracking-widest">CRITICAL ERROR :: {error}</span>
                  </div>
              )}

              {/* CHART CONTAINER */}
              <div className="border border-slate-800 bg-black/50 relative shadow-2xl z-0">
                  <div className="absolute -top-[1px] -left-[1px] w-6 h-6 border-t-2 border-l-2 border-neon-blue z-20"></div>
                  <div className="absolute -top-[1px] -right-[1px] w-6 h-6 border-t-2 border-r-2 border-neon-blue z-20"></div>
                  <div className="absolute -bottom-[1px] -left-[1px] w-6 h-6 border-b-2 border-l-2 border-neon-blue z-20"></div>
                  <div className="absolute -bottom-[1px] -right-[1px] w-6 h-6 border-b-2 border-r-2 border-neon-blue z-20"></div>

                  {/* INSERTION : EDITOR GLASS WINDOW */}
                  {editingIndicator && (
                      <IndicatorEditor 
                          indicator={editingIndicator}
                          chartData={chartData}
                          dailyData={dailyData}
                          onClose={handleEditorClose}
                          onSave={updateIndicator}
                          onPreview={(previewData) => setPreviewSeries(previewData)}
                      />
                  )}

                  <StockChart 
                    data={chartData} 
                    dailyData={dailyData}
                    meta={chartMeta}
                    loading={loading}
                    activePeriod={currentPeriod}
                    onPeriodChange={handlePeriodChange}
                    indicators={currentIndicators}
                    previewSeries={previewSeries}
                    livePrice={livePrice}
                  />
              </div>

              {/* FOOTER */}
              <div className="flex justify-between text-[10px] text-slate-700 font-mono tracking-[0.2em] select-none pt-4 opacity-50">
                  <div>SYS.ID: D-402-X</div>
                  <div>MEMORY: 64TB // ENCRYPTED</div>
                  <div>COORD: 45.20.11</div>
              </div>

            </div>
          </div>
        </main>
      </div>

      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)}
        settings={appSettings}
        onSave={handleSettingsSave}
        onNuke={handleNuke}
      />

      <CompanyInfo 
        ticker={ticker} 
        isOpen={showCompanyInfo} 
        onClose={() => setShowCompanyInfo(false)} 
      />
    </div>
  );
}

export default App;