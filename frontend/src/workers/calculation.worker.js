/* frontend/src/workers/calculation.worker.js */
import { calculateIndicator } from '../indicators/registry';

let cachedChartData = null;
let cachedDailyData = null;

self.onmessage = (e) => {
  const { type, payload, id } = e.data;

  try {
    if (type === 'UPDATE_DATA') {
      cachedChartData = payload.chartData;
      cachedDailyData = payload.dailyData;
      return;
    }

    if (type === 'CALCULATE') {
      if (!cachedChartData) throw new Error("Worker: No data loaded");

      // 1. CALCUL COMPLET
      const fullResult = calculateIndicator(payload.config, cachedChartData, cachedDailyData);
      
      // 2. SMART SLICING
      let finalResult = fullResult;
      
      // CORRECTION ICI : On accepte 0 explicitement comme "Pas de limite"
      // Si payload.limit est 0, on met Infinity. Sinon on prend la valeur ou 1000 par défaut.
      const limit = (payload.limit === 0) ? Infinity : (payload.limit || 1000);

      if (limit !== Infinity) {
          if (Array.isArray(fullResult) && fullResult.length > limit) {
              finalResult = fullResult.slice(-limit);
          } 
          else if (fullResult && !Array.isArray(fullResult) && fullResult.upper) {
              finalResult = {
                  basis: fullResult.basis?.slice(-limit),
                  upper: fullResult.upper?.slice(-limit),
                  lower: fullResult.lower?.slice(-limit)
              };
          }
      }

      self.postMessage({ id, success: true, data: finalResult });
    }

  } catch (error) {
    self.postMessage({ id, success: false, error: error.message });
  }
};