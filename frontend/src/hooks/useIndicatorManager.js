import { useState, useEffect, useCallback } from 'react';
import { marketApi } from '../api/client';

export function useIndicatorManager(ticker) {
  // Liste des indicateurs (mélange Config + Data calculée)
  const [indicators, setIndicators] = useState([]);
  
  // État de chargement global (pour la liste initiale)
  const [isLoading, setIsLoading] = useState(false);

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
        visible: true,    // État visuel local
        data: null,       // Placeholder pour les données
        isFetching: true  // Loader individuel
      }));
      
      setIndicators(initialState);
      setIsLoading(false); // On rend la main à l'UI immédiatement

      // B. Lancement des calculs en parallèle (Shadow Compute)
      savedConfigs.forEach(async (ind) => {
        try {
          // Appel au Moteur Python pour ce spécifique ID
          const dataRes = await marketApi.calculateIndicatorData(ticker, ind.id);
          
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
  }, [ticker]);

  // Recharger quand le ticker change
  useEffect(() => {
    setIndicators([]); // Reset visuel immédiat
    loadIndicators();
  }, [loadIndicators]);

  // --- 2. ACTIONS CRUD ---

  const addIndicator = useCallback(async (newIndConfig) => {
    // Note: newIndConfig contient params, style, type, granularity... venant de l'éditeur
    
    // 1. On prépare le payload propre pour le backend
    const payload = {
      ticker,
      type: newIndConfig.type,
      params: newIndConfig.params,
      style: { 
          color: newIndConfig.color, 
          lineWidth: newIndConfig.lineWidth || 2,
          lineStyle: newIndConfig.lineStyle || 0 
      }, 
      granularity: newIndConfig.granularity || 'days',
      name: newIndConfig.name
    };

    try {
      // 2. Sauvegarde de la Config (DB)
      const saveRes = await marketApi.saveIndicator(payload);
      const savedInd = saveRes.data;

      // 3. Ajout Optimiste à la liste (avec loader)
      const tempIndState = { ...savedInd, visible: true, data: null, isFetching: true };
      setIndicators(prev => [...prev, tempIndState]);

      // 4. Demande de Calcul immédiat (Compute)
      const dataRes = await marketApi.calculateIndicatorData(ticker, savedInd.id);
      
      // 5. Injection des données reçues
      setIndicators(prev => prev.map(i => 
        i.id === savedInd.id ? { ...i, data: dataRes.data, isFetching: false } : i
      ));

    } catch (e) {
      console.error("[SBC] Add indicator failed", e);
      // Rollback en cas d'erreur (optionnel, ici on laisse l'erreur visible console)
    }
  }, [ticker]);

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
    // Comme le backend stocke l'historique de config, le plus simple pour "Modifier"
    // est de supprimer l'ancien et recréer le nouveau. Cela garantit un recalc propre.
    
    if (!updatedInd.id) return;

    try {
       // 1. Supprimer l'ancien
       await marketApi.deleteIndicator(updatedInd.id);
       
       // 2. Nettoyer l'état local
       setIndicators(prev => prev.filter(i => i.id !== updatedInd.id));

       // 3. Recréer comme nouveau (cela déclenchera save + compute)
       await addIndicator(updatedInd); 

    } catch (e) {
      console.error("[SBC] Update failed", e);
    }
  }, [addIndicator]);

  const nukeIndicators = useCallback(() => {
     // Reset local uniquement (le Nuke DB est géré par SettingsModal)
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