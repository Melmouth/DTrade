import { useState, useEffect, useRef, useCallback } from 'react';
import { marketApi } from '../api/client';

const VIEW_KEY = 'trading_view_pref';
const WS_BASE_URL = 'ws://localhost:8000/ws';

// Intervalle de synchronisation HTTP de secours (Background Sync)
// Sert à corriger les éventuelles dérives du WebSocket sur le long terme (ex: volumes)
const SYNC_INTERVAL_MS = 1 * 60 * 1000; // 1 Minute

// Helper pour convertir l'intervalle texte (backend) en secondes
// Permet de savoir quand clore une bougie (ex: '1m' = toutes les 60s)
const getIntervalSeconds = (intervalStr) => {
  const map = {
    "1m": 60, "2m": 120, "5m": 300, "15m": 900, "30m": 1800,
    "1h": 3600, "1d": 86400, "1wk": 604800, "1mo": 2592000
  };
  return map[intervalStr] || 86400; // Par défaut 1 jour si inconnu
};

export function useMarketStream(ticker, defaultPeriod = '1mo') {
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
    // Lors d'un changement utilisateur, on veut voir le loading
    fetchInitialSnapshot(ticker, p, false);
  };

  // 1. CHARGEMENT HTTP (Snapshot initial + Sync Background)
  const fetchInitialSnapshot = useCallback(async (t, p, isBackground = false) => {
    if (!t) return;
    
    // On ne montre le spinner que si c'est une action utilisateur explicite (pas en background)
    if (!isBackground) setLoading(true);
    
    try {
      const res = await marketApi.getSnapshot(t, p);
      if (isMountedRef.current) {
        // En background sync, lightweight-charts gérera la transition fluidement
        setData(res.data); 
        setError(null);
        setLoading(false);
      }
    } catch (err) {
      console.error("Snapshot Error:", err);
      if (isMountedRef.current && !isBackground) {
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

  // 2. ORCHESTRATION DU CHARGEMENT (Initial + Périodique)
  useEffect(() => {
      if (!ticker) return;
      currentTickerRef.current = ticker;
      
      // A. Chargement immédiat
      fetchInitialSnapshot(ticker, period, false);

      // B. Background Re-validation (Toutes les 5 minutes)
      const syncInterval = setInterval(() => {
          fetchInitialSnapshot(ticker, period, true); // true = mode silencieux
      }, SYNC_INTERVAL_MS);

      return () => clearInterval(syncInterval);
  }, [ticker, period, fetchInitialSnapshot]);

  // 3. WEBSOCKET INTELLIGENT (Gestion temps réel des bougies)
  useEffect(() => {
    if (!ticker) return;

    let isExpectedClose = false;
    
    const connectWs = () => {
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) return; 

      const ws = new WebSocket(`${WS_BASE_URL}/${ticker}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        
        try {
          const update = JSON.parse(event.data);
          
          if (update.type === 'PRICE_UPDATE') {
            setData(prevData => {
              // SÉCURITÉ : Si pas de données de base, on ne fait rien (on attend le snapshot)
              if (!prevData || !prevData.chart || !prevData.chart.data.length) return prevData;

              const currentPrice = update.price;
              const updateTime = update.timestamp; // Timestamp Unix (secondes) venant du backend
              
              // A. Déterminer l'intervalle actuel (ex: 60s pour '1m')
              const intervalStr = prevData.chart.meta.interval || "1d";
              const intervalSec = getIntervalSeconds(intervalStr);

              // B. Calculer le "Time Bucket" de la nouvelle donnée
              // On aligne le temps sur la grille (ex: 10:01:45 -> 10:01:00 pour du 1m)
              const bucketTime = Math.floor(updateTime / intervalSec) * intervalSec;
              
              // C. Récupérer la dernière bougie connue dans l'état local
              const lastCandleIndex = prevData.chart.data.length - 1;
              const lastCandle = prevData.chart.data[lastCandleIndex];
              
              // Conversion date ISO -> Unix timestamp pour comparaison
              const lastCandleTime = new Date(lastCandle.date).getTime() / 1000;

              // --- LOGIQUE DE BOUGIE ---
              let newChartData = [...prevData.chart.data];

              if (bucketTime > lastCandleTime) {
                // CAS 1 : LE TEMPS A PASSÉ -> CRÉATION
                // On fige la précédente et on push une nouvelle
                const newCandle = {
                    date: new Date(bucketTime * 1000).toISOString(),
                    open: currentPrice,
                    high: currentPrice,
                    low: currentPrice,
                    close: currentPrice,
                    volume: 0 // Reset volume pour la nouvelle bougie
                };
                newChartData.push(newCandle);
              } else {
                // CAS 2 : MÊME INTERVALLE -> MISE À JOUR
                // On met à jour les mèches (High/Low) et le corps (Close)
                newChartData[lastCandleIndex] = {
                    ...lastCandle,
                    close: currentPrice,
                    high: Math.max(lastCandle.high, currentPrice),
                    low: Math.min(lastCandle.low, currentPrice),
                    // Note: Sans flux volume tick-by-tick, on garde le volume existant
                };
              }

              // On retourne le nouvel état complet
              return {
                ...prevData,
                live: {
                    price: currentPrice,
                    change_pct: update.change_pct,
                    is_open: update.is_open
                },
                chart: {
                    ...prevData.chart,
                    data: newChartData
                }
              };
            });
          }
        } catch (e) {
          console.error("WS Parse Error", e);
        }
      };

      ws.onclose = () => {
        if (isExpectedClose) return;
        // Reconnexion automatique intelligente si le composant est toujours monté
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
    // Permet de forcer un refresh manuel si besoin
    refresh: () => fetchInitialSnapshot(ticker, period, false)
  };
}