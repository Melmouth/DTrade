import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

const apiClient = axios.create({ baseURL: API_BASE_URL });

// --- SONDE D'INTERCEPTION (DEBUG MODE) ---

// 1. Sortie (Request)
apiClient.interceptors.request.use(request => {
    console.group(`🚀 TX: ${request.method?.toUpperCase()} ${request.url}`);
    console.log('Headers:', request.headers);
    if (request.data) {
        console.log('Payload (Ce qui part au backend):', JSON.parse(JSON.stringify(request.data)));
    }
    if (request.params) {
        console.log('Params:', request.params);
    }
    console.groupEnd();
    return request;
}, error => {
    console.error('❌ TX Error:', error);
    return Promise.reject(error);
});

// 2. Entrée (Response)
apiClient.interceptors.response.use(response => {
    console.group(`✅ RX: ${response.config.method?.toUpperCase()} ${response.config.url}`);
    console.log('Status:', response.status);
    console.log('Data (Ce qui revient du backend):', response.data);
    
    // Vérification Spécifique pour votre problème d'indicateurs
    if (response.config.url?.includes('/calculate/') && Array.isArray(response.data)) {
        console.table(response.data.slice(0, 5)); // Affiche les 5 premiers points pour check format
        const sample = response.data[0];
        if (sample && (!sample.time || sample.value === undefined)) {
            console.error("⚠️ ALERTE STRUCTURE: Format de donnée invalide reçue !", sample);
        }
    }
    
    console.groupEnd();
    return response;
}, error => {
    console.group(`🔥 RX ERROR: ${error.config?.url}`);
    if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Detail:', error.response.data);
    } else {
        console.error('Network Error:', error.message);
    }
    console.groupEnd();
    return Promise.reject(error);
});

export const marketApi = {
  // ... (Le reste de vos exports reste identique)
  getSnapshot: (ticker, period) => apiClient.get(`/api/snapshot/${ticker}?period=${period}`),
  getCompanyInfo: (ticker) => apiClient.get(`/api/company/${ticker}`),
  getSidebarData: () => apiClient.get('/api/watchlists/sidebar'),
  createWatchlist: (name) => apiClient.post('/api/watchlists', { name }),
  deleteWatchlist: (id) => apiClient.delete(`/api/watchlists/${id}`),
  addTickerToWatchlist: (pid, ticker) => apiClient.post(`/api/watchlists/${pid}/items`, { ticker }),
  removeTickerFromWatchlist: (pid, ticker) => apiClient.delete(`/api/watchlists/${pid}/items/${ticker}`),
  getPortfolioSummary: () => apiClient.get('/api/portfolio/summary'),
  getOpenPositions: () => apiClient.get('/api/portfolio/positions'),
  getHistory: () => apiClient.get('/api/portfolio/history'),
  placeOrder: (order) => apiClient.post('/api/portfolio/order', order),
  manageCash: (req) => apiClient.post('/api/portfolio/cash', req),
  nukePortfolio: () => apiClient.post('/api/portfolio/nuke'),
  getSavedIndicators: (ticker) => apiClient.get(`/api/indicators/${ticker}`),
  saveIndicator: (indicator) => apiClient.post('/api/indicators/', indicator),
  deleteIndicator: (id) => apiClient.delete(`/api/indicators/${id}`),
  
  // --- ZERO-DISCREPANCY FIX ---
  // On passe contextPeriod (ex: '1d', '1mo') en query param pour que le backend sache quelle densité de données charger
  calculateIndicatorData: (ticker, id, contextPeriod) => apiClient.get(`/api/indicators/${ticker}/calculate/${id}?context_period=${contextPeriod || ''}`),
  
  calculateSmartSMA: (t, ta, l) => apiClient.post('/api/indicators/smart/sma', { ticker: t, target_up_percent: ta, lookback_days: l }),
  calculateSmartEMA: (t, ta, l) => apiClient.post('/api/indicators/smart/ema', { ticker: t, target_up_percent: ta, lookback_days: l }),
  calculateSmartEnvelope: (t, ta, l) => apiClient.post('/api/indicators/smart/envelope', { ticker: t, target_inside_percent: ta, lookback_days: l }),
  calculateSmartBollinger: (t, ta, l) => apiClient.post('/api/indicators/smart/bollinger', { ticker: t, target_inside_percent: ta, lookback_days: l }),
  nukeDatabase: () => apiClient.delete('/api/database'),
};