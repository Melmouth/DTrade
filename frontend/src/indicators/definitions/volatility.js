import { calculateBollinger, calculateEnvelope } from '../../utils/math';

export const BB = {
  id: 'BB',
  name: 'Bollinger Bands',
  type: 'BAND', // Type spécial qui retourne { upper, lower, basis }
  tags: ['Volatility', 'Channel'],

  params: {
    period: { type: 'number', label: 'Période', default: 20 },
    stdDev: { type: 'number', label: 'Multiplicateur (σ)', default: 2.0, min: 0.1, max: 5.0, step: 0.1 }
  },

  // Mapping des params vers ta fonction math existante
  calculate: (chartData, dailyData, params, granularity) => {
    // Note: Ta fonction math attend (data, daily, factor, period, gran)
    // Ici on map params.stdDev vers factor
    return calculateBollinger(chartData, dailyData, params.stdDev, params.period, granularity);
  },

  getStyles: (userColor) => ({
    type: 'Band', // Indique au Chart qu'il faut dessiner 3 lignes + zone
    color: userColor || '#00f3ff',
    areaColor: userColor ? `${userColor}10` : '#00f3ff10' // Opacité 10% hex
  })
};

export const ENV = {
  id: 'ENV',
  name: 'Envelope Channel',
  type: 'BAND',
  tags: ['Volatility', 'Percentage'],

  params: {
    period: { type: 'number', label: 'Période', default: 20 },
    deviation: { type: 'number', label: 'Écart (%)', default: 5.0, min: 0.1, max: 20.0, step: 0.1 }
  },

  calculate: (chartData, dailyData, params, granularity) => {
    return calculateEnvelope(chartData, dailyData, params.deviation, params.period, granularity);
  },

  getStyles: (userColor) => ({
    type: 'Band',
    color: userColor || '#eab308'
  })
};