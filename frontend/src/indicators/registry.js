import { SMA, EMA } from './definitions/trend';
import { BB, ENV } from './definitions/volatility';

// 1. La Map principale (pour accès rapide O(1))
const INDICATORS = {
  SMA,
  EMA,
  BB,
  ENV
};

// 2. Liste pour les menus (Triée par catégorie ou alphabétique)
export const getAvailableIndicators = () => {
  return Object.values(INDICATORS).map(ind => ({
    id: ind.id,
    name: ind.name,
    type: ind.type,
    tags: ind.tags
  }));
};

// 3. Récupérer la config par défaut d'un indicateur
export const getIndicatorConfig = (id) => {
  const ind = INDICATORS[id];
  if (!ind) throw new Error(`Indicator ${id} not found in registry`);
  
  // On extrait les valeurs par défaut des params defined
  const defaultParams = {};
  Object.entries(ind.params).forEach(([key, config]) => {
    defaultParams[key] = config.default;
  });

  return {
    id: ind.id,
    type: ind.type,
    name: ind.name, // Nom de base
    color: '#00f3ff', // Couleur par défaut système
    params: defaultParams,
    visible: true,
    granularity: 'days' // Défaut global
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
      config.params, // On passe l'objet params complet (ex: { period: 20, stdDev: 2 })
      config.granularity
    );
  } catch (e) {
    console.error(`Calculation error for ${config.id}:`, e);
    return null;
  }
};

// 5. Récupérer le style de rendu
export const getIndicatorStyle = (id, color) => {
    const definition = INDICATORS[id];
    return definition ? definition.getStyles(color) : {};
};

export default INDICATORS;