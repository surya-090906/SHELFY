'use client';

import React, { useState } from 'react';
import { SignIn } from '@clerk/nextjs';
import { Company } from '@/lib/types';
import CustomForgotPassword from './CustomForgotPassword';
import { KeyRound, Shield } from 'lucide-react';

interface BrandedLoginFormProps {
  company: Company;
}

export default function BrandedLoginForm({ company }: BrandedLoginFormProps) {
  const [showForgotPw, setShowForgotPw] = useState(false);

  if (showForgotPw) {
    return (
      <CustomForgotPassword
        companyCode={company.short_code}
        companyName={company.name}
        onBackToLogin={() => setShowForgotPw(false)}
      />
    );
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {/* Clerk SignIn Component Styled with Modern Dark Palette */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
        <SignIn
          routing="hash"
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'bg-transparent shadow-none border-none p-0',
              headerTitle: 'text-white text-lg font-bold',
              headerSubtitle: 'text-slate-400 text-xs',
              formButtonPrimary:
                'bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white font-medium text-sm rounded-xl py-2.5 transition-all shadow-lg shadow-cyan-600/20',
              formFieldInput:
                'bg-slate-950 border-slate-700/80 text-white text-sm rounded-xl px-3.5 py-2.5 focus:border-cyan-500 focus:ring-cyan-500/50',
              formFieldLabel: 'text-slate-300 text-xs font-medium',
              footerActionLink: 'text-cyan-400 hover:text-cyan-300 font-medium',
              dividerLine: 'bg-slate-800',
              dividerText: 'text-slate-500 text-xs',
            },
          }}
          fallbackRedirectUrl={`/dashboard?company=${company.short_code}`}
          signUpUrl={`/sign-up?company=${company.short_code}`}
        />

        {/* Custom SMTP OTP Password Reset Trigger */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 text-center">
          <button
            type="button"
            onClick={() => setShowForgotPw(true)}
            className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Forgot Password? Reset via Custom SMTP OTP</span>
          </button>
        </div>
      </div>
    </div>
  );
}
