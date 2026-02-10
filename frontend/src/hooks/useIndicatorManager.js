import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'trading_indicators_v2';

export function useIndicatorManager(ticker) {
  // État global de tous les indicateurs (persistant)
  const [repoIndicators, setRepoIndicators] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  // Sauvegarde automatique
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(repoIndicators));
  }, [repoIndicators]);

  // Indicateurs du ticker actuel
  const indicators = repoIndicators[ticker] || [];

  // --- ACTIONS ---

  const addIndicator = useCallback((newInd) => {
    const indicatorWithState = { ...newInd, visible: true };
    setRepoIndicators(prev => ({
      ...prev,
      [ticker]: [...(prev[ticker] || []), indicatorWithState]
    }));
  }, [ticker]);

  const removeIndicator = useCallback((id) => {
    setRepoIndicators(prev => ({
      ...prev,
      [ticker]: (prev[ticker] || []).filter(i => i.id !== id)
    }));
  }, [ticker]);

  const toggleVisibility = useCallback((id) => {
    setRepoIndicators(prev => ({
      ...prev,
      [ticker]: (prev[ticker] || []).map(i => 
        i.id === id ? { ...i, visible: !i.visible } : i
      )
    }));
  }, [ticker]);

  const updateIndicator = useCallback((updatedInd) => {
    setRepoIndicators(prev => ({
      ...prev,
      [ticker]: (prev[ticker] || []).map(i => i.id === updatedInd.id ? updatedInd : i)
    }));
  }, [ticker]);

  const nukeIndicators = useCallback(() => {
    setRepoIndicators({});
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    indicators,
    addIndicator,
    removeIndicator,
    toggleVisibility,
    updateIndicator,
    nukeIndicators
  };
}