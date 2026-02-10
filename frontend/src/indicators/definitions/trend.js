import { calculateSMA, calculateEMA } from '../../utils/math'; // On réutilise ton math.js existant pour l'instant

export const SMA = {
  id: 'SMA',
  name: 'Simple Moving Average',
  type: 'OVERLAY', // S'affiche SUR le prix
  tags: ['Trend', 'Lagging'],
  
  // Configuration pour l'UI (Générateur de formulaire)
  params: {
    period: { 
      type: 'number', 
      label: 'Période (N)', 
      default: 20, 
      min: 2, 
      max: 500, 
      step: 1 
    },
    source: { 
      type: 'select', 
      label: 'Source', 
      options: ['close', 'open', 'high', 'low'], 
      default: 'close' 
    }
  },

  // La logique d'exécution
  calculate: (chartData, dailyData, params, granularity) => {
    // Appel à ta fonction math.js existante
    return calculateSMA(chartData, dailyData, params.period, granularity);
  },

  // Comment dessiner ça sur le graphique (Lightweight Charts config)
  getStyles: (userColor) => ({
    type: 'Line',
    color: userColor || '#2962FF',
    lineWidth: 2,
    crosshairMarkerVisible: true
  })
};

export const EMA = {
  id: 'EMA',
  name: 'Exponential Moving Average',
  type: 'OVERLAY',
  tags: ['Trend', 'Reactive'],
  
  params: {
    period: { type: 'number', label: 'Période (N)', default: 20, min: 2, max: 500 },
  },

  calculate: (chartData, dailyData, params, granularity) => {
    return calculateEMA(chartData, dailyData, params.period, granularity);
  },

  getStyles: (userColor) => ({
    type: 'Line',
    color: userColor || '#FF6D00',
    lineWidth: 2
  })
};