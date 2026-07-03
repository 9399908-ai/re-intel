import React, { useState } from 'react';
import { API_URL } from '../config';

const ROLES = [
  { value: 'owner', label: 'Owner / Operator' },
  { value: 'broker', label: 'Broker' },
  { value: 'investor', label: 'Investor' },
  { value: 'vendor', label: 'Vendor / Service Provider' },
];
const MARKETS = ['NYC', 'NJ', 'Boston', 'Chicago', 'Miami', 'LA'];
const ASSET_TYPES = ['multifamily', 'office', 'industrial', 'retail', 'hospitality'];

const inputCls =
  'w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue focus:ring-opacity-50';

function Chip({ label, selected, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
        selected
          ? 'bg-blue text-white border-blue'
          : 'bg-white text-gray-600 border-gray-300 hover:border-blue'
      }`}
    >
      {label}
    </button>
  );
}

function AuthView({ onAuthed }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'pending'
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    title: '',
    company: '',
    role: 'owner',
    markets: [],
    assetTypes: [],
  });

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const toggle = (field, value) =>
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(value)
        ? f[field].filter((v) => v !== value)
        : [...f[field], value],
    }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        const res = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email, password: form.password }),
        });
        const body = await res.json().catch(() => ({}));
        if (res.status === 403 && body.error === 'pending') {
          setMode('pending');
          return;
        }
        if (!res.ok) throw new Error(body.error || 'Login failed');
        onAuthed({ token: body.token, user: body.user });
      } else {
        const res = await fetch(`${API_URL}/api/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Signup failed');
        setMode('pending');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy to-blue flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <h1 className="font-bold text-3xl text-navy">Re-Intel.ai</h1>
          <p className="text-sm text-gray-600 mt-1">
            Vetted community for real estate professionals
          </p>
        </div>

        {mode === 'pending' ? (
          <div className="text-center space-y-4">
            <div className="text-5xl">⏳</div>
            <h2 className="font-bold text-lg text-navy">Application received</h2>
            <p className="text-sm text-gray-600">
              Your membership is pending admin approval. You'll be able to sign in once
              you've been verified — check back soon.
            </p>
            <button
              onClick={() => setMode('login')}
              className="text-sm text-blue font-semibold hover:underline"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {mode === 'signup' && (
              <>
                <input required placeholder="Full name" value={form.name} onChange={set('name')} className={inputCls} />
                <div className="flex gap-2">
                  <input placeholder="Title (e.g. Principal)" value={form.title} onChange={set('title')} className={inputCls} />
                  <input placeholder="Company" value={form.company} onChange={set('company')} className={inputCls} />
                </div>
                <input required type="tel" placeholder="Phone" value={form.phone} onChange={set('phone')} className={inputCls} />
              </>
            )}
            <input required type="email" placeholder="Email" value={form.email} onChange={set('email')} className={inputCls} />
            <input
              required
              type="password"
              placeholder={mode === 'signup' ? 'Password (8+ characters)' : 'Password'}
              minLength={mode === 'signup' ? 8 : undefined}
              value={form.password}
              onChange={set('password')}
              className={inputCls}
            />

            {mode === 'signup' && (
              <>
                <select value={form.role} onChange={set('role')} className={inputCls}>
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1.5">Your markets</p>
                  <div className="flex flex-wrap gap-1.5">
                    {MARKETS.map((m) => (
                      <Chip key={m} label={m} selected={form.markets.includes(m)} onToggle={() => toggle('markets', m)} />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1.5">Asset classes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ASSET_TYPES.map((a) => (
                      <Chip key={a} label={a} selected={form.assetTypes.includes(a)} onToggle={() => toggle('assetTypes', a)} />
                    ))}
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 bg-blue text-white font-semibold rounded-lg hover:bg-darkblue transition-colors disabled:bg-gray-300"
            >
              {busy ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Apply for Membership'}
            </button>

            <p className="text-center text-xs text-gray-600 pt-2">
              {mode === 'login' ? (
                <>
                  Not a member yet?{' '}
                  <button type="button" onClick={() => { setMode('signup'); setError(null); }} className="text-blue font-semibold hover:underline">
                    Apply to join
                  </button>
                </>
              ) : (
                <>
                  Already a member?{' '}
                  <button type="button" onClick={() => { setMode('login'); setError(null); }} className="text-blue font-semibold hover:underline">
                    Sign in
                  </button>
                </>
              )}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default AuthView;
