/* frontend/src/components/Chart/components/Toolbar.jsx */
import { BarChart2, TrendingUp, MoreHorizontal, Eye, EyeOff } from 'lucide-react';

const PERIODS = [
  { label: '1J', value: '1d' }, { label: '1S', value: '5d' }, { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' }, { label: '6M', value: '6mo' }, { label: 'YTD', value: 'ytd' },
  { label: '1A', value: '1y' }, { label: '5A', value: '5y' }, { label: 'MAX', value: 'max' },
];

const OHLC_OPTS = [
    { key: 'open', label: 'OPN' },
    { key: 'high', label: 'HGH' },
    { key: 'low', label: 'LOW' },
    { key: 'close', label: 'CLS' },
];

export default function Toolbar({ 
    activePeriod, onPeriodChange, 
    chartType, onTypeChange,
    visibility, onToggleVisibility 
}) {
  return (
    <div className="flex flex-wrap justify-between items-center px-2 py-2 border-b border-slate-800 bg-black z-20 gap-2">
      {/* Périodes */}
      <div className="flex items-center overflow-x-auto no-scrollbar">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => onPeriodChange(p.value)}
            className={`
              px-3 py-1 text-[10px] font-bold transition-all border border-slate-800 -ml-[1px] first:ml-0 whitespace-nowrap
              ${activePeriod === p.value 
                ? 'bg-slate-900 text-neon-blue border-neon-blue shadow-[0_0_8px_rgba(0,243,255,0.2)] z-10' 
                : 'bg-black text-slate-500 hover:text-white hover:bg-slate-900'
              }
            `}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Controls Group */}
      <div className="flex items-center gap-4 ml-auto">
        
        {/* OHLC Toggles (Visible seulement en mode Candle) */}
        {chartType === 'candle' && (
            <div className="flex items-center gap-1 hidden md:flex">
                {OHLC_OPTS.map((opt) => (
                    <button
                        key={opt.key}
                        onClick={() => onToggleVisibility(opt.key)}
                        className={`
                            px-2 h-6 text-[9px] font-bold border transition-all uppercase
                            ${visibility[opt.key] 
                                ? 'bg-slate-900 border-slate-600 text-slate-200' 
                                : 'border-slate-800 text-slate-600 hover:text-slate-400'
                            }
                        `}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        )}

        <div className="h-4 w-[1px] bg-slate-800 hidden md:block"></div>

        <div className="flex items-center gap-1">
           {/* Price Lines */}
           <button
             onClick={() => onToggleVisibility('priceLines')}
             title="Lignes de prix"
             className={`w-6 h-6 flex items-center justify-center border transition-all ${visibility.priceLines ? 'bg-slate-900 border-neon-blue text-neon-blue' : 'border-slate-800 text-slate-700'}`}
           >
             <MoreHorizontal size={14} />
           </button>
           
           {/* Volume */}
           <button
             onClick={() => onToggleVisibility('volume')}
             title="Volume"
             className={`px-2 h-6 flex items-center border text-[10px] font-bold transition-all ${visibility.volume ? 'bg-slate-900 border-neon-blue text-neon-blue' : 'border-slate-800 text-slate-700'}`}
           >
             VOL
           </button>
        </div>

        {/* Chart Type Switcher */}
        <div className="flex border border-slate-800">
          <button 
            onClick={() => onTypeChange('candle')}
            className={`p-1.5 transition-all ${chartType === 'candle' ? 'bg-slate-800 text-neon-blue shadow-[inset_0_0_5px_rgba(0,243,255,0.2)]' : 'text-slate-600 hover:text-white'}`}
          >
            <BarChart2 size={14} />
          </button>
          <div className="w-[1px] bg-slate-800"></div>
          <button 
            onClick={() => onTypeChange('line')}
            className={`p-1.5 transition-all ${chartType === 'line' ? 'bg-slate-800 text-neon-blue shadow-[inset_0_0_5px_rgba(0,243,255,0.2)]' : 'text-slate-600 hover:text-white'}`}
          >
            <TrendingUp size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}