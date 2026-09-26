'use client';

import React, { useState } from 'react';
import { Mail, KeyRound, Lock, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { requestOtp, verifyOtp } from '@/actions/otpActions';

interface CustomForgotPasswordProps {
  companyCode: string;
  companyName: string;
  onBackToLogin: () => void;
}

export default function CustomForgotPassword({
  companyCode,
  companyName,
  onBackToLogin,
}: CustomForgotPasswordProps) {
  const [step, setStep] = useState<'request' | 'verify' | 'success'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [devOtpPreview, setDevOtpPreview] = useState<string | null>(null);

  // Handle Step 1: Request OTP via SMTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      const res = await requestOtp(email, 'password_reset', companyCode);
      if (res.success) {
        setNotice(res.message);
        if (res.devCodePreview) setDevOtpPreview(res.devCodePreview);
        setStep('verify');
      } else {
        setError(res.message);
      }
    } catch {
      setError('An unexpected error occurred while sending the verification email.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Step 2: Verify OTP & Change Password
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (code.length !== 6) {
      setError('Please enter a valid 6-digit code.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await verifyOtp(email, code, 'password_reset', newPassword);
      if (res.success) {
        setStep('success');
      } else {
        setError(res.message);
      }
    } catch {
      setError('Failed to verify OTP and reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <button
          type="button"
          onClick={onBackToLogin}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Reset Password</h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">{companyName} &bull; SMTP Verification</p>
        </div>
      </div>

      {/* Error / Notice Banners */}
      {error && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="mb-5 p-3.5 rounded-xl bg-cyan-950/60 border border-cyan-800/80 text-cyan-200 text-xs flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      {/* Dev OTP Preview */}
      {devOtpPreview && (
        <div className="mb-4 p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs font-mono text-center">
          Development OTP: <strong className="text-amber-200 tracking-wider font-bold">{devOtpPreview}</strong>
        </div>
      )}

      {/* STEP 1: Request OTP */}
      {step === 'request' && (
        <form onSubmit={handleRequestOtp} className="space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            Enter your account email. We will send a single-use 6-digit verification code via SMTP to verify your identity.
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Account Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Sending Code…</span>
              </>
            ) : (
              <>
                <span>Send Verification Code</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}

      {/* STEP 2: Verify OTP & New Password */}
      {step === 'verify' && (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-300">
                6-Digit Verification Code
              </label>
              <button
                type="button"
                onClick={handleRequestOtp}
                disabled={loading}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Resend code
              </button>
            </div>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white tracking-widest font-mono placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              New Password (min 8 characters)
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 6 || newPassword.length < 8}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Verifying &amp; Resetting…</span>
              </>
            ) : (
              <>
                <span>Set New Password</span>
                <CheckCircle2 className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}

      {/* STEP 3: Success Screen */}
      {step === 'success' && (
        <div className="text-center space-y-4 py-4">
          <div className="w-12 h-12 rounded-full bg-emerald-950/80 border border-emerald-700 flex items-center justify-center text-emerald-400 mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Password Updated!</h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Your credentials have been securely updated. You can now sign in with your new password.
          </p>
          <button
            type="button"
            onClick={onBackToLogin}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 text-white font-medium text-sm shadow-lg shadow-cyan-600/20"
          >
            Back to Sign In
          </button>
        </div>
      )}
    </div>
  );
}
