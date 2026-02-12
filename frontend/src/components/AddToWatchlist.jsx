import { useState } from 'react';
import { Check, FolderPlus } from 'lucide-react';
import { marketApi } from '../api/client';

// Props renommée : portfolios -> watchlists
export default function AddToWatchlist({ ticker, watchlists, onUpdate }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fonction renommée
  const isInWatchlist = (wid) => {
    const w = watchlists.find(list => list.id === wid);
    return w?.items.some(item => item.ticker === ticker);
  };

  const handleToggle = async (wid) => {
    setLoading(true);
    const isPresent = isInWatchlist(wid);
    
    try {
      if (isPresent) {
        // API Call mis à jour
        await marketApi.removeTickerFromWatchlist(wid, ticker);
      } else {
        // API Call mis à jour
        await marketApi.addTickerToWatchlist(wid, ticker);
      }
      await onUpdate();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-2 rounded-lg transition text-sm font-medium"
      >
        <FolderPlus size={16} /> Gérer
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-2 animate-in fade-in zoom-in duration-200">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2 py-1 mb-1">
              Ajouter aux favoris...
            </h4>
            <div className="space-y-1">
              {watchlists.map(w => {
                const checked = isInWatchlist(w.id);
                return (
                  <button
                    key={w.id}
                    disabled={loading}
                    onClick={() => handleToggle(w.id)}
                    className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-slate-800 text-left text-sm transition"
                  >
                    <span className="text-slate-200">{w.name}</span>
                    {checked && <Check size={14} className="text-emerald-500" />}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}