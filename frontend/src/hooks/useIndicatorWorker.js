/* frontend/src/hooks/useIndicatorWorker.js */
import { useEffect, useRef, useCallback } from 'react';

export function useIndicatorWorker() {
  const workerRef = useRef(null);
  const lastRequestId = useRef(0);
  
  // Refs pour suivre les versions des données envoyées au worker
  // Cela permet d'éviter de renvoyer le gros payload si la ref n'a pas changé
  const lastSentChartData = useRef(null);
  const lastSentDailyData = useRef(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/calculation.worker.js', import.meta.url), {
      type: 'module',
    });

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const compute = useCallback((config, chartData, dailyData) => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) return;

      // 1. VÉRIFICATION ET SYNCHRONISATION DES DONNÉES
      // Si les données ont changé (référence différente), on met à jour le cache du worker
      if (chartData !== lastSentChartData.current || dailyData !== lastSentDailyData.current) {
        workerRef.current.postMessage({
          type: 'UPDATE_DATA',
          payload: { chartData, dailyData }
        });
        
        lastSentChartData.current = chartData;
        lastSentDailyData.current = dailyData;
      }

      // 2. DEMANDE DE CALCUL (LÉGÈRE)
      // On envoie seulement la config et l'ID
      const requestId = ++lastRequestId.current;

      const handleMessage = (e) => {
        const { id, success, data, error } = e.data;

        if (id !== requestId) return;
        
        // Optimisation anti-flicker : on ignore les résultats périmés
        if (id !== lastRequestId.current) return;

        workerRef.current.removeEventListener('message', handleMessage);

        if (success) resolve(data);
        else reject(error);
      };

      workerRef.current.addEventListener('message', handleMessage);

      workerRef.current.postMessage({
        type: 'CALCULATE',
        id: requestId,
        payload: {
            config: JSON.parse(JSON.stringify(config)) // Clone léger des params
        }
      });
    });
  }, []);

  return { compute };
}