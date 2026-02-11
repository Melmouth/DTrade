import { 
  calculateSMA, calculateEMA, calculateWMA, calculateHMA, 
  calculateVWMA, calculateDEMA, calculateTEMA, calculateZLEMA, 
  calculateKAMA, calculateMcGinley 
} from '../../utils/calculations';

export const SMA = {
  id: 'SMA',
  name: 'Simple Moving Average',
  type: 'OVERLAY',
  tags: ['Trend', 'Lagging'],
  params: {
    period: { type: 'number', label: 'Période (N)', default: 20, min: 2, max: 500 }
  },
  calculate: (data, daily, p, gran) => calculateSMA(data, daily, p.period, gran),
  getStyles: (c) => ({ type: 'Line', color: c || '#2962FF', lineWidth: 2 })
};

export const EMA = {
  id: 'EMA',
  name: 'Exponential Moving Average',
  type: 'OVERLAY',
  tags: ['Trend', 'Reactive'],
  params: {
    period: { type: 'number', label: 'Période (N)', default: 20, min: 2, max: 500 }
  },
  calculate: (data, daily, p, gran) => calculateEMA(data, daily, p.period, gran),
  getStyles: (c) => ({ type: 'Line', color: c || '#FF6D00', lineWidth: 2 })
};

export const WMA = {
  id: 'WMA',
  name: 'Weighted Moving Average',
  type: 'OVERLAY',
  tags: ['Trend', 'Weighted'],
  params: {
    period: { type: 'number', label: 'Période (N)', default: 20, min: 2, max: 200 }
  },
  calculate: (data, daily, p, gran) => calculateWMA(data, daily, p.period, gran),
  getStyles: (c) => ({ type: 'Line', color: c || '#00B8D4', lineWidth: 2 })
};

export const HMA = {
  id: 'HMA',
  name: 'Hull Moving Average',
  type: 'OVERLAY',
  tags: ['Trend', 'Fast'],
  params: {
    period: { type: 'number', label: 'Période (N)', default: 20, min: 2, max: 200 }
  },
  calculate: (data, daily, p, gran) => calculateHMA(data, daily, p.period, gran),
  getStyles: (c) => ({ type: 'Line', color: c || '#AA00FF', lineWidth: 2 })
};

export const VWMA = {
  id: 'VWMA',
  name: 'Volume Weighted MA',
  type: 'OVERLAY',
  tags: ['Trend', 'Volume'],
  params: {
    period: { type: 'number', label: 'Période (N)', default: 20, min: 2, max: 200 }
  },
  calculate: (data, daily, p, gran) => calculateVWMA(data, daily, p.period, gran),
  getStyles: (c) => ({ type: 'Line', color: c || '#304FFE', lineWidth: 2 })
};

export const DEMA = {
  id: 'DEMA',
  name: 'Double EMA',
  type: 'OVERLAY',
  tags: ['Trend', 'Fast'],
  params: {
    period: { type: 'number', label: 'Période (N)', default: 20, min: 2, max: 200 }
  },
  calculate: (data, daily, p, gran) => calculateDEMA(data, daily, p.period, gran),
  getStyles: (c) => ({ type: 'Line', color: c || '#C51162', lineWidth: 2 })
};

export const TEMA = {
  id: 'TEMA',
  name: 'Triple EMA',
  type: 'OVERLAY',
  tags: ['Trend', 'Very Fast'],
  params: {
    period: { type: 'number', label: 'Période (N)', default: 20, min: 2, max: 200 }
  },
  calculate: (data, daily, p, gran) => calculateTEMA(data, daily, p.period, gran),
  getStyles: (c) => ({ type: 'Line', color: c || '#D50000', lineWidth: 2 })
};

export const ZLEMA = {
  id: 'ZLEMA',
  name: 'Zero Lag EMA',
  type: 'OVERLAY',
  tags: ['Trend', 'Zero Lag'],
  params: {
    period: { type: 'number', label: 'Période (N)', default: 20, min: 2, max: 200 }
  },
  calculate: (data, daily, p, gran) => calculateZLEMA(data, daily, p.period, gran),
  getStyles: (c) => ({ type: 'Line', color: c || '#00C853', lineWidth: 2 })
};

export const KAMA = {
  id: 'KAMA',
  name: 'Kaufman Adaptive MA',
  type: 'OVERLAY',
  tags: ['Trend', 'Adaptive'],
  params: {
    period: { type: 'number', label: 'Période Efficacité', default: 10, min: 2, max: 100 }
  },
  calculate: (data, daily, p, gran) => calculateKAMA(data, daily, p.period, gran),
  getStyles: (c) => ({ type: 'Line', color: c || '#FFD600', lineWidth: 2 })
};

export const MCG = {
  id: 'MCG',
  name: 'McGinley Dynamic',
  type: 'OVERLAY',
  tags: ['Trend', 'Dynamic'],
  params: {
    period: { type: 'number', label: 'Constante K', default: 14, min: 2, max: 100 }
  },
  calculate: (data, daily, p, gran) => calculateMcGinley(data, daily, p.period, gran),
  getStyles: (c) => ({ type: 'Line', color: c || '#6200EA', lineWidth: 2 })
};