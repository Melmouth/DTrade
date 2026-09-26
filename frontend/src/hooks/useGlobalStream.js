import { useEffect, useRef } from 'react';
import { socketUrl } from '../api/client';

export function useGlobalStream(onUpdate) {
  const wsRef = useRef(null);
  useEffect(() => {
    let stopped = false;
    let retry;
    const connect = () => {
      if (stopped) return;
      const ws = new WebSocket(socketUrl('/ws/global'));
      wsRef.current = ws;
      ws.onmessage = event => {
        if (stopped) return;
        try {
          const update = JSON.parse(event.data);
          if (update.type === 'PRICE_UPDATE') onUpdate(update.ticker, update);
        } catch { /* Ignore malformed market updates. */ }
      };
      ws.onclose = event => {
        if (stopped) return;
        if (event.code === 1008) {
          window.dispatchEvent(new Event('dtrade:session-expired'));
          return;
        }
        retry = setTimeout(connect, 5000);
      };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => { stopped = true; clearTimeout(retry); wsRef.current?.close(); };
  }, [onUpdate]);
}
