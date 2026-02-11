import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

const apiClient = axios.create({ baseURL: API_BASE_URL });

export const marketApi = {
  // THE ONE AND ONLY (Main App)
  getSnapshot: (ticker, period) => apiClient.get(`/api/snapshot/${ticker}?period=${period}`),
  
  // ROUTES SATELLITES (Rétablies pour Sidebar & Modales)
  getMarketStatus: (ticker) => apiClient.get(`/api/status/${ticker}`),
  getCompanyInfo: (ticker) => apiClient.get(`/api/company/${ticker}`),

  // Portfolio & Admin
  getSidebarData: () => apiClient.get('/api/sidebar'),
  createPortfolio: (name) => apiClient.post('/api/portfolios', { name }),
  deletePortfolio: (id) => apiClient.delete(`/api/portfolios/${id}`),
  addTickerToPortfolio: (pid, ticker) => apiClient.post(`/api/portfolios/${pid}/items`, { ticker }),
  removeTickerFromPortfolio: (pid, ticker) => apiClient.delete(`/api/portfolios/${pid}/items/${ticker}`),
  nukeDatabase: () => apiClient.delete('/api/database'),

  // Smart Indicators
  calculateSmartSMA: (t, ta, l) => apiClient.post('/api/indicators/smart/sma', { ticker: t, target_up_percent: ta, lookback_days: l }),
  calculateSmartEMA: (t, ta, l) => apiClient.post('/api/indicators/smart/ema', { ticker: t, target_up_percent: ta, lookback_days: l }),
  calculateSmartEnvelope: (t, ta, l) => apiClient.post('/api/indicators/smart/envelope', { ticker: t, target_inside_percent: ta, lookback_days: l }),
  calculateSmartBollinger: (t, ta, l) => apiClient.post('/api/indicators/smart/bollinger', { ticker: t, target_inside_percent: ta, lookback_days: l }),
};