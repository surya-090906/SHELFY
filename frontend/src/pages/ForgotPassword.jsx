import React, { useState } from 'react';
import api from '../api/client';
import { Box, Mail, ArrowRight, ArrowLeft, KeyRound } from 'lucide-react';

export default function ForgotPassword({ onNavigate, setResetEmail }) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [devOtp, setDevOtp] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await api.post('/auth/forgot-password', { email });
      setMessage(res.data.message || 'OTP sent successfully!');
      if (res.data.devOtpPreview) {
        setDevOtp(res.data.devOtpPreview);
      }
      if (setResetEmail) {
        setResetEmail(email);
      }
      setTimeout(() => {
        onNavigate('reset-password');
      }, 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 relative overflow-hidden">
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-cyan-400 items-center justify-center shadow-xl shadow-brand-500/25 mb-4">
            <KeyRound className="w-7 h-7 text-white stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Forgot Password</h1>
          <p className="text-sm text-slate-400 mt-2">
            Enter your email to receive a 6-digit OTP code
          </p>
        </div>

        <div className="glass-panel p-8 rounded-3xl border border-slate-800 shadow-2xl">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {message && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 text-xs">
              {message}
              {devOtp && (
                <div className="mt-2 font-mono font-bold text-amber-300 bg-slate-900 p-2 rounded">
                  Development OTP: {devOtp}
                </div>
              )}
              <div className="mt-2 text-slate-300 font-medium">Redirecting to Reset Screen...</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Registered Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="manager@stocksense.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-600 text-white font-semibold text-sm shadow-lg shadow-brand-500/25 flex items-center justify-center space-x-2 transition disabled:opacity-50"
            >
              <span>{isLoading ? 'Sending OTP...' : 'Send OTP Code'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="flex items-center space-x-1.5 text-slate-400 hover:text-white transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Login</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('reset-password')}
              className="text-brand-400 font-semibold hover:text-brand-300 transition"
            >
              Already have code?
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
