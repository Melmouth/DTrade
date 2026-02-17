import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function GlassModal({ isOpen, onClose, title, icon: Icon, children, maxWidth = "max-w-md", borderColor = "border-slate-700" }) {
  
  // Close on ESC key
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      ></div>
      
      {/* Content Container */}
      <div className={`relative w-full ${maxWidth} bg-[#050505] border ${borderColor} shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]`}>
        
        {/* Decor Lines */}
        <div className="absolute top-0 left-0 w-20 h-[2px] bg-gradient-to-r from-transparent to-current opacity-50"></div>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5 shrink-0">
          <div className="flex items-center gap-3">
             {Icon && (
                 <div className={`p-2 rounded bg-slate-900 border border-white/10`}>
                    <Icon size={18} className="text-white" />
                 </div>
             )}
             <h3 className="text-sm font-bold text-white uppercase tracking-wider">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-white transition-colors hover:bg-white/10 rounded">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
            {children}
        </div>

      </div>
    </div>
  );
}