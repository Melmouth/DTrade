import { useState, useEffect } from 'react';
import { X, Globe, DollarSign, TrendingUp, ShieldAlert, Cpu, ScanEye } from 'lucide-react';
import { marketApi } from '../api/client';

export default function CompanyInfo({ ticker, isOpen, onClose, preloadedData }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !ticker) return;

    // 1. OPTIMISATION : Si on a déjà les données via le parent (Snapshot)
    // Le backend renvoie maintenant le format CORRECT, plus besoin de normalization.
    if (preloadedData) {
       setData(preloadedData);
       setLoading(false);
       return;
    }

    // 2. FALLBACK : Sinon on fetch manuellement (Route API standardisée)
    const fetchInfo = async () => {
      setLoading(true);
      try {
        const res = await marketApi.getCompanyInfo(ticker);
        // Ici aussi, l'API renvoie le format structuré directement
        setData(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchInfo();
  }, [isOpen, ticker, preloadedData]);

  if (!isOpen) return null;

  // Formatters
  const fmtNum = (num) => {
    if (!num) return 'N/A';
    if (num > 1e12) return (num / 1e12).toFixed(2) + ' T';
    if (num > 1e9) return (num / 1e9).toFixed(2) + ' B';
    if (num > 1e6) return (num / 1e6).toFixed(2) + ' M';
    return num.toLocaleString();
  };

  const fmtPct = (num) => num ? `${(num * 100).toFixed(2)}%` : 'N/A';
  const fmtPrice = (num) => num ? num.toFixed(2) : 'N/A';

  // UI Components interne
  const DataCard = ({ label, value, sub, color = "text-white" }) => (
    <div className="bg-slate-900/50 border border-slate-800 p-3 flex flex-col justify-between hover:border-neon-blue/30 transition-colors group">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1 group-hover:text-neon-blue transition-colors">{label}</span>
      <div className="flex items-end justify-between">
        <span className={`font-mono text-sm md:text-base font-bold ${color}`}>{value}</span>
        {sub && <span className="text-[10px] text-slate-600 mb-0.5">{sub}</span>}
      </div>
    </div>
  );

  const SectionTitle = ({ icon: Icon, title }) => (
    <div className="flex items-center gap-2 text-neon-blue mb-3 mt-4 border-b border-slate-800 pb-2">
      <Icon size={14} />
      <span className="text-xs font-bold uppercase tracking-[0.2em]">{title}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      
      <div className="w-full max-w-4xl bg-[#050505] border border-slate-700 shadow-[0_0_50px_rgba(0,243,255,0.1)] flex flex-col max-h-[90vh] overflow-hidden relative">
        
        {/* Decor Lines */}
        <div className="absolute top-0 left-0 w-20 h-[2px] bg-neon-blue"></div>
        <div className="absolute bottom-0 right-0 w-20 h-[2px] bg-neon-blue"></div>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-neon-blue/10 border border-neon-blue/30">
                <ScanEye size={20} className="text-neon-blue" />
             </div>
             <div>
                <h2 className="text-xl font-bold text-white tracking-widest">{ticker}</h2>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider flex gap-2">
                    <span>{data?.identity?.exchange || 'MARKET'}</span>
                    <span className="text-slate-700">//</span>
                    <span>{data?.identity?.quoteType || 'EQUITY'}</span>
                </div>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-red-500/20 hover:text-red-500 text-slate-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">
          {loading ? (
             <div className="h-64 flex flex-col items-center justify-center gap-4 text-neon-blue">
                <Cpu size={32} className="animate-spin" />
                <span className="text-xs font-mono animate-pulse tracking-widest">DECRYPTING_SECURE_DATA...</span>
             </div>
          ) : data ? (
            <div className="space-y-6">
                
                {/* 1. IDENTITY & PROFILE HEADER */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-4">
                        <div>
                            <h1 className="text-2xl font-bold text-white mb-1">{data.identity.longName}</h1>
                            <div className="flex items-center gap-4 text-xs text-slate-400">
                                <span className="flex items-center gap-1"><Globe size={12}/> {data.identity.city}, {data.identity.country}</span>
                                <span className="w-[1px] h-3 bg-slate-700"></span>
                                <span className="text-neon-blue">{data.identity.sector}</span>
                                <span className="w-[1px] h-3 bg-slate-700"></span>
                                <span>{data.identity.industry}</span>
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed border-l-2 border-slate-800 pl-3 italic">
                            {data.profile.longBusinessSummary?.length > 300 
                                ? data.profile.longBusinessSummary.substring(0, 300) + '...' 
                                : (data.profile.longBusinessSummary || "Aucune description disponible.")}
                        </p>
                    </div>
                    
                    {/* KEY STATS HIGHLIGHT */}
                    <div className="grid grid-cols-1 gap-2">
                         <DataCard label="Capitalisation (Mkt Cap)" value={fmtNum(data.valuation.marketCap)} color="text-neon-green" />
                         <DataCard label="Employés" value={fmtNum(data.profile.fullTimeEmployees)} sub="Full Time" />
                         <DataCard label="Site Web" value={data.identity.website?.replace('https://', '') || 'N/A'} color="text-neon-blue" />
                    </div>
                </div>

                <div className="h-[1px] bg-slate-800 w-full"></div>

                {/* 2. VALUATION & FINANCIALS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* VALUATION */}
                    <div>
                        <SectionTitle icon={DollarSign} title="Données de Valorisation" />
                        <div className="grid grid-cols-2 gap-2">
                            <DataCard label="Enterprise Value" value={fmtNum(data.valuation.enterpriseValue)} />
                            <DataCard label="Price / Book" value={fmtPrice(data.valuation.priceToBook)} />
                            <DataCard label="PE Ratio (Trailing)" value={fmtPrice(data.valuation.trailingPE)} />
                            <DataCard label="PE Ratio (Forward)" value={fmtPrice(data.valuation.forwardPE)} color="text-neon-purple" />
                            <DataCard label="PEG Ratio" value={fmtPrice(data.valuation.trailingPegRatio)} />
                        </div>
                    </div>

                    {/* FINANCIAL HEALTH */}
                    <div>
                        <SectionTitle icon={ShieldAlert} title="Santé Financière (Bilan)" />
                        <div className="grid grid-cols-2 gap-2">
                            <DataCard label="Total Cash" value={fmtNum(data.financials.totalCash)} color="text-emerald-400" />
                            <DataCard label="Total Debt" value={fmtNum(data.financials.totalDebt)} color="text-red-400" />
                            <DataCard label="Revenue Growth" value={fmtPct(data.financials.revenueGrowth)} />
                            <DataCard label="ROE" value={fmtPct(data.financials.returnOnEquity)} />
                            <DataCard label="Free Cash Flow" value={fmtNum(data.financials.freeCashflow)} />
                            <DataCard label="Quick Ratio" value={fmtPrice(data.financials.quickRatio)} />
                        </div>
                    </div>

                </div>

                {/* 3. PERFORMANCE STRIP */}
                <div>
                     <SectionTitle icon={TrendingUp} title="Performance & Dividendes" />
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <DataCard label="52 Week High" value={fmtPrice(data.performance.fiftyTwoWeekHigh)} />
                        <DataCard label="52 Week Low" value={fmtPrice(data.performance.fiftyTwoWeekLow)} />
                        <DataCard label="50 Day Avg" value={fmtPrice(data.performance.fiftyDayAverage)} />
                        <DataCard label="200 Day Avg" value={fmtPrice(data.performance.twoHundredDayAverage)} />
                        <DataCard label="Dividend Yield" value={fmtPct(data.performance.dividendYield)} color="text-neon-orange" />
                        <DataCard label="Payout Ratio" value={fmtPct(data.performance.payoutRatio)} />
                        <DataCard label="Beta" value={fmtPrice(data.performance.beta)} sub="(Volatilité)" />
                     </div>
                </div>

            </div>
          ) : (
            <div className="text-center text-slate-500 py-10">NO DATA FOUND</div>
          )}
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-slate-800 bg-black flex justify-between text-[10px] text-slate-600 font-mono">
            <span>DATA_SOURCE: YFINANCE::LIVE</span>
            <span>SECURE_ID: {ticker}-X99</span>
        </div>
      </div>
    </div>
  );
}