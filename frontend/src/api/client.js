import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';
const WS_BASE_URL = 'ws://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

export const marketApi = {
  // Calendar / Market Status
  getMarketStatus: (ticker) => apiClient.get(`/api/market-status/${ticker}`),
  // History
  getHistory: (ticker, period = '1mo') => apiClient.get(`/api/history/${ticker}?period=${period}`),
  
  // Sidebar & Portfolios
  getSidebarData: () => apiClient.get('/api/sidebar'),
  createPortfolio: (name) => apiClient.post('/api/portfolios', { name }),
  deletePortfolio: (id) => apiClient.delete(`/api/portfolios/${id}`),
  
  // Portfolio Items
  addTickerToPortfolio: (portfolioId, ticker) => apiClient.post(`/api/portfolios/${portfolioId}/items`, { ticker }),
  removeTickerFromPortfolio: (portfolioId, ticker) => apiClient.delete(`/api/portfolios/${portfolioId}/items/${ticker}`),
  
  // Company Info
  getCompanyInfo: (ticker) => apiClient.get(`/api/company/${ticker}`),

  // Indicators
  calculateSmartSMA: (ticker, targetUp, lookbackDays) => 
    apiClient.post('/api/indicators/smart/sma', { 
      ticker, 
      target_up_percent: targetUp, 
      lookback_days: lookbackDays 
    }),
  
  calculateSmartEMA: (ticker, targetUp, lookbackDays) => 
    apiClient.post('/api/indicators/smart/ema', { ticker, target_up_percent: targetUp, lookback_days: lookbackDays }),

  calculateSmartEnvelope: (ticker, targetInside, lookbackDays) => 
    apiClient.post('/api/indicators/smart/envelope', { ticker, target_inside_percent: targetInside, lookback_days: lookbackDays }),

  calculateSmartBollinger: (ticker, targetInside, lookbackDays) => 
    apiClient.post('/api/indicators/smart/bollinger', { ticker, target_inside_percent: targetInside, lookback_days: lookbackDays }),

  // Admin
  nukeDatabase: () => apiClient.delete('/api/database'),

  // WebSocket
  createLiveConnection: (ticker, interval, onMessage) => {
    const ws = new WebSocket(`${WS_BASE_URL}/ws/trading/${ticker}?interval=${interval}`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };
    return ws;
  }
};

