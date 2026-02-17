/* frontend/src/hooks/useIndicatorManager.js */
import { useState, useEffect, useCallback, useRef } from 'react';
import { marketApi } from '../api/client';

export function useIndicatorManager(ticker, activePeriod) { 
  // Liste des indicateurs (mélange Config + Data calculée)
  const [indicators, setIndicators] = useState([]);
  
  // État de chargement global (pour la liste initiale)
  const [isLoading, setIsLoading] = useState(false);

  // Ref pour éviter les boucles infinies si activePeriod change trop vite
  const loadedPeriodRef = useRef(null);

  // --- 1. CHARGEMENT (Initial & Refresh) ---
  const loadIndicators = useCallback(async () => {
    if (!ticker) return;
    setIsLoading(true);

    try {
      // A. Récupération de la liste des configurations (rapide)
      const res = await marketApi.getSavedIndicators(ticker);
      const savedConfigs = res.data;

      // On initialise l'état avec les configs (sans data lourde pour l'instant)
      const initialState = savedConfigs.map(ind => ({
        ...ind,
        // FIX COLOR: On remonte la couleur du style backend vers la racine
        color: ind.style?.color || ind.color || '#00f3ff',
        visible: true,    // État visuel local
        data: null,       // Placeholder pour les données
        isFetching: true  // Loader individuel
      }));
      
      setIndicators(initialState);
      setIsLoading(false); // On rend la main à l'UI immédiatement

      // B. Lancement des calculs en parallèle (Shadow Compute)
      savedConfigs.forEach(async (ind) => {
        try {
          // Appel au Moteur Python pour ce spécifique ID avec le CONTEXTE ACTUEL
          // Si l'indicateur est en mode 'data' (Chart), il a besoin du activePeriod pour être juste.
          const dataRes = await marketApi.calculateIndicatorData(ticker, ind.id, activePeriod);
          
          // Mise à jour ciblée de l'indicateur une fois les données reçues
          setIndicators(prev => prev.map(p => {
             if (p.id === ind.id) {
               return { ...p, data: dataRes.data, isFetching: false };
             }
             return p;
          }));
        } catch (e) {
          console.error(`[SBC] Error computing indicator ${ind.id}`, e);
          setIndicators(prev => prev.map(p => p.id === ind.id ? { ...p, isFetching: false, error: true } : p));
        }
      });

    } catch (err) {
      console.error("[SBC] Failed to load indicators list", err);
      setIsLoading(false);
    }
  }, [ticker, activePeriod]); // Dépendance activePeriod ajoutée

  // Recharger quand le ticker change OU la période change
  useEffect(() => {
    // Petit debounce pour éviter de spammer si l'utilisateur change de TF rapidement
    const t = setTimeout(() => {
        setIndicators([]); // Reset visuel immédiat
        loadIndicators();
    }, 100);
    return () => clearTimeout(t);
  }, [loadIndicators]);

  // --- 2. ACTIONS CRUD ---

  const addIndicator = useCallback(async (newIndConfig) => {
    // --- CORRECTION RBI CRITIQUE : DÉTERMINATION DE LA RÉSOLUTION ---
    // Si la résolution n'est pas fournie explicitement (cas legacy ou Editor), 
    // on tente de la déduire du contexte actuel (activePeriod).
    let finalRes = newIndConfig.resolution;
    
    if (!finalRes || finalRes === 'chart') {
        // Fallback intelligent basé sur la vue actuelle
        if (newIndConfig.granularity === 'data' && activePeriod) {
             if (activePeriod === '1d') finalRes = '1m';
             else if (activePeriod === '5d') finalRes = '5m'; // ou 15m
             else if (activePeriod === '1mo') finalRes = '1h';
             else if (['3mo', '6mo', 'ytd', '1y', '2y', '5y', 'max'].includes(activePeriod)) finalRes = '1d';
             else finalRes = '1d';
        } else {
             finalRes = '1d'; // Macro par défaut
        }
    }

    // 1. On prépare le payload propre pour le backend avec la résolution corrigée
    const payload = {
      ticker,
      type: newIndConfig.type,
      params: newIndConfig.params,
      style: { 
          color: newIndConfig.color, 
          lineWidth: newIndConfig.lineWidth || 2,
          lineStyle: newIndConfig.lineStyle || 0,
          type: newIndConfig.style?.type || 'LINE' 
      }, 
      granularity: newIndConfig.granularity || 'days',
      resolution: finalRes, // <--- LE CHAMP QUI MANQUAIT !
      period: activePeriod, // On sauvegarde le contexte de création pour info
      name: newIndConfig.name
    };

    try {
      // 2. Sauvegarde de la Config (DB)
      const saveRes = await marketApi.saveIndicator(payload);
      const savedInd = saveRes.data;

      // FIX COLOR: On force la couleur locale pour l'affichage optimiste
      const colorToUse = savedInd.style?.color || newIndConfig.color || '#00f3ff';

      // 3. Ajout Optimiste à la liste (avec loader)
      const tempIndState = { 
        ...savedInd, 
        color: colorToUse,
        visible: true, 
        data: null, 
        isFetching: true 
      };
      setIndicators(prev => [...prev, tempIndState]);

      // 4. Demande de Calcul immédiat (Compute) AVEC CONTEXTE
      const dataRes = await marketApi.calculateIndicatorData(ticker, savedInd.id, activePeriod);
      
      // 5. Injection des données reçues
      setIndicators(prev => prev.map(i => 
        i.id === savedInd.id ? { ...i, data: dataRes.data, isFetching: false } : i
      ));

    } catch (e) {
      console.error("[SBC] Add indicator failed", e);
    }
  }, [ticker, activePeriod]);

  const removeIndicator = useCallback(async (id) => {
    // 1. Suppression Optimiste (UI instantanée)
    const previousState = [...indicators];
    setIndicators(prev => prev.filter(i => i.id !== id));

    try {
      // 2. Appel Backend
      await marketApi.deleteIndicator(id);
    } catch (e) {
      console.error("[SBC] Delete failed", e);
      setIndicators(previousState); // Rollback si échec serveur
      alert("Impossible de supprimer l'indicateur (Erreur Serveur)");
    }
  }, [indicators]);

  const toggleVisibility = useCallback((id) => {
    // Action purement locale (pas besoin de persist pour l'instant)
    setIndicators(prev => prev.map(i => 
      i.id === id ? { ...i, visible: !i.visible } : i
    ));
  }, []);

  const updateIndicator = useCallback(async (updatedInd) => {
    // SBC Strategy: Immutable Update.
    if (!updatedInd.id) return;

    try {
       // 1. Supprimer l'ancien
       await marketApi.deleteIndicator(updatedInd.id);
       
       // 2. Nettoyer l'état local
       setIndicators(prev => prev.filter(i => i.id !== updatedInd.id));

       // 3. Recréer comme nouveau (cela déclenchera save + compute avec la bonne logique addIndicator)
       await addIndicator(updatedInd); 

    } catch (e) {
      console.error("[SBC] Update failed", e);
    }
  }, [addIndicator]);

  const nukeIndicators = useCallback(() => {
     setIndicators([]);
  }, []);

  return {
    indicators,       // La liste complète avec Data + Meta
    isLoading,        // Chargement initial de la liste
    addIndicator,
    removeIndicator,
    toggleVisibility,
    updateIndicator,
    nukeIndicators,
    refreshIndicators: loadIndicators
  };
}