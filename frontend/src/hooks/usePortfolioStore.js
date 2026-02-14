import { create } from 'zustand';
import { marketApi } from '../api/client';

export const usePortfolioStore = create((set, get) => ({
  // --- STATE ---
  cash: 0,
  investedCapital: 0, // <--- NOUVEAU : On stocke le capital réel investi
  positions: [],
  history: [],
  equity: 0,
  pnl_total: 0,
  pnl_pct: 0,
  loading: false,
  lastUpdated: null,

  // --- ACTIONS ---

  // 1. Chargement initial (API Call)
  fetchPortfolio: async () => {
    set({ loading: true });
    try {
      // On charge tout en parallèle pour la rapidité
      const [summaryRes, positionsRes, historyRes] = await Promise.all([
        marketApi.getPortfolioSummary(),
        marketApi.getOpenPositions(),
        marketApi.getHistory()
      ]);

      set({
        cash: summaryRes.data.cash_balance,
        equity: summaryRes.data.equity_value,
        pnl_total: summaryRes.data.total_pnl,
        pnl_pct: summaryRes.data.pnl_pct,
        investedCapital: summaryRes.data.invested_capital || 0, // <--- NOUVEAU : Sauvegarde du capital investi reçu du backend
        positions: positionsRes.data,
        history: historyRes.data,
        loading: false,
        lastUpdated: Date.now()
      });
    } catch (err) {
      console.error("Portfolio Fetch Error", err);
      set({ loading: false });
    }
  },

  // 2. Synchronisation Temps Réel (Appelé par App.jsx via useGlobalStream)
  // C'est ici que la magie opère : On recalcule l'Equity sans toucher au Backend
  syncLivePrices: (priceMap) => {
    // On récupère aussi investedCapital
    const { cash, positions, investedCapital } = get(); 
    if (!positions.length) return;

    let totalPositionValue = 0;
    let needsUpdate = false;

    // On parcourt les positions pour mettre à jour leur valeur avec le prix live
    const updatedPositions = positions.map(pos => {
      const liveData = priceMap[pos.ticker];
      
      // Si on a un prix plus récent que celui stocké
      if (liveData && liveData.price !== pos.current_price) {
        needsUpdate = true;
        const currentPrice = liveData.price;
        const marketValue = pos.quantity * currentPrice;
        const pnl = (currentPrice - pos.avg_price) * pos.quantity;
        
        // Sécurité division par zéro pour le pct individuel
        const costBasis = pos.quantity * pos.avg_price;
        const pnlPct = costBasis > 0 ? (pnl / costBasis) : 0;

        // Mise à jour de l'objet position (pour l'affichage tableau)
        totalPositionValue += marketValue;
        return { 
          ...pos, 
          current_price: currentPrice, 
          market_value: marketValue,
          pnl_unrealized: pnl,
          pnl_pct: pnlPct
        };
      }
      
      // Sinon on garde la vieille valeur pour le total
      totalPositionValue += (pos.market_value || (pos.quantity * pos.avg_price));
      return pos;
    });

    if (needsUpdate) {
        const totalEquity = cash + totalPositionValue;
        
        // CORRECTION : Calcul dynamique basé sur le capital investi réel
        // Si investedCapital est 0 (ex: bug ou pas de dépôt), on met 1 pour éviter div/0
        const baseCapital = investedCapital > 0 ? investedCapital : 1; 
        
        set({
            positions: updatedPositions,
            equity: totalEquity,
            pnl_total: totalEquity - investedCapital, // Calcul dynamique
            pnl_pct: (totalEquity - investedCapital) / baseCapital // Calcul dynamique
        });
    }
  },

  // 3. Actions Utilisateur
  executeOrder: async (order) => {
    await marketApi.placeOrder(order);
    await get().fetchPortfolio(); // Rechargement complet après ordre pour être sûr
  },

  manageCash: async (req) => {
    await marketApi.manageCash(req);
    await get().fetchPortfolio();
  },

  nuke: async () => {
    await marketApi.nukePortfolio();
    await get().fetchPortfolio();
  }
}));