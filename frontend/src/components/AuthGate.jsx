import { useEffect, useState } from 'react';
import { authApi, cancelPrivateRequests } from '../api/client';
import { usePortfolioStore } from '../hooks/usePortfolioStore';

function clearPrivateState() {
  cancelPrivateRequests();
  usePortfolioStore.setState(usePortfolioStore.getInitialState(), true);
}

export default function AuthGate({ children }) {
  const [status, setStatus] = useState('loading');
  const [accessKey, setAccessKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    authApi.session().then(() => { if (mounted) setStatus('authenticated'); })
      .catch(() => { if (mounted) setStatus('anonymous'); });
    const expired = () => { clearPrivateState(); setStatus('anonymous'); setError('Session expirée. Reconnecte-toi.'); };
    window.addEventListener('dtrade:session-expired', expired);
    return () => { mounted = false; window.removeEventListener('dtrade:session-expired', expired); };
  }, []);

  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const key = accessKey;
    setAccessKey('');
    try {
      await authApi.login(key);
      setStatus('authenticated');
    } catch (failure) {
      setError(failure.response?.status === 429 ? 'Trop de tentatives. Réessaie dans une minute.' : 'Connexion impossible. Vérifie ta clé et le serveur.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await authApi.logout();
      clearPrivateState();
      setStatus('anonymous');
      setError('');
    } catch {
      setError('Déconnexion impossible. Réessaie pour fermer la session.');
    } finally {
      setBusy(false);
    }
  }

  if (status === 'authenticated') return <>
    {children}
    <div className="fixed bottom-3 right-3 z-[110] flex items-center gap-2">
      {error && <span role="alert" className="bg-black text-red-400 text-xs p-2">{error}</span>}
      <button onClick={logout} disabled={busy} className="rounded border border-slate-600 bg-black px-3 py-2 text-xs text-slate-300">Déconnexion</button>
    </div>
  </>;

  return <main className="min-h-screen flex items-center justify-center bg-black text-slate-200 font-mono px-4">
    <form onSubmit={login} className="w-full max-w-sm space-y-5 border border-slate-700 rounded p-6">
      <h1 className="text-xl text-white">DEIMOS — Accès privé</h1>
      {status === 'loading' ? <p>Vérification de la session…</p> : <>
        <label className="block">Clé d’accès
          <input type="password" autoComplete="current-password" value={accessKey} onChange={event => setAccessKey(event.target.value)} minLength={32} maxLength={256} required className="mt-2 w-full rounded bg-slate-900 p-3 border border-slate-600" />
        </label>
        <button type="submit" disabled={busy} className="w-full rounded bg-slate-200 text-black p-3 disabled:opacity-50">{busy ? 'Connexion…' : 'Se connecter'}</button>
      </>}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    </form>
  </main>;
}
