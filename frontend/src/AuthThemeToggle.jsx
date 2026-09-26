import React, {useEffect, useState} from 'react';
import {Sun, Moon, Globe} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {languages} from './preferences';

export default function AuthThemeToggle() {
  const {t,i18n}=useTranslation();
  const [theme,setTheme]=useState(()=>localStorage.getItem('shelfy_auth_theme')==='dark'?'dark':'light');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    document.documentElement.dataset.theme=theme;
    localStorage.setItem('shelfy_auth_theme',theme);
  },[theme]);
  async function changeLanguage(language){
    setBusy(true);setError('');
    try{
      await i18n.changeLanguage(language);
      let preferences={};try{preferences=JSON.parse(localStorage.getItem('shelfy_preferences')||'{}');}catch{}
      localStorage.setItem('shelfy_preferences',JSON.stringify({...preferences,language}));
      document.documentElement.lang=language;
    }catch{setError('Unable to save preferences');}finally{setBusy(false);}
  }
  return <div className="ss-auth-theme" role="group" aria-label={t('Settings')}>
    <label className="ss-quick-language"><Globe size={17}/><select aria-label={t('Language')} value={i18n.resolvedLanguage||'en'} disabled={busy} onChange={event=>changeLanguage(event.target.value)}>{languages.map(([value,label])=><option key={value} value={value} lang={value}>{label}</option>)}</select></label>
    <button className="ss-icon" type="button" aria-label={t('Toggle theme')} title={t('Toggle theme')} aria-pressed={theme==='dark'} onClick={()=>setTheme(value=>value==='dark'?'light':'dark')}>{theme==='dark'?<Moon size={18}/>:<Sun size={18}/>}</button>
    {error&&<span className="ss-red" role="alert">{t(error)}</span>}
  </div>;
}
