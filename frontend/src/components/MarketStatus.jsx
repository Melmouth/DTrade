import { useState, useEffect } from 'react';
import { Clock, Wifi, WifiOff } from 'lucide-react';
import { marketApi } from '../api/client';

export default function MarketStatus({ ticker, type = 'full', data = null }) {
  const [localStatus, setLocalStatus] = useState(null);
  const [timeLeft, setTimeLeft] = useState('--:--:--');

  // STRATÉGIE HYBRIDE :
  // Si le parent (App.jsx) nous donne 'data', on l'utilise (Stream).
  // Sinon, on utilise 'localStatus' qu'on va aller chercher nous-mêmes (Sidebar).
  const status = data || localStatus;

  // 1. FETCH LOGIC (Seulement si aucune data n'est fournie en props)
  useEffect(() => {
    // Si on a déjà des données via le parent, on ne fetch pas (Optimisation Header)
    if (data) return; 
    if (!ticker) return;

    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const res = await marketApi.getMarketStatus(ticker);
        if (isMounted) setLocalStatus(res.data);
      } catch (e) {
        console.error("Status fetch failed", e);
      }
    };

    fetchStatus();
    // Refresh lent (1min) pour la sidebar uniquement
    const interval = setInterval(fetchStatus, 60000);
    return () => { isMounted = false; clearInterval(interval); };
  }, [ticker, data]);

  // 2. COUNTDOWN LOGIC
  useEffect(() => {
    if (!status?.next_event) return;

    const calculateTime = () => {
      const now = new Date();
      const target = new Date(status.next_event);
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
  }, [status]);

  if (!status) return null;

  // --- FIX CRITIQUE ICI ---
  // Le nouveau backend renvoie un booléen 'is_open', pas une string 'state'
  const isOpen = status.is_open; 
  // -----------------------

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