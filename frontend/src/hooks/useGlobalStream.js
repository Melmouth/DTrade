import { useEffect, useRef } from 'react';

export function useGlobalStream(onUpdate) {
  const wsRef = useRef(null);

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket('ws://localhost:8000/ws/global');
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);
          if (update.type === 'PRICE_UPDATE') {
            onUpdate(update.ticker, update);
          }
        } catch (e) { console.error("Global WS Error", e); }
      };

      ws.onclose = () => setTimeout(connect, 3000); // Reconnexion auto
    };

    connect();
    return () => wsRef.current?.close();
  }, [onUpdate]);
}