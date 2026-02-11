import { useState } from 'react';
import { X, Trash2, AlertTriangle, Save, Server } from 'lucide-react';
import { marketApi } from '../api/client';

export default function SettingsModal({ isOpen, onClose, settings, onSave, onNuke }) {
  if (!isOpen) return null;

  const [localSettings, setLocalSettings] = useState(settings);
  const [confirmNuke, setConfirmNuke] = useState(false);

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  const handleNuke = async () => {
    try {
      await marketApi.nukeDatabase();
      onNuke();
      setConfirmNuke(false);
    } catch (err) {
      console.error("Nuke failed", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-900">
          <h2 className="text-lg font-semibold text-white">Paramètres Système</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-8">
          
          {/* Section: WebSocket Status (Anciennement Slider) */}
          <div className="space-y-3 opacity-70 pointer-events-none grayscale">
            <div className="flex justify-between">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                 <Server size={14} /> Protocole Streaming
              </label>
              <span className="text-xs font-mono font-bold bg-neon-blue/10 text-neon-blue px-2 py-0.5 rounded border border-neon-blue/20">
                  WEBSOCKET (AUTO)
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-lg overflow-hidden">
                <div className="h-full bg-neon-blue w-full animate-pulse shadow-[0_0_10px_#00f3ff]"></div>
            </div>
            <div className="text-[10px] text-slate-500 italic">
              Le mode 'Real-Time Push' est géré par le serveur. Latence minimale.
            </div>
          </div>

          {/* Section: History */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-300">Historique par défaut</label>
            <select 
              value={localSettings.historyPeriod}
              onChange={(e) => setLocalSettings({...localSettings, historyPeriod: e.target.value})}
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 outline-none"
            >
              <option value="5d">5 Jours</option>
              <option value="1mo">1 Mois</option>
              <option value="3mo">3 Mois</option>
              <option value="6mo">6 Mois</option>
              <option value="1y">1 An</option>
              <option value="ytd">Depuis début année (YTD)</option>
            </select>
          </div>

          {/* Section: Danger Zone */}
          <div className="pt-4 border-t border-slate-800">
            <h3 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-3">Zone de Danger</h3>
            
            {!confirmNuke ? (
              <button 
                onClick={() => setConfirmNuke(true)}
                className="w-full flex items-center justify-center gap-2 p-2 border border-red-900/50 text-red-400 rounded-lg hover:bg-red-900/20 transition text-sm"
              >
                <Trash2 size={16} /> Supprimer Watchlist & Historique (Nuke)
              </button>
            ) : (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 animate-in fade-in zoom-in duration-200">
                <div className="flex gap-2 items-start mb-3">
                  <AlertTriangle className="text-red-500 shrink-0" size={20} />
                  <p className="text-xs text-red-200">
                    Êtes-vous certain ? Cette action est irréversible et effacera toute votre base de données locale.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleNuke}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 rounded transition"
                  >
                    CONFIRMER NUKE
                  </button>
                  <button 
                    onClick={() => setConfirmNuke(false)}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-xs py-2 rounded transition"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end">
          <button 
            onClick={handleSave}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition"
          >
            <Save size={16} /> Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}