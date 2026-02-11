import { calculateSuperTrend, calculatePSAR, calculateChandelier } from '../../utils/math';

export const SUPERT = {
  id: 'SUPERT',
  name: 'SuperTrend',
  type: 'OVERLAY',
  tags: ['Trend', 'Stop'],
  params: {
    period: { type: 'number', label: 'Période ATR', default: 10 },
    factor: { type: 'number', label: 'Facteur', default: 3.0, step: 0.1 }
  },
  calculate: (data, daily, p, gran) => calculateSuperTrend(data, daily, p.factor, p.period, gran),
  getStyles: (c) => ({ type: 'Line', color: c || '#D500F9', lineWidth: 2, lineStyle: 0 }) 
};

export const PSAR = {
  id: 'PSAR',
  name: 'Parabolic SAR',
  type: 'OVERLAY',
  tags: ['Trend', 'Reversal'],
  params: {
    step: { type: 'number', label: 'Step (Accélération)', default: 0.02, min: 0.001, max: 0.5, step: 0.001 }
  },
  calculate: (data, daily, p, gran) => calculatePSAR(data, daily, p.step, gran),
  // Style: On triche avec lineWidth 0 + markers pour simuler des points
  getStyles: (c) => ({ type: 'Line', color: c || '#FFFFFF', lineWidth: 0, crosshairMarkerVisible: true, pointMarkers: true }) 
};

export const CHAND = {
  id: 'CHAND',
  name: 'Chandelier Exit',
  type: 'OVERLAY',
  tags: ['Stop', 'Volatility'],
  params: {
    period: { type: 'number', label: 'Période', default: 22 },
    multiplier: { type: 'number', label: 'Multiplier (ATR)', default: 3.0, step: 0.1 }
  },
  calculate: (data, daily, p, gran) => calculateChandelier(data, daily, p.multiplier, p.period, gran),
  getStyles: (c) => ({ type: 'Line', color: c || '#FF1744', lineWidth: 2, lineStyle: 2 }) // Dashed
};