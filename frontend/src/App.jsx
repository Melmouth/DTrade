import { useState, useEffect, useRef } from 'react'
import { marketApi } from './api/client'
import { Activity, Search, Settings, X, Eye, EyeOff, Terminal, Cpu, Radio, ShieldCheck, Wifi, ScanEye, Edit2 } from 'lucide-react'
import SettingsModal from './components/SettingsModal'
import Sidebar from './components/Sidebar'
import StockChart from './components/StockChart'
import AddToPortfolio from './components/AddToPortfolio'
import IndicatorMenu from './components/IndicatorMenu'
import BootSequence from './components/BootSequence'
import CompanyInfo from './components/CompanyInfo';
import MarketStatus from './components/MarketStatus';
import IndicatorEditor from './components/IndicatorEditor';

const DEFAULT_SETTINGS = { wsInterval: 15, historyPeriod: '1mo' }
const STORAGE_KEYS = {
  SETTINGS: 'trading_settings',
  INDICATORS: 'trading_indicators_v2',
  VIEWS: 'trading_views_v1'
}

function App() {

  // Modify Indicator Editor State
  const [editingIndicator, setEditingIndicator] = useState(null); // L'objet indicateur en cours d'édition
  const [previewSeries, setPreviewSeries] = useState(null); // Les données pré-calculées venant de l'éditeur

  const [showCompanyInfo, setShowCompanyInfo] = useState(false);
  const [booted, setBooted] = useState(false);
  const [ticker, setTicker] = useState('MSFT')
  const [quote, setQuote] = useState(null)
  
  // --- NOUVEAU : State pour le prix en temps réel dédié au Chart ---
  const [livePrice, setLivePrice] = useState(null) 
  
  // Data States
  const [sidebarData, setSidebarData] = useState([]) 
  const [chartData, setChartData] = useState([])
  const [dailyData, setDailyData] = useState([]) 
  const [chartMeta, setChartMeta] = useState(null)
  
  // States de persistance
  const [repoIndicators, setRepoIndicators] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.INDICATORS)
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })

  const [repoViews, setRepoViews] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.VIEWS)
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  
  const [appSettings, setAppSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS)
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS
    } catch { return DEFAULT_SETTINGS }
  })
  
  const wsRef = useRef(null)
  const currentIndicators = repoIndicators[ticker] || []
  const currentPeriod = repoViews[ticker] || appSettings.historyPeriod

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.INDICATORS, JSON.stringify(repoIndicators))
  }, [repoIndicators])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VIEWS, JSON.stringify(repoViews))
  }, [repoViews])

  useEffect(() => {
    loadSidebar()
    fetchData(ticker, currentPeriod)
    return () => stopLiveStream() 
  }, []) 

  const loadSidebar = async () => {
    try {
      const res = await marketApi.getSidebarData()
      setSidebarData(res.data)
    } catch (err) { console.error("Sidebar load error", err) }
  }

  const fetchData = async (symbol, period) => {
    setLoading(true)
    setError('')
    stopLiveStream() 
    setLivePrice(null) // Reset du prix live au changement de ticker

    // --- VIDER LES DONNÉES AVANT DE CHARGER ---
    setChartData([]) 
    setDailyData([])
    setChartMeta(null)
    // -----------------------------------------------------

    try {
      const historyRes = await marketApi.getHistory(symbol, period)
      setChartData(historyRes.data.data)
      setDailyData(historyRes.data.daily_data)
      setChartMeta(historyRes.data.meta)
      
      const lastClose = historyRes.data.data.length > 0 
        ? historyRes.data.data[historyRes.data.data.length-1].close 
        : 0;

      setQuote({ symbol: symbol, price: lastClose })
      setLivePrice(lastClose) // Init avec le dernier prix connu
      startLiveStream(symbol)

    } catch (err) {
      console.error(err)
      setError("ERR::DATA_FETCH_FAIL")
    } finally {
      setLoading(false)
    }
  }

  const handleSelectTicker = (newTicker) => {
      const savedPeriod = repoViews[newTicker] || appSettings.historyPeriod
      setTicker(newTicker)
      fetchData(newTicker, savedPeriod)
  }

  const handleSearch = (e) => {
    e.preventDefault()
    const savedPeriod = repoViews[ticker] || appSettings.historyPeriod
    fetchData(ticker, savedPeriod)
  }

  const handlePeriodChange = (newPeriod) => {
    setRepoViews(prev => ({ ...prev, [ticker]: newPeriod }))
    const newSettings = { ...appSettings, historyPeriod: newPeriod }
    setAppSettings(newSettings)
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings))
    fetchData(ticker, newPeriod)
  }

  const handleAddIndicator = (newInd) => {
    const indicatorWithState = { ...newInd, visible: true }
    setRepoIndicators(prev => ({
      ...prev,
      [ticker]: [...(prev[ticker] || []), indicatorWithState]
    }))
  }

  const removeIndicator = (id) => {
    setRepoIndicators(prev => ({
      ...prev,
      [ticker]: (prev[ticker] || []).filter(i => i.id !== id)
    }))
  }

  const toggleIndicatorVisibility = (id) => {
    setRepoIndicators(prev => ({
      ...prev,
      [ticker]: (prev[ticker] || []).map(i => 
        i.id === id ? { ...i, visible: !i.visible } : i
      )
    }))
  }

  const startLiveStream = (symbol) => {
    stopLiveStream();
    wsRef.current = marketApi.createLiveConnection(symbol, appSettings.wsInterval, (data) => {
      // 1. Mise à jour Header (Quote)
      setQuote(prev => ({ ...prev, price: data.price, symbol: data.symbol }))
      // 2. Mise à jour Chart (Live Candle)
      setLivePrice(data.price)
    })
  }

  const stopLiveStream = () => {
    if (wsRef.current) { 
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      if (wsRef.current.readyState === 1 || wsRef.current.readyState === 2) {
          wsRef.current.close();
      }
      wsRef.current = null; 
    }
  }

  const updateIndicator = (updatedInd) => {
    setRepoIndicators(prev => ({
        ...prev,
        [ticker]: prev[ticker].map(i => i.id === updatedInd.id ? updatedInd : i)
    }));
    setEditingIndicator(null);
    setPreviewSeries(null);
  };

  const handleEditClick = (ind) => {
      // On ouvre l'éditeur et on reset la preview
      setEditingIndicator(ind);
      setPreviewSeries(null);
  };

  const handleEditorClose = () => {
      setEditingIndicator(null);
      setPreviewSeries(null);
  }
  

  if (!booted) {
    return <BootSequence onComplete={() => setBooted(true)} />;
  }

  return (
    <div className="h-screen bg-black text-slate-300 font-mono flex flex-col overflow-hidden relative selection:bg-neon-blue selection:text-black">
      
      {/* --- NEW CRT GRIDLINES (OVERLAY) --- */}
      {/* Au-dessus de tout (z-[100]), pointer-events-none pour ne pas bloquer les clics */}
      <div className="fixed inset-0 z-[100] pointer-events-none" 
           style={{ 
             // Lignes horizontales uniquement, fines et rapprochées
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
              <div className="w-2 h-2 bg-neon-blue animate-pulse shadow-[0_0_10px_#00f3ff]"></div>
              <span className="text-[10px] font-bold tracking-widest text-neon-blue">ONLINE</span>
          </div>
          <h1 className="text-xl font-bold tracking-[0.2em] text-white">
            DEIMOS <span className="text-slate-600 text-sm">//</span> <span className="text-slate-500 text-sm">TERMINAL v4.2</span>
          </h1>
        </div>
        
        <div className="flex gap-6 items-center">
          <div className="hidden lg:flex items-center gap-4 text-[10px] text-slate-500 font-bold tracking-wider">
              <div className="flex items-center gap-1"><ShieldCheck size={12}/> SECURE_CONN</div>
              <div className="flex items-center gap-1"><Wifi size={12}/> 52ms</div>
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
            onSelectTicker={handleSelectTicker}
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
                    <h2 className="text-5xl md:text-6xl font-bold tracking-tighter text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.15)] glitch-effect">
                        
                        {/* Flex container pour le titre et le bouton */}
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

                    </h2>
                 </div>
                 
                 {/* --- INTÉGRATION MARKET STATUS --- */}
                 <div className="mb-2 md:mb-0 md:ml-auto md:mr-6">
                    <MarketStatus ticker={ticker} type="full" />
                 </div>
                 {/* -------------------------------- */}

                 <div className="text-right">
                    <div className="text-[10px] text-slate-500 tracking-[0.3em] uppercase mb-1">Current Price Assessment</div>
                    <div className="flex items-baseline gap-3 justify-end">
                       <Radio size={12} className="text-red-500 animate-pulse" />
                       <span className="text-5xl font-bold text-neon-blue font-mono tabular-nums tracking-tight text-shadow-neon">
                          {quote?.price ? quote.price.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "---.--"}
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
                      
                      {/* BOUTONS D'ACTION (MODIFIÉ) */}
                      <div className="flex gap-2 ml-2 pl-2 border-l border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* 1. Bouton Editer (Nouveau) */}
                          <button 
                             onClick={() => handleEditClick(ind)} 
                             className="hover:text-white hover:scale-110 transition text-neon-orange"
                             title="Configurer"
                          >
                             <Edit2 size={12} />
                          </button>
                          
                          {/* 2. Boutons existants */}
                          <button onClick={() => toggleIndicatorVisibility(ind.id)} className="hover:text-white hover:scale-110 transition"><Eye size={12} /></button>
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
                    // INSERTION : PREVIEW SERIES
                    previewSeries={previewSeries}
                    // INSERTION : LIVE PRICE
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
        onSave={(s) => { 
           setAppSettings(s); 
           localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(s));
           if (!repoViews[ticker]) {
             fetchData(ticker, s.historyPeriod); 
           }
        }}
        onNuke={() => { 
          setTicker('MSFT'); 
          setRepoIndicators({});
          setRepoViews({});
          localStorage.removeItem(STORAGE_KEYS.INDICATORS);
          localStorage.removeItem(STORAGE_KEYS.VIEWS);
          loadSidebar(); 
        }}
      />

      <CompanyInfo 
        ticker={ticker} 
        isOpen={showCompanyInfo} 
        onClose={() => setShowCompanyInfo(false)} 
      />
    </div>
  )
}

export default App