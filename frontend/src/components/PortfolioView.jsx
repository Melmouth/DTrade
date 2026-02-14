import { useEffect, useState } from 'react';
import { 
  TrendingUp, TrendingDown, PieChart, Activity, RefreshCw, 
  Wallet, History, LayoutGrid, List, Settings, PlusCircle, AlertTriangle, ArrowUpRight
} from 'lucide-react';
import { usePortfolioStore } from '../hooks/usePortfolioStore';
import { usePriceStore } from '../hooks/usePriceStore';
// Ensure OrderModal is imported correctly from its own file
import OrderModal from './OrderModal';

// Formatter Helpers
const fmtUSD = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const fmtPct = (val) => `${(val * 100).toFixed(2)}%`;

export default function PortfolioView() {
  const { 
    cash, equity, positions, history, pnl_total, pnl_pct, 
    fetchPortfolio, syncLivePrices, manageCash, nuke 
  } = usePortfolioStore();

  const { prices } = usePriceStore();

  // Navigation Tabs State
  const [activeTab, setActiveTab] = useState('DASHBOARD'); // DASHBOARD | POSITIONS | HISTORY | ADMIN
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({ ticker: '', side: 'BUY' });

  // 1. Initialization
  useEffect(() => {
    fetchPortfolio();
  }, []);

  // 2. Real-Time Sync
  useEffect(() => {
    syncLivePrices(prices);
  }, [prices, syncLivePrices]);

  const openOrderModal = (ticker = '', side = 'BUY') => {
    setModalConfig({ ticker, side });
    setModalOpen(true);
  };

  const isProfitable = pnl_total >= 0;

  // --- SUB-VIEWS COMPONENTS ---

  const SummaryTab = () => (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
      {/* KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* EQUITY CARD */}
        <div className="md:col-span-2 bg-slate-900/50 border border-slate-800 rounded-xl p-6 relative overflow-hidden flex flex-col justify-center shadow-lg">
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${isProfitable ? 'bg-neon-green shadow-[0_0_15px_#00ff41]' : 'bg-neon-red shadow-[0_0_15px_#ff003c]'}`}></div>
            <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Net Liquidation Value</div>
            <div className="text-4xl lg:text-5xl font-mono font-bold text-white tracking-tighter drop-shadow-md">
                {fmtUSD(equity)}
            </div>
            <div className="flex items-center gap-3 mt-3">
                <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded border ${isProfitable ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                    {isProfitable ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                    {isProfitable ? '+' : ''}{fmtUSD(pnl_total)}
                </span>
                <span className={`text-xs font-mono font-bold ${isProfitable ? 'text-emerald-500' : 'text-red-500'}`}>
                    ({isProfitable ? '+' : ''}{fmtPct(pnl_pct)})
                </span>
                <span className="text-[10px] text-slate-600 font-mono ml-auto">UNREALIZED P&L</span>
            </div>
        </div>

        {/* CASH CARD */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors">
            <div className="flex justify-between items-start">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Cash Available</span>
                <Wallet size={18} className="text-neon-blue" />
            </div>
            <div>
                <div className="text-2xl font-mono text-white tracking-tight">{fmtUSD(cash)}</div>
                <div className="w-full bg-slate-800 h-1.5 mt-3 rounded-full overflow-hidden">
                    {/* Protection division by zero */}
                    <div className="h-full bg-neon-blue shadow-[0_0_10px_#00f3ff]" style={{ width: `${equity > 0 ? Math.min((cash/equity)*100, 100) : 0}%` }}></div>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 text-right">Buying Power</div>
            </div>
        </div>

        {/* EXPOSURE CARD */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors">
            <div className="flex justify-between items-start">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Invested</span>
                <PieChart size={18} className="text-neon-orange" />
            </div>
            <div>
                <div className="text-2xl font-mono text-white tracking-tight">{positions.length} <span className="text-sm text-slate-500 font-sans">Positions</span></div>
                <div className="w-full bg-slate-800 h-1.5 mt-3 rounded-full overflow-hidden">
                    <div className="h-full bg-neon-orange shadow-[0_0_10px_#ff9e00]" style={{ width: `${equity > 0 ? Math.min(((equity-cash)/equity)*100, 100) : 0}%` }}></div>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 text-right">
                    {equity > 0 ? ((equity - cash) / equity * 100).toFixed(1) : 0}% Exposure
                </div>
            </div>
        </div>
      </div>

      {/* QUICK ACTION BANNER */}
      <div className="flex items-center justify-between bg-gradient-to-r from-slate-900 to-[#0a0a0a] border border-slate-800 rounded-xl p-4 md:p-6 shadow-lg">
          <div className="flex items-center gap-4">
              <div className="p-3 bg-neon-blue/10 rounded-xl text-neon-blue border border-neon-blue/20 animate-pulse">
                  <Activity size={24} />
              </div>
              <div>
                  <div className="text-sm md:text-base font-bold text-white uppercase tracking-widest">Ready to trade ?</div>
                  <div className="text-xs text-slate-500 mt-0.5">Accès direct aux marchés mondiaux. Exécution instantanée.</div>
              </div>
          </div>
          <button 
            onClick={() => openOrderModal('', 'BUY')}
            className="flex items-center gap-2 bg-white text-black hover:bg-neon-blue hover:text-black hover:shadow-[0_0_20px_rgba(0,243,255,0.4)] px-5 py-3 rounded-lg font-bold text-xs md:text-sm uppercase tracking-wider transition-all transform hover:scale-105"
          >
              <PlusCircle size={18} /> New Order
          </button>
      </div>
    </div>
  );

  const PositionsTab = () => (
    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-full animate-in fade-in duration-300 shadow-xl">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-sm">
            <h3 className="font-bold text-slate-200 flex items-center gap-2 text-xs uppercase tracking-widest">
                <List size={14} className="text-neon-blue"/> Active Positions
            </h3>
            <button onClick={fetchPortfolio} className="text-slate-500 hover:text-white transition hover:rotate-180 duration-500" title="Refresh">
                <RefreshCw size={14} />
            </button>
        </div>
        <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 text-slate-500 sticky top-0 z-10 font-bold uppercase tracking-wider">
                    <tr>
                        <th className="p-4 border-b border-slate-800">Ticker</th>
                        <th className="p-4 border-b border-slate-800 text-right">Qty</th>
                        <th className="p-4 border-b border-slate-800 text-right">Avg Entry</th>
                        <th className="p-4 border-b border-slate-800 text-right">Last Price</th>
                        <th className="p-4 border-b border-slate-800 text-right">Mkt Value</th>
                        <th className="p-4 border-b border-slate-800 text-right">Unrealized P&L</th>
                        <th className="p-4 border-b border-slate-800 text-center">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                    {positions.length === 0 ? (
                        <tr><td colSpan="7" className="p-12 text-center text-slate-600 italic">No active positions found.</td></tr>
                    ) : (
                        positions.map(pos => {
                            const isUp = pos.pnl_unrealized >= 0;
                            return (
                                <tr key={pos.ticker} className="hover:bg-white/5 transition-colors group">
                                    <td className="p-4 font-bold text-white group-hover:text-neon-blue transition-colors">{pos.ticker}</td>
                                    <td className="p-4 text-right text-slate-300">{pos.quantity}</td>
                                    <td className="p-4 text-right text-slate-400">{pos.avg_price.toFixed(2)}</td>
                                    <td className="p-4 text-right text-white font-bold">{pos.current_price?.toFixed(2) || "---"}</td>
                                    <td className="p-4 text-right text-slate-300">{(pos.market_value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} $</td>
                                    <td className={`p-4 text-right`}>
                                        <div className={`font-bold ${isUp ? 'text-neon-green' : 'text-neon-red'}`}>
                                            {isUp ? '+' : ''}{pos.pnl_unrealized.toFixed(2)} $
                                        </div>
                                        <div className={`text-[10px] ${isUp ? 'text-emerald-600' : 'text-red-700'}`}>
                                            {isUp ? '+' : ''}{(pos.pnl_pct * 100).toFixed(2)}%
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <button 
                                            onClick={() => openOrderModal(pos.ticker, 'SELL')}
                                            className="px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-red-500 hover:text-red-400 text-slate-400 text-[10px] font-bold uppercase rounded transition-all shadow-sm hover:shadow-red-900/20"
                                        >
                                            Close
                                        </button>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    </div>
  );

  const HistoryTab = () => (
    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-full animate-in fade-in duration-300 shadow-xl">
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
            <h3 className="font-bold text-slate-200 flex items-center gap-2 text-xs uppercase tracking-widest">
                <History size={14} className="text-slate-400"/> Transaction Log
            </h3>
        </div>
        <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 text-slate-500 sticky top-0 z-10 font-bold uppercase tracking-wider">
                    <tr>
                        <th className="p-4 border-b border-slate-800">ID</th>
                        <th className="p-4 border-b border-slate-800">Date</th>
                        <th className="p-4 border-b border-slate-800">Type</th>
                        <th className="p-4 border-b border-slate-800">Asset</th>
                        <th className="p-4 border-b border-slate-800 text-right">Qty</th>
                        <th className="p-4 border-b border-slate-800 text-right">Price</th>
                        <th className="p-4 border-b border-slate-800 text-right">Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                    {history.map((tx) => (
                        <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                            <td className="p-4 text-slate-600">#{tx.id}</td>
                            <td className="p-4 text-slate-400">{new Date(tx.timestamp).toLocaleString()}</td>
                            <td className="p-4 font-bold">
                                <span className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider border ${
                                    tx.type === 'BUY' || tx.type === 'DEPOSIT' 
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                                }`}>{tx.type}</span>
                            </td>
                            <td className="p-4 text-white font-bold">{tx.ticker || '-'}</td>
                            <td className="p-4 text-right text-slate-300">{tx.quantity || '-'}</td>
                            <td className="p-4 text-right text-slate-400">{tx.price ? tx.price.toFixed(2) : '-'}</td>
                            <td className="p-4 text-right text-white font-bold">{fmtUSD(tx.total_amount)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  );

  const AdminTab = () => (
    <div className="max-w-3xl mx-auto space-y-8 py-8 animate-in slide-in-from-bottom-4 duration-300">
        
        {/* CASH MANAGEMENT */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-800 pb-2">
                <Wallet size={16} className="text-neon-blue"/> Treasury Management
            </h3>
            <div className="grid grid-cols-2 gap-4">
                <button 
                    onClick={() => manageCash({ amount: 10000, type: 'DEPOSIT' }).then(fetchPortfolio)}
                    className="p-6 bg-slate-950 border border-slate-800 hover:border-emerald-500 hover:bg-emerald-900/10 rounded-xl text-slate-400 hover:text-emerald-400 transition-all flex flex-col items-center gap-3 group"
                >
                    <ArrowUpRight size={24} className="group-hover:scale-125 transition-transform" />
                    <div className="text-center">
                        <span className="text-2xl font-bold block mb-1">+ $10,000</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest">Inject Capital</span>
                    </div>
                </button>
                <button 
                    onClick={() => manageCash({ amount: 10000, type: 'WITHDRAW' }).then(fetchPortfolio)}
                    className="p-6 bg-slate-950 border border-slate-800 hover:border-red-500 hover:bg-red-900/10 rounded-xl text-slate-400 hover:text-red-400 transition-all flex flex-col items-center gap-3 group"
                >
                    <ArrowUpRight size={24} className="rotate-180 group-hover:scale-125 transition-transform" />
                    <div className="text-center">
                        <span className="text-2xl font-bold block mb-1">- $10,000</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest">Withdraw Funds</span>
                    </div>
                </button>
            </div>
        </div>

        {/* DANGER ZONE */}
        <div className="bg-red-950/10 border border-red-900/30 rounded-xl p-6 shadow-[inset_0_0_20px_rgba(239,68,68,0.05)]">
            <h3 className="text-sm font-bold text-red-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                <AlertTriangle size={16} /> Danger Zone
            </h3>
            <p className="text-xs text-red-300/60 mb-6 leading-relaxed">
                This action is irreversible. It will completely wipe all portfolio data, reset cash balance to 0, close all positions, and archive transaction history.
                Use only for simulator reset.
            </p>
            <button 
                onClick={() => { if(confirm("ARE YOU SURE? THIS IS A HARD RESET.")) nuke(); }}
                className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-[0.2em] rounded transition-all shadow-lg shadow-red-900/20 hover:shadow-red-500/20"
            >
                NUKE PORTFOLIO
            </button>
        </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-[#050505] relative">
      
      {/* 1. HEADER TABS */}
      <div className="flex items-center px-4 pt-2 border-b border-slate-800 bg-black sticky top-0 z-20 gap-2 overflow-x-auto">
         {[
            { id: 'DASHBOARD', icon: LayoutGrid, label: 'Summary' },
            { id: 'POSITIONS', icon: List, label: 'Positions' },
            { id: 'HISTORY', icon: History, label: 'History' },
            { id: 'ADMIN', icon: Settings, label: 'Admin' }
         ].map(tab => {
             const Icon = tab.icon;
             const isActive = activeTab === tab.id;
             return (
                 <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2
                    ${isActive 
                        ? 'border-neon-blue text-white bg-slate-900/50' 
                        : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'
                    }`}
                 >
                    <Icon size={14} className={isActive ? 'text-neon-blue' : ''} /> {tab.label}
                 </button>
             )
         })}
         
         <div className="ml-auto flex items-center h-full py-2">
             <button 
                onClick={() => openOrderModal('', 'BUY')}
                className="bg-neon-blue/10 border border-neon-blue/50 text-neon-blue hover:bg-neon-blue hover:text-black px-4 py-1.5 rounded text-[10px] font-bold uppercase flex items-center gap-2 transition-all shadow-[0_0_10px_rgba(0,243,255,0.1)] hover:shadow-[0_0_20px_rgba(0,243,255,0.4)]"
             >
                 <PlusCircle size={14} /> Quick Trade
             </button>
         </div>
      </div>

      {/* 2. CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-gradient-to-b from-[#050505] to-[#0a0a0a]">
          {activeTab === 'DASHBOARD' && <SummaryTab />}
          {activeTab === 'POSITIONS' && <PositionsTab />}
          {activeTab === 'HISTORY' && <HistoryTab />}
          {activeTab === 'ADMIN' && <AdminTab />}
      </div>

      {/* 3. MODAL */}
      <OrderModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        prefillTicker={modalConfig.ticker}
        prefillSide={modalConfig.side}
      />
    </div>
  );
}