import { useState, useEffect } from 'react';
import { X, ArrowUpRight, ArrowDownRight, Calculator, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { usePortfolioStore } from '../hooks/usePortfolioStore';
import { usePriceStore } from '../hooks/usePriceStore';
// Import API to fetch price if missing from store
import { marketApi } from '../api/client'; 

export default function OrderModal({ isOpen, onClose, prefillTicker = '', prefillSide = 'BUY' }) {
  if (!isOpen) return null;

  const { executeOrder, cash, positions } = usePortfolioStore();
  const { prices, updatePrice } = usePriceStore(); // Import updatePrice to manually set data

  const [ticker, setTicker] = useState(prefillTicker);
  const [side, setSide] = useState(prefillSide); // 'BUY' | 'SELL'
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Reset à l'ouverture
  useEffect(() => {
    setTicker(prefillTicker);
    setSide(prefillSide);
    setQty(1);
    setError(null);
    setSuccess(false);
    setLoading(false);
  }, [isOpen, prefillTicker, prefillSide]);

  // Données Live du Store
  const liveData = prices[ticker];
  const price = liveData?.price || 0;
  
  // --- FIX: FETCH ON DEMAND IF MISSING ---
  useEffect(() => {
    // Si on a un ticker mais pas de prix dans le store (et que ce n'est pas 0), on fetch
    if (ticker && (!liveData || liveData.price === 0)) {
        const fetchMissingPrice = async () => {
            try {
                // On utilise l'endpoint snapshot pour avoir le prix frais
                const res = await marketApi.getSnapshot(ticker, '1d');
                if (res.data?.live) {
                    // On injecte manuellement dans le store global
                    updatePrice(ticker, res.data.live);
                }
            } catch (e) {
                console.warn("Could not fetch price for modal", e);
            }
        };
        fetchMissingPrice();
    }
  }, [ticker, liveData, updatePrice]);
  // ---------------------------------------

  const estimatedTotal = price * qty;

  // Validation Logique
  const currentPos = positions.find(p => p.ticker === ticker);
  const ownedQty = currentPos?.quantity || 0;
  
  const canAfford = side === 'BUY' ? cash >= estimatedTotal : true;
  const canSell = side === 'SELL' ? ownedQty >= qty : true;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (price <= 0) throw new Error("Attente du prix marché...");
      if (qty <= 0) throw new Error("Quantité invalide");
      if (side === 'BUY' && !canAfford) throw new Error("Fonds insuffisants");
      if (side === 'SELL' && !canSell) throw new Error("Quantité détenue insuffisante");

      await executeOrder({
        ticker: ticker.toUpperCase(),
        action: side,
        quantity: Number(qty)
      });
      
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-slate-950 border border-slate-700 shadow-2xl rounded-xl overflow-hidden flex flex-col relative">
        
        {/* HEADER */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
          <h3 className="font-bold text-white flex items-center gap-2 tracking-widest text-sm">
            <Calculator size={16} className="text-neon-blue"/> TRADE EXECUTION
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition"><X size={20}/></button>
        </div>

        {success ? (
            <div className="p-10 flex flex-col items-center justify-center text-center space-y-4 animate-in zoom-in duration-300">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                    <CheckCircle2 size={32} />
                </div>
                <h4 className="text-white font-bold text-lg">ORDRE EXÉCUTÉ</h4>
                <p className="text-slate-400 text-xs">Transaction enregistrée sur la blockchain locale.</p>
            </div>
        ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
            
            {/* SIDE SELECTOR */}
            <div className="grid grid-cols-2 gap-3">
                <button
                type="button"
                onClick={() => setSide('BUY')}
                className={`flex flex-col items-center justify-center py-3 rounded-lg border transition-all ${
                    side === 'BUY' 
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                    : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600 hover:bg-slate-800'
                }`}
                >
                <ArrowDownRight size={24} className="mb-1" />
                <span className="text-xs font-bold">BUY (LONG)</span>
                </button>
                <button
                type="button"
                onClick={() => setSide('SELL')}
                className={`flex flex-col items-center justify-center py-3 rounded-lg border transition-all ${
                    side === 'SELL' 
                    ? 'bg-red-500/10 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                    : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600 hover:bg-slate-800'
                }`}
                >
                <ArrowUpRight size={24} className="mb-1" />
                <span className="text-xs font-bold">SELL (EXIT)</span>
                </button>
            </div>

            {/* INPUTS */}
            <div className="space-y-4">
                <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-500 font-bold">Asset Ticker</label>
                <div className="relative">
                    <input 
                        type="text" 
                        value={ticker} 
                        onChange={(e) => setTicker(e.target.value.toUpperCase())}
                        className="w-full bg-black border border-slate-700 p-3 rounded text-white font-mono text-lg font-bold focus:border-neon-blue outline-none text-center uppercase"
                        placeholder="TICKER"
                        autoFocus={!prefillTicker}
                    />
                    <div className="absolute right-3 top-4 text-xs font-mono text-slate-500">USD</div>
                </div>
                <div className="text-center text-xs font-mono text-neon-blue h-4 mt-1 flex justify-center items-center gap-2">
                    {price > 0 ? (
                        <>
                            <span className="opacity-50">MARKET PRICE:</span>
                            <span className="font-bold">{price.toFixed(2)} $</span>
                        </>
                    ) : (
                        <span className="text-slate-600 italic animate-pulse">Waiting for market data...</span>
                    )}
                </div>
                </div>

                <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-500 font-bold">Quantity</label>
                <input 
                    type="number" 
                    value={qty} 
                    onChange={(e) => setQty(e.target.value)}
                    className="w-full bg-black border border-slate-700 p-3 rounded text-white font-mono text-lg font-bold focus:border-neon-blue outline-none text-center"
                    min="0.0001" step="any"
                />
                </div>
            </div>

            {/* SUMMARY */}
            <div className="bg-slate-900 rounded p-3 border border-slate-800 space-y-2">
                <div className="flex justify-between text-xs text-slate-400">
                <span>Estimated Total</span>
                <span className="text-white font-mono font-bold">{estimatedTotal.toFixed(2)} $</span>
                </div>
                
                <div className="h-[1px] bg-slate-800 my-1"></div>

                {side === 'BUY' ? (
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Buying Power</span>
                        <span className={canAfford ? "text-emerald-400 font-mono" : "text-red-500 font-mono"}>
                            {cash.toFixed(2)} $
                        </span>
                    </div>
                ) : (
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Holdings</span>
                        <span className={canSell ? "text-white font-mono" : "text-red-500 font-mono"}>
                            {ownedQty} {ticker}
                        </span>
                    </div>
                )}
            </div>

            {/* ERROR MSG */}
            {error && (
                <div className="flex items-center gap-2 text-red-400 text-[10px] bg-red-950/30 p-2 rounded border border-red-900/50 animate-pulse">
                <AlertTriangle size={12} /> {error}
                </div>
            )}

            {/* ACTION BUTTON */}
            <button
                type="submit"
                disabled={loading || !ticker || qty <= 0 || price <= 0 || (side === 'BUY' && !canAfford) || (side === 'SELL' && !canSell)}
                className={`w-full py-4 font-bold text-sm uppercase tracking-widest rounded transition-all flex items-center justify-center gap-2
                ${side === 'BUY' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-red-600 hover:bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]'}
                text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
                `}
            >
                {loading ? 'PROCESSING...' : `CONFIRM ${side}`}
            </button>

            </form>
        )}
      </div>
    </div>
  );
}