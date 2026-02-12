import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

const apiClient = axios.create({ baseURL: API_BASE_URL });

export const marketApi = {
  // THE ONE AND ONLY (Main App)
  getSnapshot: (ticker, period) => apiClient.get(`/api/snapshot/${ticker}?period=${period}`),
  
  // ROUTES SATELLITES
  getCompanyInfo: (ticker) => apiClient.get(`/api/company/${ticker}`),

  // --- WATCHLISTS (Sidebar / Favoris) ---
  // On ne parle plus de portfolio ici, ce sont des listes de surveillance
  getSidebarData: () => apiClient.get('/api/watchlists/sidebar'),
  createWatchlist: (name) => apiClient.post('/api/watchlists', { name }),
  deleteWatchlist: (id) => apiClient.delete(`/api/watchlists/${id}`),
  addTickerToWatchlist: (pid, ticker) => apiClient.post(`/api/watchlists/${pid}/items`, { ticker }),
  removeTickerFromWatchlist: (pid, ticker) => apiClient.delete(`/api/watchlists/${pid}/items/${ticker}`),

  // --- REAL TRADING PORTFOLIO (Epic 1 & 2) ---
  // Ces routes gèrent le vrai argent et les positions
  getPortfolioSummary: () => apiClient.get('/api/portfolio/summary'),
  getOpenPositions: () => apiClient.get('/api/portfolio/positions'),
  getHistory: () => apiClient.get('/api/portfolio/history'),
  placeOrder: (order) => apiClient.post('/api/portfolio/order', order), // { ticker, action, quantity }
  manageCash: (req) => apiClient.post('/api/portfolio/cash', req), // { amount, type }
  nukePortfolio: () => apiClient.post('/api/portfolio/nuke'), // Reset Compte Trading

  // Admin / Debug
  nukeDatabase: () => apiClient.delete('/api/database'),

  // Smart Indicators
  calculateSmartSMA: (t, ta, l) => apiClient.post('/api/indicators/smart/sma', { ticker: t, target_up_percent: ta, lookback_days: l }),
  calculateSmartEMA: (t, ta, l) => apiClient.post('/api/indicators/smart/ema', { ticker: t, target_up_percent: ta, lookback_days: l }),
  calculateSmartEnvelope: (t, ta, l) => apiClient.post('/api/indicators/smart/envelope', { ticker: t, target_inside_percent: ta, lookback_days: l }),
  calculateSmartBollinger: (t, ta, l) => apiClient.post('/api/indicators/smart/bollinger', { ticker: t, target_inside_percent: ta, lookback_days: l }),
};