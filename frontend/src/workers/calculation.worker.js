/* frontend/src/workers/calculation.worker.js */
import { calculateIndicator } from '../indicators/registry';

// --- MÉMOIRE CACHE (Worker Scope) ---
// Ces variables restent en vie tant que le worker est actif
let cachedChartData = null;
let cachedDailyData = null;

self.onmessage = (e) => {
  const { type, payload, id } = e.data;

  try {
    // CAS 1 : MISE À JOUR DES DONNÉES (Lourd, mais rare)
    if (type === 'UPDATE_DATA') {
      cachedChartData = payload.chartData;
      cachedDailyData = payload.dailyData;
      // Pas de réponse nécessaire ou simple ack
      return;
    }

    // CAS 2 : CALCUL RAPIDE (Fréquent - Slider)
    if (type === 'CALCULATE') {
      if (!cachedChartData) {
        throw new Error("Worker: No data loaded yet");
      }

      // Le calcul utilise les données en cache
      const result = calculateIndicator(payload.config, cachedChartData, cachedDailyData);
      
      self.postMessage({ id, success: true, data: result });
    }

  } catch (error) {
    self.postMessage({ id, success: false, error: error.message });
  }
};