import { useState, useEffect, useMemo } from 'react';
import { 
  Search, Settings, X, Eye, EyeOff, Edit2, Terminal, Cpu, Radio, ShieldCheck, Wifi, ScanEye,
  LayoutDashboard, Briefcase, Wallet 
} from 'lucide-react';

// --- COMPONENTS ---
import SettingsModal from './components/SettingsModal';
import Sidebar from './components/Sidebar';
import StockChart from './components/StockChart';
import AddToWatchlist from './components/AddToWatchlist';
import IndicatorMenu from './components/IndicatorMenu';
import IndicatorEditor from './components/IndicatorEditor';
import BootSequence from './components/BootSequence';
import CompanyInfo from './components/CompanyInfo';
import MarketStatus from './components/MarketStatus';
// NOUVEAU : Import de la vue Portfolio (sera créé juste après)
import PortfolioView from './components/PortfolioView'; 

// --- HOOKS ---
import { useIndicatorManager } from './hooks/useIndicatorManager';
import { useMarketStream } from './hooks/useMarketStream';
import { usePriceStore } from './hooks/usePriceStore';
import { useGlobalStream } from './hooks/useGlobalStream';
import { marketApi } from './api/client';

const DEFAULT_SETTINGS = { wsInterval: 15, historyPeriod: '1mo' };
const STORAGE_KEYS = { SETTINGS: 'trading_settings' };

function App() {
  // --- 1. ÉTATS UI GLOBAUX ---
  const [booted, setBooted] = useState(false);
  const [currentView, setCurrentView] = useState('MARKET'); // 'MARKET' | 'PORTFOLIO'
  
  const [ticker, setTicker] = useState('MSFT'); 
  const [searchInput, setSearchInput] = useState('MSFT');
  const [showSettings, setShowSettings] = useState(false);
  const [showCompanyInfo, setShowCompanyInfo] = useState(false);
  
  // États Édition Indicateurs
  const [editingIndicator, setEditingIndicator] = useState(null);
  const [previewSeries, setPreviewSeries] = useState(null);

  // Données Sidebar (Watchlists)
  const [sidebarData, setSidebarData] = useState([]);

  // --- 2. STORE GLOBAL & FLUX ---
  const { prices: globalPrices, updatePrice } = usePriceStore();
  
  // Connexion au flux global (WebSocket Sidebar & Portfolio Update)
  // Reste actif peu importe la vue pour garantir la data fraiche
  useGlobalStream(updatePrice); 

  // Settings locaux
  const [appSettings, setAppSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });

  // --- 3. FLUX MARKET (Graphique Actif) ---
  // On ne coupe pas le flux Market quand on change de vue pour garder la réactivité au retour
  const streamTicker = booted ? ticker : null;

  const { 
    data: streamData, 
    loading, 
    error, 
    period: currentPeriod, 
    setPeriod: handlePeriodChange, 
    refresh: refetch 
  } = useMarketStream(streamTicker, appSettings.wsInterval, appSettings.historyPeriod);

  // Synchronisation du ticker actif vers le store global
  useEffect(() => {
    if (streamData?.live && ticker) {
      updatePrice(ticker, streamData.live);
    }
  }, [streamData?.live, ticker, updatePrice]);

  // Extraction des données stabilisées pour le graphique
  const chartData = useMemo(() => streamData?.chart?.data || [], [streamData?.chart?.data]);
  const dailyData = useMemo(() => streamData?.chart?.daily_data || streamData?.chart?.data || [], [streamData?.chart?.daily_data, streamData?.chart?.data]);
  
  const chartMeta = streamData?.chart?.meta;
  const companyInfo = streamData?.info;
  const liveData = streamData?.live;
  
  const isConnected = !error && streamData !== null;

  // --- 4. GESTION DES INDICATEURS ---
  const { 
    indicators: currentIndicators, 
    addIndicator: handleAddIndicator, 
    removeIndicator, 
    toggleVisibility: toggleIndicatorVisibility, 
    updateIndicator: hookUpdateIndicator, 
    nukeIndicators 
  } = useIndicatorManager(ticker);

  // --- 5. LOGIQUE MÉTIER ---
  useEffect(() => { loadSidebar(); }, []);

  const loadSidebar = async () => {
    try {
      const res = await marketApi.getSidebarData();
      setSidebarData(res.data);
    } catch (err) { console.error("Sidebar load error", err); }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
        setTicker(searchInput.toUpperCase());
        // Si on cherche un ticker, on bascule auto sur la vue Market
        if (currentView !== 'MARKET') setCurrentView('MARKET');
    }
  };

  const handleSidebarSelect = (selectedTicker) => {
      setTicker(selectedTicker);
      setSearchInput(selectedTicker);
      if (currentView !== 'MARKET') setCurrentView('MARKET');
  };

  const handleSettingsSave = (newSettings) => {
    setAppSettings(newSettings);
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings));
  };

  const handleNuke = () => {
    setTicker('MSFT');
    setSearchInput('MSFT');
    nukeIndicators();
    loadSidebar();
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    setAppSettings(DEFAULT_SETTINGS);
    refetch();
  };

  // Gestion Éditeur Indicateur
  const updateIndicator = (updatedInd) => {
    hookUpdateIndicator(updatedInd);
    setEditingIndicator(null);
    setPreviewSeries(null);
  };

  const handleEditorClose = () => {
    setEditingIndicator(null);
    setPreviewSeries(null);
  };

  // --- 6. PRIX D'AFFICHAGE ---
  const displayPrice = useMemo(() => {
    // Priorité 1: Store Global (WebSocket rapide)
    if (globalPrices[ticker]?.price) return globalPrices[ticker].price;
    // Priorité 2: Dernière bougie du chart
    if (chartData.length > 0) return chartData[chartData.length - 1].close;
    return null;
  }, [globalPrices, ticker, chartData]);

  // --- 7. RENDER ---
  if (!booted) return <BootSequence onComplete={() => setBooted(true)} />;

  return (
    <div className="h-screen bg-black text-slate-300 font-mono flex flex-col overflow-hidden relative selection:bg-neon-blue selection:text-black">
      
      {/* CRT EFFECT */}
      <div className="fixed inset-0 z-[100] pointer-events-none bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,243,255,0.03)_3px)] bg-[size:100%_100%]"></div>
      <div className="fixed inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.5)_100%)]"></div>

      {/* HEADER */}
      <header className="h-14 border-b border-slate-800 bg-black/80 backdrop-blur-md flex items-center justify-between px-4 shrink-0 z-40 relative">
        <div className="flex items-center gap-6">
          
          {/* LOGO */}
          <div className="flex items-center gap-2">
              <div className={`w-2 h-2 ${isConnected ? 'bg-neon-blue animate-pulse shadow-[0_0_10px_#00f3ff]' : 'bg-red-500'} rounded-full`}></div>
              <h1 className="text-xl font-bold tracking-[0.2em] text-white">
                DEIMOS <span className="text-slate-600 text-sm">//</span> <span className="text-slate-500 text-sm">TERM v4.2</span>
              </h1>
          </div>

          {/* VIEW SELECTOR (NAVIGATION TABS) */}
          <div className="flex bg-slate-900/50 p-1 rounded border border-slate-800">
             <button 
                onClick={() => setCurrentView('MARKET')}
                className={`flex items-center gap-2 px-3 py-1 text-xs font-bold rounded transition-all ${
                    currentView === 'MARKET' 
                    ? 'bg-slate-800 text-neon-blue shadow-[0_0_10px_rgba(0,243,255,0.1)] border border-slate-700' 
                    : 'text-slate-500 hover:text-white'
                }`}
             >
                <LayoutDashboard size={14} /> MARKET
             </button>
             <button 
                onClick={() => setCurrentView('PORTFOLIO')}
                className={`flex items-center gap-2 px-3 py-1 text-xs font-bold rounded transition-all ${
                    currentView === 'PORTFOLIO' 
                    ? 'bg-slate-800 text-neon-purple shadow-[0_0_10px_rgba(188,19,254,0.1)] border border-slate-700' 
                    : 'text-slate-500 hover:text-white'
                }`}
             >
                <Briefcase size={14} /> PORTFOLIO
             </button>
          </div>

        </div>
        
        <div className="flex gap-6 items-center">
          <div className="hidden lg:flex items-center gap-4 text-[10px] text-slate-500 font-bold tracking-wider">
              <div className="flex items-center gap-1"><ShieldCheck size={12}/> SECURE_CONN</div>
              <div className="flex items-center gap-1"><Wifi size={12}/> {appSettings.wsInterval}s REFRESH</div>
          </div>

          <form onSubmit={handleSearch} className="flex gap-0 group relative">
            <div className="relative flex">
                <div className="bg-slate-900 border border-slate-700 border-r-0 px-2 flex items-center text-slate-500 group-hover:text-neon-blue transition-colors">
                    <Terminal size={14} />
                </div>
                <input 
                  type="text" 
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
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
        
        {/* SIDEBAR */}
        <aside className="w-64 shrink-0 hidden md:block border-r border-slate-800 bg-black/90 backdrop-blur-sm z-10">
          <Sidebar 
            data={sidebarData} 
            currentTicker={ticker}
            // globalPrices supprimé ici (Sidebar utilise le store directement)
            onSelectTicker={handleSidebarSelect}
            onReload={loadSidebar}
          />
        </aside>

        {/* CONTENT */}
        <main className="flex-1 flex flex-col overflow-hidden relative z-0">
          <div className="flex-1 p-0 md:p-6 overflow-y-auto">
            <div className="max-w-[1600px] mx-auto space-y-6">
              
              {/* === VUE 1 : MARKET DASHBOARD (Classique) === */}
              {currentView === 'MARKET' && (
                <>
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
                        
                        {/* MARKET STATUS */}
                        <div className="mb-2 md:mb-0 md:ml-auto md:mr-6">
                            <MarketStatus data={liveData} />
                        </div>

                        {/* PRICE DISPLAY */}
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
                        <AddToWatchlist ticker={ticker} watchlists={sidebarData} onUpdate={loadSidebar} />
                    </div>

                    {/* ACTIVE INDICATORS */}
                    {currentIndicators.length > 0 && (
                        <div className="flex flex-wrap gap-3">
                        {currentIndicators.map(ind => (
                            <div key={ind.id} className={`relative flex items-center gap-2 px-3 py-1.5 text-[10px] border tracking-wider transition-all uppercase group ${ind.visible ? 'bg-slate-900/90 border-neon-blue/30 text-neon-blue shadow-[0_0_10px_rgba(0,243,255,0.1)]' : 'bg-transparent border-slate-800 text-slate-600 dashed opacity-70'}`}>
                            <div className={`w-1.5 h-1.5 shadow-[0_0_5px_currentColor] ${!ind.visible && 'opacity-20'}`} style={{ backgroundColor: ind.color }}></div>
                            <span className="font-bold">{ind.name}</span>
                            
                            <div className="flex gap-2 ml-2 pl-2 border-l border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setEditingIndicator(ind)} className="hover:text-white hover:scale-110 transition text-neon-orange" title="Configurer">
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

                    {/* ERROR DISPLAY */}
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
                            livePrice={displayPrice}
                        />
                    </div>
                </>
              )}

              {/* === VUE 2 : PORTFOLIO MANAGEMENT SYSTEM (DPMS) === */}
              {currentView === 'PORTFOLIO' && (
                 <PortfolioView />
              )}

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
        preloadedData={companyInfo} 
      />
    </div>
  );
}

export default App;