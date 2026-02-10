import { useState, useEffect, useCallback } from 'react';
import { marketApi } from '../api/client';

const STORAGE_KEY_VIEWS = 'trading_views_v1';

export function useMarketData(ticker, defaultPeriod = '1mo') {
  const [data, setData] = useState([]);
  const [dailyData, setDailyData] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Gestion de la période préférée par Ticker
  const [repoViews, setRepoViews] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_VIEWS);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  // Période active : celle sauvegardée OU celle par défaut
  const activePeriod = repoViews[ticker] || defaultPeriod;

  // Sauvegarde des vues
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_VIEWS, JSON.stringify(repoViews));
  }, [repoViews]);

  // Fonction de chargement
  const fetchData = useCallback(async (sym, period) => {
    setLoading(true);
    setError('');
    
    // Reset préventif pour éviter les glitchs visuels
    setData([]);
    setDailyData([]);
    setMeta(null);

    try {
      const res = await marketApi.getHistory(sym, period);
      setData(res.data.data);
      setDailyData(res.data.daily_data);
      setMeta(res.data.meta);
    } catch (err) {
      console.error(err);
      setError("ERR::DATA_FETCH_FAIL");
    } finally {
      setLoading(false);
    }
  }, []);

  // Déclencheur principal : Changement de Ticker ou de Période
  useEffect(() => {
    if (ticker) {
      fetchData(ticker, activePeriod);
    }
  }, [ticker, activePeriod, fetchData]);

  // Action pour changer la période (et la sauvegarder)
  const setPeriod = (newPeriod) => {
    setRepoViews(prev => ({ ...prev, [ticker]: newPeriod }));
  };

  const nukeViews = () => {
    setRepoViews({});
    localStorage.removeItem(STORAGE_KEY_VIEWS);
  };

  return {
    chartData: data,
    dailyData,
    meta,
    loading,
    error,
    activePeriod,
    setPeriod,
    refetch: () => fetchData(ticker, activePeriod),
    nukeViews
  };
}