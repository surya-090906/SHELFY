import React from 'react';
import {Package} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import AuthThemeToggle from './AuthThemeToggle';
export default function AuthLayout({children}){
 const {t}=useTranslation();
 return <div className="ss-auth"><AuthThemeToggle/><aside><div className="ss-logo"><Package/>Shelfy<span>IMS</span></div><div><span className="ss-eyebrow">{t('EVERY ITEM. EVERY MOVEMENT.')}</span><h1>{t('Your inventory, in view.')}</h1><p>{t('Bring your warehouses, products and daily operations together in one place.')}</p><div className="ss-auth-art"><Package size={76}/><div><strong>{t('Stock in sync.')}</strong><span>{t('One company. One clear workspace.')}</span></div></div></div><small>{t('Built for the people who keep things moving.')}</small></aside><main>{children}</main></div>;
}
