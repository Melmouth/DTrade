import { useState, useEffect } from 'react';
import { Clock, Wifi, WifiOff } from 'lucide-react';
import { marketApi } from '../api/client';

export default function MarketStatus({ ticker, type = 'full' }) {
  const [status, setStatus] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');

  // 1. Fetch data au changement de ticker
  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const res = await marketApi.getMarketStatus(ticker);
        if (isMounted) setStatus(res.data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchStatus();
    // Refresh toutes les minutes pour recalibrer
    const interval = setInterval(fetchStatus, 60000); 
    return () => { isMounted = false; clearInterval(interval); };
  }, [ticker]);

  // 2. Timer local (seconde par seconde)
  useEffect(() => {
    if (!status?.next_event) return;

    const timer = setInterval(() => {
      const now = new Date();
      const target = new Date(status.next_event);
      const diff = target - now;

      if (diff <= 0) {
        // Le temps est écoulé, on devrait refetcher le status
        setTimeLeft("00:00:00");
      } else {
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${h}h ${m}m ${s}s`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [status]);

  if (!status) return null;

  const isOpen = status.state === 'OPEN';

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