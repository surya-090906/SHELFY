import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, ChevronRight } from 'lucide-react';
import api from './api/client';
import { useAuthStore } from './store/useAuthStore';
import { applyPreferences } from './preferences';
import AuthThemeToggle from './AuthThemeToggle';
export function OtpInput({value, onChange}) {
  const {t}=useTranslation(), inputs=useRef([]);
  const enter=(index,text)=>{
    const digits=text.replace(/\D/g,'').slice(0,6);
    if(digits.length>1){onChange(digits);inputs.current[Math.min(digits.length,5)]?.focus();return;}
    const next=value.padEnd(6,' ').split('');next[index]=digits||' ';
    onChange(next.join('').trimEnd());
    if(digits&&index<5)inputs.current[index+1]?.focus();
  };
  return <fieldset className="ss-field"><legend>{t('One-time code')}</legend><div className="ss-otp">{Array.from({length:6},(_,index)=><input key={index} ref={el=>inputs.current[index]=el} aria-label={t('One-time code')+' '+(index+1)} inputMode="numeric" autoComplete={index===0?'one-time-code':'off'} required pattern="[0-9]" maxLength={6} value={value[index]?.trim()||''} onChange={event=>enter(index,event.target.value)} onPaste={event=>{event.preventDefault();enter(index,event.clipboardData.getData('text'));}} onKeyDown={event=>{if(event.key==='Backspace'&&!value[index]?.trim()&&index>0)inputs.current[index-1]?.focus();if(event.key==='ArrowLeft'&&index>0)inputs.current[index-1]?.focus();if(event.key==='ArrowRight'&&index<5)inputs.current[index+1]?.focus();}} />)}</div></fieldset>;
}
export default function ShelfyAuth() {
  const {
      t,
      i18n
    } = useTranslation(),
    initialInvite = new URLSearchParams(location.search).get('invite');
  const [mode, setMode] = useState(initialInvite ? 'join' : 'login'),
    [form, setForm] = useState({
      company_code: '',
      invite_code: initialInvite || ''
    }),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const switchMode = m => {
    setMode(m);
    setError('');
    setNotice('');
  };
  const field = (key, label, type = 'text', props = {}) => <label className="ss-field"><span>{t(label)}</span><input required type={type} value={form[key] || ''} onChange={e => setForm(f => ({
      ...f,
      [key]: e.target.value
    }))} {...props} /></label>;
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const endpoint = {
        login: 'login',
        create: 'signup',
        join: 'signup',
        forgot: 'forgot-password',
        reset: 'reset-password'
      }[mode];
      const body = {
        ...form
      };
      if (mode === 'create') delete body.invite_code;
      if (mode === 'join') {
        delete body.company_name;
        delete body.company_code;
      }
      const {
        data
      } = await api.post('/auth/' + endpoint, body);
      if (mode === 'forgot') {
        setMode('reset');
        setNotice(t('If an account exists, a code has been sent. It expires in 5 minutes.'));
      } else if (mode === 'reset') {
        setMode('login');
        setNotice(t('Password reset. Sign in with your new password.'));
      } else {
        localStorage.setItem('stocksense_access_token', data.accessToken);
        localStorage.setItem('stocksense_user', JSON.stringify(data.user));
        applyPreferences(data.user);
        await i18n.changeLanguage(data.user.language);
        useAuthStore.setState({
          user: data.user,
          isAuthenticated: true,
          accessToken: data.accessToken
        });
        history.replaceState(null, '', location.pathname + '#dashboard');
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      }
    } catch (e) {
      setError(t(e.response?.data?.message || 'Unable to reach the server'));
    } finally {
      setBusy(false);
    }
  }
  return <div className="ss-auth"><AuthThemeToggle /><aside><div className="ss-logo"><Package />Shelfy<span>IMS</span></div><div><span className="ss-eyebrow">{t('EVERY ITEM. EVERY MOVEMENT.')}</span><h1>{t('Your inventory, in view.')}</h1><p>{t('Bring your warehouses, products and daily operations together in one place.')}</p><div className="ss-auth-art"><Package size={76} /><div><strong>{t('Stock in sync.')}</strong><span>{t('One company. One clear workspace.')}</span></div></div></div><small>{t('Built for the people who keep things moving.')}</small></aside><main><form onSubmit={submit}><span className="ss-eyebrow">{t('WELCOME TO SHELFY')}</span><h1>{t({
            login: 'Welcome back',
            create: 'Create your company',
            join: 'Join your company',
            forgot: 'Forgot your password?',
            reset: 'Set a new password'
          }[mode])}</h1><p>{t(mode === 'login' ? 'Sign in to your inventory workspace.' : mode === 'join' ? 'Your company and role are assigned by your invitation.' : 'Enter your details below to continue.')}</p>{error && <div role="alert" className="ss-error">{error}</div>}{notice && <div role="status" className="ss-notice">{notice}</div>}
 {mode === 'create' && field('company_name', 'Company name')}{mode !== 'join' && field('company_code', 'Company code', 'text', {
          autoComplete: 'organization',
          ...(mode === 'create' && {
            pattern: '[A-Za-z0-9_-]{2,12}',
            maxLength: 12
          })
        })}{mode === 'join' && field('invite_code', 'Invitation code')}
 {['login', 'create', 'join'].includes(mode) && field('login_id', 'Login Id', 'text', {
          autoComplete: 'username',
          ...(['create', 'join'].includes(mode) && {
            minLength: 6,
            maxLength: 12,
            pattern: '[A-Za-z0-9_]{6,12}'
          })
        })}
 {['create', 'join', 'forgot', 'reset'].includes(mode) && field('email', 'Email Id', 'email', {
          autoComplete: 'email'
        })}
 {['create', 'join'].includes(mode) && field('name', 'Name')}
 {['login', 'create', 'join'].includes(mode) && field('password', 'Password', 'password', {
          autoComplete: mode === 'login' ? 'current-password' : 'new-password',
          ...(mode !== 'login' && {
            minLength: 8
          })
        })}
 {['create', 'join', 'reset'].includes(mode) && <>{mode === 'reset' && <><OtpInput value={form.otp || ''} onChange={otp => setForm(f => ({...f, otp}))} />{field('newPassword', 'New Password', 'password', {
              minLength: 8,
              autoComplete: 'new-password'
            })}</>}{field('confirm_password', 'Re-Enter Password', 'password', {
            autoComplete: 'new-password',
            minLength: 8
          })}<small>{t('6–12 character Login Id. Password: 8+ characters with uppercase, lowercase and a special character.')}</small></>}
 <button className="ss-primary ss-full" disabled={busy}>{t(busy ? 'Please wait…' : {
            login: 'SIGN IN',
            create: 'CREATE COMPANY',
            join: 'JOIN COMPANY',
            forgot: 'SEND CODE',
            reset: 'RESET PASSWORD'
          }[mode])}<ChevronRight size={17} /></button>
 <div className="ss-auth-links">{mode === 'login' ? <><button type="button" onClick={() => switchMode('forgot')}>{t('Forgot your password?')}</button><button type="button" onClick={() => switchMode('create')}>{t('Create a company')}</button><button type="button" onClick={() => switchMode('join')}>{t('Join with invitation')}</button></> : <button type="button" onClick={() => switchMode('login')}>{t('Back to Sign In')}</button>}</div>
 {mode === 'login' && <div className="ss-demo"><strong>{t('Explore the demo')}</strong><span>{t('Company codes')}: SHELFY / NOVA</span><span>{t('manager')}: manager / Manager@123</span><span>{t('staff')}: staff01 / Staff@123</span></div>}</form></main></div>;
}
