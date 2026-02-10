import { useState } from 'react';
import { Folder, Plus, Trash2, ChevronRight, ChevronDown, TrendingUp, TrendingDown, Hash, Server, Shield } from 'lucide-react';
import { marketApi } from '../api/client';
import MarketStatus from './MarketStatus';

export default function Sidebar({ data, onSelectTicker, onReload, currentTicker }) {
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [expandedIds, setExpandedIds] = useState([]);

  const toggleFolder = (id) => {
    setExpandedIds(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newPortfolioName) return;
    try {
      await marketApi.createPortfolio(newPortfolioName);
      setNewPortfolioName('');
      setIsCreating(false);
      onReload();
    } catch (err) {
      alert("Erreur création dossier");
    }
  };

  const handleDeletePortfolio = async (id, e) => {
    e.stopPropagation();
    if (confirm("CONFIRM DELETION :: Cette action est irréversible.")) {
      await marketApi.deletePortfolio(id);
      onReload();
    }
  };

  const handleDeleteItem = async (pid, ticker, e) => {
    e.stopPropagation();
    await marketApi.removeTickerFromPortfolio(pid, ticker);
    onReload();
  };

  return (
    <div className="h-full flex flex-col bg-black border-r border-slate-800 text-slate-400 font-mono text-xs select-none relative">
      
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-[1px] h-full bg-slate-900"></div>

      {/* HEADER */}
      <div className="h-10 flex items-center justify-between px-3 border-b border-slate-800 bg-slate-900/30">
        <div className="flex items-center gap-2 text-neon-blue">
            <Server size={14} />
            <span className="font-bold tracking-widest">DATA_NODES</span>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="hover:text-white hover:bg-neon-blue/20 p-1 rounded-none transition-colors border border-transparent hover:border-neon-blue/50"
          title="NEW NODE"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* CREATION FORM STYLE COMMAND LINE */}
      {isCreating && (
        <form onSubmit={handleCreate} className="p-2 border-b border-slate-800 bg-neon-blue/5 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="text-neon-blue">{`>`}</span>
            <input
              autoFocus
              type="text"
              placeholder="MKDIR NAME..."
              className="w-full bg-transparent border-b border-neon-blue/50 px-1 py-1 text-white placeholder:text-slate-600 focus:outline-none uppercase tracking-wider"
              value={newPortfolioName}
              onChange={(e) => setNewPortfolioName(e.target.value)}
              onBlur={() => !newPortfolioName && setIsCreating(false)}
            />
          </div>
        </form>
      )}

      {/* LISTE */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {data.map((portfolio) => {
            const isOpen = expandedIds.includes(portfolio.id);
            const isSystem = portfolio.name === "Favoris";
            
            return (
              <div key={portfolio.id} className="border-b border-slate-900">
                {/* NODE HEADER */}
                <div 
                  onClick={() => toggleFolder(portfolio.id)}
                  className={`
                    group flex items-center justify-between px-3 py-2 cursor-pointer transition-all border-l-2
                    ${isOpen ? 'bg-slate-900/40 border-neon-blue text-slate-200' : 'border-transparent hover:bg-slate-900/20 hover:border-slate-700'}
                  `}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-slate-600">
                        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </span>
                    {isSystem ? <Shield size={12} className="text-neon-purple" /> : <Folder size={12} className={isOpen ? "text-neon-blue" : "text-slate-600"} />}
                    <span className="font-bold tracking-wider uppercase truncate">{portfolio.name}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-700 bg-slate-900 px-1 border border-slate-800 font-mono">
                        {portfolio.items.length.toString().padStart(2, '0')}
                    </span>
                    {!isSystem && (
                        <button 
                        onClick={(e) => handleDeletePortfolio(portfolio.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-500 transition-opacity"
                        >
                        <Trash2 size={12} />
                        </button>
                    )}
                  </div>
                </div>

                {/* ITEMS TREE */}
                {isOpen && (
                  <div className="bg-black/50 pb-2">
                    {portfolio.items.length === 0 && (
                      <div className="pl-9 py-1 text-[10px] text-slate-700 italic border-l border-slate-800 ml-4">
                        // EMPTY_DIR
                      </div>
                    )}
                    {portfolio.items.map((item) => {
                      const isPositive = item.change_pct >= 0;
                      const isActive = currentTicker === item.ticker;
                      
                      return (
                        <div 
                          key={item.ticker} 
                          onClick={() => onSelectTicker(item.ticker)}
                          className={`
                            relative pl-8 pr-3 py-1.5 cursor-pointer flex items-center justify-between group
                            border-l border-slate-800 ml-4 transition-all
                            ${isActive 
                                ? 'bg-neon-blue/10 text-white' 
                                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                            }
                          `}
                        >
                          {/* Active Indicator Line */}
                          {isActive && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-neon-blue"></div>}

                          <div className="flex items-center gap-2">
                             <Hash size={10} className="text-slate-700" />
                             <span className="font-mono font-bold tracking-widest">{item.ticker}</span>
                             
                             {/* --- INTEGRATION MARKET STATUS COMPACT --- */}
                             <div className="ml-2">
                                <MarketStatus ticker={item.ticker} type="compact" />
                             </div>
                             {/* ----------------------------------------- */}
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <span className={`flex items-center gap-1 text-[10px] font-bold ${isPositive ? 'text-neon-green' : 'text-neon-red'}`}>
                              {isPositive ? '+' : ''}{item.change_pct}%
                              {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                            </span>
                            
                            <button 
                              onClick={(e) => handleDeleteItem(portfolio.id, item.ticker, e)}
                              className="opacity-0 group-hover:opacity-100 text-slate-700 hover:text-red-500 transition-opacity"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
        })}
      </div>

      {/* FOOTER DECORATION */}
      <div className="p-3 border-t border-slate-800 text-[10px] text-slate-700 flex justify-between tracking-wider bg-black">
        <span>MEM: OK</span>
        <span>SYNC: AUTO</span>
      </div>
    </div>
  );
}