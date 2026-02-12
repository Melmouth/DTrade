import { useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, PieChart, Activity, 
  RefreshCw, AlertTriangle, Wallet, History 
} from 'lucide-react';
import { usePortfolioStore } from '../hooks/usePortfolioStore';
import { usePriceStore } from '../hooks/usePriceStore';

// Helper de formatage
const fmtUSD = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const fmtPct = (val) => `${(val * 100).toFixed(2)}%`;

export default function PortfolioView() {
  const { 
    cash, equity, positions, history, pnl_total, pnl_pct, 
    fetchPortfolio, syncLivePrices, manageCash, nuke 
  } = usePortfolioStore();

  const { prices } = usePriceStore();

  // 1. Initialisation
  useEffect(() => {
    fetchPortfolio();
  }, []);

  // 2. Sync Temps Réel (Le store recalcule l'Equity quand les prix changent)
  useEffect(() => {
    syncLivePrices(prices);
  }, [prices, syncLivePrices]);

  const handleCash = async (amount, type) => {
      try {
          await manageCash({ amount, type });
      } catch(e) { console.error(e); }
  };

  const isProfitable = pnl_total >= 0;

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto custom-scrollbar space-y-6">
      
      {/* --- HEADER: EQUITY & KPI --- */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* BIG EQUITY CARD */}
        <div className="lg:col-span-2 relative bg-slate-900/50 border border-slate-800 rounded-2xl p-6 overflow-hidden flex flex-col justify-center group">
            <div className={`absolute top-0 left-0 w-2 h-full ${isProfitable ? 'bg-neon-green' : 'bg-neon-red'} transition-colors`}></div>
            <div className="absolute right-0 top-0 p-3 opacity-10">
                <Activity size={100} />
            </div>
            
            <div className="relative z-10">
                <div className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mb-1">Total Net Equity</div>
                <div className={`text-5xl font-mono font-bold tracking-tighter ${isProfitable ? 'text-white' : 'text-red-100'}`}>
                    {fmtUSD(equity)}
                </div>
                <div className="flex items-center gap-3 mt-2">
                    <span className={`flex items-center gap-1 text-sm font-bold px-2 py-0.5 rounded ${isProfitable ? 'bg-neon-green/10 text-neon-green' : 'bg-neon-red/10 text-neon-red'}`}>
                        {isProfitable ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {isProfitable ? '+' : ''}{fmtUSD(pnl_total)}
                    </span>
                    <span className={`text-sm font-mono ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
                        ({isProfitable ? '+' : ''}{fmtPct(pnl_pct)})
                    </span>
                    <span className="text-xs text-slate-500 ml-auto">ALL TIME</span>
                </div>
            </div>
        </div>

        {/* STATS CARDS */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
            <div className="flex justify-between items-start">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Cash Available</span>
                <Wallet size={18} className="text-neon-blue" />
            </div>
            <div>
                <div className="text-2xl font-mono text-white mb-1">{fmtUSD(cash)}</div>
                <div className="flex gap-2 mt-2">
                    <button onClick={() => handleCash(10000, 'DEPOSIT')} className="px-2 py-1 bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-400 text-[10px] rounded border border-emerald-800 transition">+ $10k</button>
                    <button onClick={() => handleCash(10000, 'WITHDRAW')} className="px-2 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-[10px] rounded border border-red-800 transition">- $10k</button>
                </div>
            </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
            <div className="flex justify-between items-start">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Active Exposure</span>
                <PieChart size={18} className="text-neon-orange" />
            </div>
            <div>
                <div className="text-2xl font-mono text-white mb-1">{positions.length} <span className="text-sm text-slate-500">Positions</span></div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div 
                        className="h-full bg-neon-orange transition-all duration-1000" 
                        style={{ width: `${Math.min(((equity - cash) / equity) * 100, 100)}%` }}
                    ></div>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 text-right">
                    {equity > 0 ? ((equity - cash) / equity * 100).toFixed(1) : 0}% Invested
                </div>
            </div>
        </div>
      </div>

      {/* --- MAIN GRID: POSITIONS & HISTORY --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* LEFT: POSITIONS TABLE (2/3) */}
        <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    <Activity size={16} className="text-neon-blue"/> ACTIVE TRADES
                </h3>
                <button onClick={fetchPortfolio} className="text-slate-500 hover:text-white transition hover:rotate-180 duration-500">
                    <RefreshCw size={14} />
                </button>
            </div>
            
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-900/50 text-slate-500 sticky top-0 z-10">
                        <tr>
                            <th className="p-3 font-bold">TICKER</th>
                            <th className="p-3 font-bold text-right">QTY</th>
                            <th className="p-3 font-bold text-right">AVG ENTRY</th>
                            <th className="p-3 font-bold text-right">LAST</th>
                            <th className="p-3 font-bold text-right">VALUE</th>
                            <th className="p-3 font-bold text-right">UNR. P&L</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {positions.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="p-8 text-center text-slate-600 italic">
                                    No active positions.
                                </td>
                            </tr>
                        ) : (
                            positions.map(pos => {
                                const isPosUp = pos.pnl_unrealized >= 0;
                                return (
                                    <tr key={pos.ticker} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-3 font-bold text-white">{pos.ticker}</td>
                                        <td className="p-3 text-right text-slate-300">{pos.quantity}</td>
                                        <td className="p-3 text-right text-slate-400">{pos.avg_price.toFixed(2)}</td>
                                        <td className="p-3 text-right text-white font-bold">{pos.current_price?.toFixed(2) || "---"}</td>
                                        <td className="p-3 text-right text-slate-300">{(pos.market_value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} $</td>
                                        <td className={`p-3 text-right font-bold ${isPosUp ? 'text-neon-green' : 'text-neon-red'}`}>
                                            <div className="flex flex-col items-end leading-none">
                                                <span>{isPosUp ? '+' : ''}{pos.pnl_unrealized.toFixed(2)} $</span>
                                                <span className="text-[9px] opacity-70">{isPosUp ? '+' : ''}{(pos.pnl_pct * 100).toFixed(2)}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* RIGHT: HISTORY & DANGER ZONE (1/3) */}
        <div className="flex flex-col gap-6">
            
            {/* MINI HISTORY */}
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col min-h-[200px]">
                <div className="p-3 border-b border-slate-800 bg-slate-900/50">
                    <h3 className="font-bold text-slate-400 text-[10px] uppercase tracking-widest flex items-center gap-2">
                        <History size={12} /> RECENT ACTIVITY
                    </h3>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {history.map((tx) => (
                        <div key={tx.id} className="flex justify-between items-center p-3 border-b border-slate-800/50 text-xs hover:bg-white/5">
                            <div className="flex flex-col">
                                <span className={`font-bold ${tx.type === 'BUY' || tx.type === 'DEPOSIT' ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {tx.type} {tx.ticker}
                                </span>
                                <span className="text-[9px] text-slate-600">{new Date(tx.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <div className="text-right">
                                <div className="text-white font-mono">{fmtUSD(tx.total_amount)}</div>
                                {tx.price && <div className="text-[9px] text-slate-500">@ {tx.price.toFixed(2)}</div>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* DANGER ZONE */}
            <button 
                onClick={() => { if(confirm("RESET TOTAL ?")) nuke(); }}
                className="w-full py-2 border border-red-900/30 text-red-900 hover:bg-red-950 hover:text-red-500 text-[10px] font-bold rounded transition flex items-center justify-center gap-2"
            >
                <AlertTriangle size={12} /> RESET SIMULATOR
            </button>

        </div>
      </div>
    </div>
  );
}