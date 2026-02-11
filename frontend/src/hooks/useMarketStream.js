import { useState, useEffect, useRef, useCallback } from 'react';
import { marketApi } from '../api/client';

const VIEW_KEY = 'trading_view_pref';
const WS_BASE_URL = 'ws://localhost:8000/ws';

export function useMarketStream(ticker, _ignoredInterval, defaultPeriod = '1mo') {
  // Initialisation state
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [period, setPeriodState] = useState(() => localStorage.getItem(VIEW_KEY) || defaultPeriod);

  // Refs de sécurité
  const wsRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const isMountedRef = useRef(true); 
  const currentTickerRef = useRef(ticker); 

  const setPeriod = (p) => {
    setPeriodState(p);
    localStorage.setItem(VIEW_KEY, p);
    fetchInitialSnapshot(ticker, p);
  };

  // 1. CHARGEMENT HTTP (LOURD - Une seule fois au début)
  const fetchInitialSnapshot = useCallback(async (t, p) => {
    if (!t) return;
    try {
      const res = await marketApi.getSnapshot(t, p);
      if (isMountedRef.current) {
        setData(res.data); // On charge l'historique ici
        setError(null);
        setLoading(false);
      }
    } catch (err) {
      console.error("Snapshot Error:", err);
      if (isMountedRef.current) {
        setError("CONNECTION_FAILED");
        setLoading(false);
      }
    }
  }, []);

  // Cleanup au démontage
  useEffect(() => {
      isMountedRef.current = true;
      return () => { 
          isMountedRef.current = false;
          if (wsRef.current) wsRef.current.close();
          if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      };
  }, []);

  // Trigger Snapshot si Ticker/Period change
  useEffect(() => {
      if (!ticker) return;
      currentTickerRef.current = ticker;
      fetchInitialSnapshot(ticker, period);
  }, [ticker, period, fetchInitialSnapshot]);

  // 2. WEBSOCKET (LÉGER - Mises à jour rapides)
  useEffect(() => {
    if (!ticker) return;

    let isExpectedClose = false;
    
    const connectWs = () => {
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) return; 

      const ws = new WebSocket(`${WS_BASE_URL}/${ticker}`);
      wsRef.current = ws;

      ws.onopen = () => { /* Connected */ };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        
        try {
          const update = JSON.parse(event.data);
          
          if (update.type === 'PRICE_UPDATE') {
            setData(prevData => {
              // SÉCURITÉ ANTI-FREEZE :
              // Si pas de données de base, on ne fait rien.
              if (!prevData) return prevData;

              // 1. On met à jour UNIQUEMENT les infos "Live" (Header, Status)
              // 2. ON NE TOUCHE PAS à prevData.chart.data (Array) !
              //    C'est le composant StockChart qui s'occupera d'animer la dernière bougie
              //    via la prop 'livePrice' qu'il reçoit par ailleurs.
              
              return {
                ...prevData,
                live: {
                    price: update.price,
                    change_pct: update.change_pct,
                    is_open: update.is_open
                }
                // On garde prevData.chart tel quel => Pas de changement de référence => Pas de re-render lourd du graph
              };
            });
          }
        } catch (e) {
          console.error("WS Parse Error", e);
        }
      };

      ws.onclose = () => {
        if (isExpectedClose) return;
        if (isMountedRef.current && currentTickerRef.current === ticker) {
            retryTimeoutRef.current = setTimeout(connectWs, 3000);
        }
      };
      
      ws.onerror = () => ws.close();
    };

    connectWs();

    return () => {
      isExpectedClose = true;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, [ticker]); 

  return {
    data,
    loading,
    error,
    period,
    setPeriod,
    refresh: () => fetchInitialSnapshot(ticker, period)
  };
}