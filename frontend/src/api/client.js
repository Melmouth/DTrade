import axios from 'axios';

const API_BASE_URL = '/';

let privateRequests = new AbortController();
export function cancelPrivateRequests() {
  privateRequests.abort();
  privateRequests = new AbortController();
}

const apiClient = axios.create({ baseURL: API_BASE_URL, timeout: 20000, withCredentials: true });
apiClient.interceptors.request.use(config => {
  if (!config.url?.startsWith('/api/auth/')) config.signal = privateRequests.signal;
  return config;
});
apiClient.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401 && !error.config?.url?.startsWith('/api/auth/')) {
    window.dispatchEvent(new Event('dtrade:session-expired'));
  }
  return Promise.reject(error);
});

export const authApi = {
  session: () => apiClient.get('/api/auth/session'),
  login: accessKey => apiClient.post('/api/auth/login', { access_key: accessKey }),
  logout: () => apiClient.post('/api/auth/logout'),
};

export function socketUrl(path) {
  const url = new URL(path, window.location.origin);
  url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

export const marketApi = {
  getSnapshot: (ticker, period) => apiClient.get(`/api/snapshot/${encodeURIComponent(ticker)}?period=${encodeURIComponent(period)}`),
  getCompanyInfo: (ticker) => apiClient.get(`/api/company/${encodeURIComponent(ticker)}`),
  getSidebarData: () => apiClient.get('/api/watchlists/sidebar'),
  createWatchlist: (name) => apiClient.post('/api/watchlists', { name }),
  deleteWatchlist: (id) => apiClient.delete(`/api/watchlists/${id}`),
  addTickerToWatchlist: (pid, ticker) => apiClient.post(`/api/watchlists/${pid}/items`, { ticker }),
  removeTickerFromWatchlist: (pid, ticker) => apiClient.delete(`/api/watchlists/${pid}/items/${encodeURIComponent(ticker)}`),
  getPortfolioSummary: () => apiClient.get('/api/portfolio/summary'),
  getOpenPositions: () => apiClient.get('/api/portfolio/positions'),
  getHistory: () => apiClient.get('/api/portfolio/history'),
  placeOrder: (order) => apiClient.post('/api/portfolio/order', order),
  manageCash: (req) => apiClient.post('/api/portfolio/cash', req),
  nukePortfolio: () => apiClient.post('/api/portfolio/nuke'),
  getSavedIndicators: (ticker) => apiClient.get(`/api/indicators/${encodeURIComponent(ticker)}`),
  saveIndicator: (indicator) => apiClient.post('/api/indicators/', indicator),
  deleteIndicator: (id) => apiClient.delete(`/api/indicators/${id}`),
  
  // --- ZERO-DISCREPANCY FIX ---
  // On passe contextPeriod (ex: '1d', '1mo') en query param pour que le backend sache quelle densité de données charger
  calculateIndicatorData: (ticker, id, contextPeriod) => apiClient.get(`/api/indicators/${encodeURIComponent(ticker)}/calculate/${id}?context_period=${encodeURIComponent(contextPeriod || '1mo')}`),
  
  calculateSmartSMA: (t, ta, l) => apiClient.post('/api/indicators/smart/sma', { ticker: t, target_up_percent: ta, lookback_days: l }),
  calculateSmartEMA: (t, ta, l) => apiClient.post('/api/indicators/smart/ema', { ticker: t, target_up_percent: ta, lookback_days: l }),
  calculateSmartEnvelope: (t, ta, l) => apiClient.post('/api/indicators/smart/envelope', { ticker: t, target_inside_percent: ta, lookback_days: l }),
  calculateSmartBollinger: (t, ta, l) => apiClient.post('/api/indicators/smart/bollinger', { ticker: t, target_inside_percent: ta, lookback_days: l }),
  nukeDatabase: () => apiClient.delete('/api/database'),
};