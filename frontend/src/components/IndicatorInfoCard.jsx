import { FileText, Cpu, Layers, Calendar, Activity, Database, Terminal, Microscope } from 'lucide-react';
import GlassModal from './GlassModal';

export default function IndicatorInfoCard({ indicator, isOpen, onClose }) {
  if (!indicator) return null;

  // --- LOGIQUE RBI CORRIGÉE ---
  // On regarde la résolution réelle ('1d', '1m', etc.)
  const res = indicator.resolution || (indicator.granularity === 'days' ? '1d' : '??');
  
  // Est-ce du Macro ? (1d, 1wk, 1mo)
  const isMacro = ['1d', '1wk', '1mo', 'days'].includes(res);
  
  const config = {
      label: isMacro ? 'MACRO SOURCE (Daily)' : `MICRO SOURCE (${res})`,
      desc: isMacro 
        ? "Cet indicateur est calculé sur les clôtures journalières (24h). Il est stable et projeté sur les vues intraday."
        : `Cet indicateur est calculé précisement sur des bougies de ${res}. Il réagit à chaque tick de cette granularité.`,
      color: isMacro ? 'text-neon-green' : 'text-neon-blue',
      border: isMacro ? 'border-neon-green/30' : 'border-neon-blue/30',
      icon: isMacro ? Database : Microscope
  };

  // Gestion de la date (Timestamp String du backend)
  const dateStr = indicator.created_at 
    ? new Date(indicator.created_at).toLocaleString() 
    : "Session (Non sauvegardé)";

  return (
    <GlassModal 
        isOpen={isOpen} 
        onClose={onClose} 
        title="Technical Specification" 
        icon={FileText}
        borderColor={config.border}
    >
        <div className="space-y-6">
          
          {/* 1. RBI IDENTITY CARD */}
          <div className="bg-slate-900/50 rounded border border-white/5 p-4 relative overflow-hidden group">
            <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity ${config.color}`}>
                <Layers size={80} />
            </div>
            
            <div className="relative z-10">
                <div className="text-[10px] uppercase text-slate-400 font-bold mb-2 flex items-center gap-2">
                    <config.icon size={14} className={config.color} /> 
                    Resolution Architecture
                </div>
                <div className={`text-xl font-bold tracking-widest ${config.color} mb-2`}>
                    {config.label}
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed max-w-[90%]">
                    {config.desc}
                </p>
            </div>
          </div>

          {/* 2. STATS GRID */}
          <div className="grid grid-cols-2 gap-4">
             {/* Smart Status */}
             {indicator.isSmart && (
                 <div className="col-span-2 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded flex items-center justify-between">
                    <div>
                        <div className="text-[10px] uppercase text-indigo-300/70 font-bold mb-1 flex items-center gap-1">
                            <Cpu size={12} /> Neural Optimization
                        </div>
                        <div className="text-xs text-indigo-200">
                            Target Accuracy: <span className="font-mono font-bold text-indigo-400">{indicator.smartParams?.target}%</span>
                        </div>
                    </div>
                    <div className="px-2 py-1 bg-indigo-500/20 rounded text-[9px] font-bold text-indigo-300 uppercase">
                        Active
                    </div>
                 </div>
             )}
             
             {/* Type */}
             <div className="p-3 bg-slate-900 border border-white/5 rounded">
                <div className="text-[10px] uppercase text-slate-500 font-bold mb-1 flex items-center gap-1">
                    <Activity size={12} /> Algo Type
                </div>
                <div className="text-sm font-bold text-slate-200 font-mono">{indicator.type}</div>
             </div>

             {/* Created At */}
             <div className="p-3 bg-slate-900 border border-white/5 rounded">
                <div className="text-[10px] uppercase text-slate-500 font-bold mb-1 flex items-center gap-1">
                    <Calendar size={12} /> Created At
                </div>
                <div className="text-sm font-bold text-slate-200 font-mono">
                    {dateStr}
                </div>
             </div>
          </div>

          {/* 3. PARAMETERS DUMP */}
          <div className="p-4 bg-black border border-slate-800 rounded">
            <div className="text-[10px] uppercase text-slate-500 font-bold mb-3 flex items-center gap-2 border-b border-slate-800 pb-2">
                <Terminal size={12} /> Configuration Vector
            </div>
            <div className="space-y-1 font-mono text-[11px]">
                {Object.entries(indicator.params || {}).map(([k, v]) => (
                    <div key={k} className="flex justify-between items-center group">
                        <span className="text-slate-500 group-hover:text-slate-300 transition-colors">{k}</span>
                        <span className="text-neon-blue">{v}</span>
                    </div>
                ))}
                <div className="flex justify-between items-center group pt-2 mt-2 border-t border-slate-800/50">
                    <span className="text-slate-500">Period Context</span>
                    <span className="text-white">{indicator.period || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center group">
                    <span className="text-slate-500">Internal Res</span>
                    <span className="text-white font-bold">{res}</span>
                </div>
            </div>
          </div>

        </div>
    </GlassModal>
  );
}