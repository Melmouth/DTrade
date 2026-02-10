import { useState, useEffect, useRef } from 'react';
import { marketApi } from '../api/client';

export function useLiveFeed(ticker, interval = 15) {
  const [quote, setQuote] = useState({ price: 0, symbol: '' });
  const [livePrice, setLivePrice] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!ticker) return;

    // Reset du prix au changement de ticker
    setLivePrice(null); 
    setIsConnected(false);

    // Fonction de connexion
    const connect = () => {
      wsRef.current = marketApi.createLiveConnection(ticker, interval, (data) => {
        setQuote({ price: data.price, symbol: data.symbol });
        setLivePrice(data.price);
        setIsConnected(true);
      });
    };

    connect();

    // Cleanup à la fermeture
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        setIsConnected(false);
      }
    };
  }, [ticker, interval]);

  return {
    quote,
    livePrice,
    isConnected
  };
}