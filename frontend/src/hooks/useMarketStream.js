import { useState, useEffect, useRef, useCallback } from 'react';
import { marketApi } from '../api/client';

const VIEW_KEY = 'trading_view_pref';

export function useMarketStream(ticker, refreshInterval = 15, defaultPeriod = '1mo') {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Période (Persistante)
  const [period, setPeriodState] = useState(() => localStorage.getItem(VIEW_KEY) || defaultPeriod);

  // Pour éviter que le chargement ne "blink" à chaque refresh silencieux
  const isFirstLoad = useRef(true);

  const setPeriod = (p) => {
    setPeriodState(p);
    localStorage.setItem(VIEW_KEY, p);
    isFirstLoad.current = true; // On veut voir le loading spinner si on change de période
    setLoading(true);
  };

  const fetchStream = useCallback(async () => {
    if (!ticker) return;
    try {
      const res = await marketApi.getSnapshot(ticker, period);
      setData(res.data);
      setError(null);
    } catch (err) {
      console.error("Stream Error:", err);
      // On ne set pas Error tout de suite si on a déjà des data (pour éviter écran rouge sur un échec réseau temporaire)
      if (isFirstLoad.current) setError("CONNECTION_LOST");
    } finally {
      setLoading(false);
      isFirstLoad.current = false;
    }
  }, [ticker, period]);

  // CYCLE DE VIE DU POLLING
  useEffect(() => {
    // 1. Appel immédiat
    fetchStream();

    // 2. Setup Interval
    const intervalId = setInterval(fetchStream, refreshInterval * 1000);

    // 3. Cleanup
    return () => clearInterval(intervalId);
  }, [fetchStream, refreshInterval]);

  return {
    data,       // Contient tout : .live, .chart, .info
    loading,    // Vrai seulement au premier chargement ou changement de ticker
    error,
    period,
    setPeriod,
    refresh: fetchStream
  };
}