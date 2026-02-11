import { 
  calculateBollinger, calculateEnvelope, calculateKeltner, 
  calculateDonchian, calculateReg, calculateSTARC 
} from '../../utils/math';

export const BB = {
  id: 'BB',
  name: 'Bollinger Bands',
  type: 'BAND',
  tags: ['Volatility', 'StdDev'],
  params: {
    period: { type: 'number', label: 'Période', default: 20 },
    stdDev: { type: 'number', label: 'Deviation (σ)', default: 2.0, step: 0.1 }
  },
  calculate: (data, daily, p, gran) => calculateBollinger(data, daily, p.stdDev, p.period, gran),
  getStyles: (c) => ({ type: 'Band', color: c || '#00B0FF', areaColor: c ? `${c}15` : '#00B0FF15' })
};

export const ENV = {
  id: 'ENV',
  name: 'Envelope Channel',
  type: 'BAND',
  tags: ['Volatility', 'Fixed'],
  params: {
    period: { type: 'number', label: 'Période', default: 20 },
    deviation: { type: 'number', label: 'Écart (%)', default: 5.0, step: 0.5 }
  },
  calculate: (data, daily, p, gran) => calculateEnvelope(data, daily, p.deviation, p.period, gran),
  getStyles: (c) => ({ type: 'Band', color: c || '#FFAB00', areaColor: c ? `${c}15` : '#FFAB0015' })
};

export const KELT = {
  id: 'KELT',
  name: 'Keltner Channels',
  type: 'BAND',
  tags: ['Volatility', 'ATR'],
  params: {
    period: { type: 'number', label: 'Période EMA', default: 20 },
    multiplier: { type: 'number', label: 'Multiplier (ATR)', default: 1.5, step: 0.1 }
  },
  calculate: (data, daily, p, gran) => calculateKeltner(data, daily, p.multiplier, p.period, gran),
  getStyles: (c) => ({ type: 'Band', color: c || '#76FF03', areaColor: c ? `${c}15` : '#76FF0315' })
};

export const DONCH = {
  id: 'DONCH',
  name: 'Donchian Channels',
  type: 'BAND',
  tags: ['Volatility', 'Extremes'],
  params: {
    period: { type: 'number', label: 'Période', default: 20 }
  },
  calculate: (data, daily, p, gran) => calculateDonchian(data, daily, p.period, gran),
  getStyles: (c) => ({ type: 'Band', color: c || '#F50057', areaColor: c ? `${c}15` : '#F5005715' })
};

export const REG = {
  id: 'REG',
  name: 'Linear Reg. Channel',
  type: 'BAND',
  tags: ['Volatility', 'Statistics'],
  params: {
    period: { type: 'number', label: 'Période', default: 20 },
    deviation: { type: 'number', label: 'Deviation (σ)', default: 2.0, step: 0.1 }
  },
  calculate: (data, daily, p, gran) => calculateReg(data, daily, p.deviation, p.period, gran),
  getStyles: (c) => ({ type: 'Band', color: c || '#651FFF', areaColor: c ? `${c}15` : '#651FFF15' })
};

export const STARC = {
  id: 'STARC',
  name: 'STARC Bands',
  type: 'BAND',
  tags: ['Volatility', 'ATR'],
  params: {
    period: { type: 'number', label: 'Période SMA', default: 15 },
    multiplier: { type: 'number', label: 'Multiplier (ATR)', default: 2.0, step: 0.1 }
  },
  calculate: (data, daily, p, gran) => calculateSTARC(data, daily, p.multiplier, p.period, gran),
  getStyles: (c) => ({ type: 'Band', color: c || '#FF3D00', areaColor: c ? `${c}15` : '#FF3D0015' })
};