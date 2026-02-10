import { useState, useEffect } from 'react';
import { Plus, Check, FolderPlus } from 'lucide-react';
import { marketApi } from '../api/client';

export default function AddToPortfolio({ ticker, portfolios, onUpdate }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const isInPortfolio = (pid) => {
    const p = portfolios.find(port => port.id === pid);
    return p?.items.some(item => item.ticker === ticker);
  };

  const handleToggle = async (pid) => {
    setLoading(true);
    const isPresent = isInPortfolio(pid);
    
    try {
      if (isPresent) {
        await marketApi.removeTickerFromPortfolio(pid, ticker);
      } else {
        await marketApi.addTickerToPortfolio(pid, ticker);
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
          {/* Correction ici: z-50 pour passer au dessus du graphique */}
          <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-2 animate-in fade-in zoom-in duration-200">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2 py-1 mb-1">
              Ajouter à...
            </h4>
            <div className="space-y-1">
              {portfolios.map(p => {
                const checked = isInPortfolio(p.id);
                return (
                  <button
                    key={p.id}
                    disabled={loading}
                    onClick={() => handleToggle(p.id)}
                    className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-slate-800 text-left text-sm transition"
                  >
                    <span className="text-slate-200">{p.name}</span>
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