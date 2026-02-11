import { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export default function MarketStatus({ type = 'full', data = null }) {
  const [timeLeft, setTimeLeft] = useState('--:--:--');

  // 1. COUNTDOWN LOGIC
  // Basé uniquement sur la prop 'data' reçue du Store Global
  useEffect(() => {
    if (!data?.next_event) return;

    const calculateTime = () => {
      const now = new Date();
      const target = new Date(data.next_event);
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft("00:00:00");
      } else {
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        // Padding pour afficher "05m" au lieu de "5m"
        setTimeLeft(`${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`);
      }
    };

    calculateTime(); // Calcul immédiat
    const timer = setInterval(calculateTime, 1000);

    return () => clearInterval(timer);
  }, [data]); // On recalcule si l'objet data change (ex: passage de open à closed)

  // Si pas de données, on n'affiche rien (évite les états vides/loading laids)
  if (!data) return null;

  const isOpen = data.is_open; 

  // --- RENDER MODE: COMPACT (Pour la Sidebar) ---
  if (type === 'compact') {
    return isOpen ? (
        <div className="w-2 h-2 rounded-full bg-neon-green shadow-[0_0_5px_#00ff41]" title="Marché Ouvert"></div>
    ) : (
        <div className="flex items-center gap-1" title={`Ouvre dans ${timeLeft}`}>
             <div className="w-2 h-2 rounded-full bg-red-500"></div>
        </div>
    );
  }

  // --- RENDER MODE: FULL (Pour le Header) ---
  return (
    <div className={`flex items-center gap-3 px-3 py-1 rounded border backdrop-blur-md transition-colors ${
        isOpen 
        ? 'bg-neon-green/10 border-neon-green/30 text-neon-green' 
        : 'bg-red-500/10 border-red-500/30 text-red-500'
    }`}>
      {isOpen ? (
        <>
            <Wifi size={16} className="animate-pulse" />
            <div className="flex flex-col leading-none">
                <span className="text-[10px] font-bold tracking-widest">MARKET OPEN</span>
                <span className="text-[9px] opacity-70">CLOSES IN {timeLeft}</span>
            </div>
        </>
      ) : (
        <>
            <WifiOff size={16} />
            <div className="flex flex-col leading-none">
                <span className="text-[10px] font-bold tracking-widest">MARKET CLOSED</span>
                <span className="text-[9px] font-mono mt-0.5">OPENS IN: {timeLeft}</span>
            </div>
        </>
      )}
    </div>
  );
}