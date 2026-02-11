// Import des définitions par module
import * as Trend from './definitions/trend';
import * as Volatility from './definitions/volatility';
import * as Stops from './definitions/stops';

// 1. Aggrégation dans une Map principale
// On spread les exports de chaque fichier
const INDICATORS = {
  ...Trend,
  ...Volatility,
  ...Stops
};

// 2. Liste pour les menus (Triée)
export const getAvailableIndicators = () => {
  return Object.values(INDICATORS).map(ind => ({
    id: ind.id,
    name: ind.name,
    type: ind.type,
    tags: ind.tags
  }));
};

// 3. Récupérer la config par défaut
export const getIndicatorConfig = (id) => {
  const ind = INDICATORS[id];
  if (!ind) throw new Error(`Indicator ${id} not found in registry`);
  
  const defaultParams = {};
  if (ind.params) {
    Object.entries(ind.params).forEach(([key, config]) => {
      defaultParams[key] = config.default;
    });
  }

  return {
    id: ind.id,
    type: ind.type,
    name: ind.name,
    color: '#00f3ff', // Couleur par défaut système, sera surchargée par le menu
    params: defaultParams,
    visible: true,
    granularity: 'days'
  };
};

// 4. Moteur de calcul générique
export const calculateIndicator = (config, chartData, dailyData) => {
  const definition = INDICATORS[config.id];
  if (!definition) return null;

  try {
    return definition.calculate(
      chartData, 
      dailyData, 
      config.params, 
      config.granularity
    );
  } catch (e) {
    console.error(`Calculation error for ${config.id}:`, e);
    return null;
  }
};

// 5. Styles
export const getIndicatorStyle = (id, color) => {
    const definition = INDICATORS[id];
    return definition ? definition.getStyles(color) : {};
};

export default INDICATORS;