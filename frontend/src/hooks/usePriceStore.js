import { useState, useCallback } from 'react';

/**
 * Store global pour les prix temps réel
 * Format: { "AAPL": { price: 150.2, change_pct: 1.5, is_open: true }, ... }
 */
export function usePriceStore() {
  const [prices, setPrices] = useState({});

  const updatePrice = useCallback((ticker, data) => {
    setPrices(prev => ({
      ...prev,
      [ticker]: {
        ...prev[ticker], // Garde les anciennes valeurs si le message est partiel
        ...data,
        timestamp: Date.now()
      }
    }));
  }, []);

  return { prices, updatePrice };
}