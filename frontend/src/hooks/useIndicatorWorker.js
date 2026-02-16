/* frontend/src/hooks/useIndicatorWorker.js */
import { useEffect, useRef, useCallback } from 'react';

export function useIndicatorWorker() {
  const workerRef = useRef(null);
  const lastRequestId = useRef(0);
  
  // Refs pour le cache des données (évite le re-upload inutile)
  const lastSentChartData = useRef(null);
  const lastSentDailyData = useRef(null);

  useEffect(() => {
    // Initialisation du Worker
    workerRef.current = new Worker(new URL('../workers/calculation.worker.js', import.meta.url), {
      type: 'module',
    });

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  /**
   * Fonction de calcul.
   * @param {Object} config - Configuration de l'indicateur (id, params...)
   * @param {Array} chartData - Données du graphique (Intraday)
   * @param {Array} dailyData - Données journalières (Macro)
   * @param {boolean} isPreview - Si TRUE, on demande une coupe des données pour fluidifier l'UI
   */
  const compute = useCallback((config, chartData, dailyData, isPreview = false) => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) return;

      // 1. SYNC DONNÉES (CACHE)
      // On ne renvoie les grosses données au worker que si elles ont changé (référence mémoire)
      if (chartData !== lastSentChartData.current || dailyData !== lastSentDailyData.current) {
        workerRef.current.postMessage({
          type: 'UPDATE_DATA',
          payload: { chartData, dailyData }
        });
        
        lastSentChartData.current = chartData;
        lastSentDailyData.current = dailyData;
      }

      // 2. PRÉPARATION DE LA REQUÊTE
      const requestId = ++lastRequestId.current;

      const handleMessage = (e) => {
        const { id, success, data, error } = e.data;

        // On ignore les messages qui ne correspondent pas à cette requête
        if (id !== requestId) return;
        
        // ANTI-FLICKER : Si une nouvelle requête a été lancée depuis (ex: slider bougé vite),
        // on ignore ce résultat désormais obsolète.
        if (id !== lastRequestId.current) return;

        workerRef.current.removeEventListener('message', handleMessage);

        if (success) resolve(data);
        else reject(error);
      };

      workerRef.current.addEventListener('message', handleMessage);

      // 3. ENVOI DE LA DEMANDE
      workerRef.current.postMessage({
        type: 'CALCULATE',
        id: requestId,
        payload: {
            config: JSON.parse(JSON.stringify(config)), // Clone pour détacher les références
            // C'EST ICI QUE L'OPTIMISATION SE JOUE :
            // Si c'est une preview, on demande au worker de couper le tableau de retour (ex: 500 derniers points).
            // Sinon (sauvegarde finale), on demande tout (0 = pas de limite).
            limit: isPreview ? 500 : 0 
        }
      });
    });
  }, []);

  return { compute };
}