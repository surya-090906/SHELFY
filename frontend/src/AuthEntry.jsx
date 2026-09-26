import React from 'react';
import {useTranslation} from 'react-i18next';
import {clerkEnabled,clerkPublishableKey} from './authConfig';
import LocalAuth from './ShelfyAuth';
import ClerkEmailAuth from './ClerkEmailAuth';
import AuthLayout from './AuthLayout';
export default function AuthEntry(){
 const {t}=useTranslation();
 if(!clerkEnabled)return <LocalAuth/>;
 if(!clerkPublishableKey)return <AuthLayout><section className="ss-auth-setup"><span className="ss-eyebrow">{t('WELCOME TO SHELFY')}</span><h1>{t('Welcome back')}</h1><p role="status">{t('Email sign-in is being configured. Please contact your administrator.')}</p></section></AuthLayout>;
 return <ClerkEmailAuth/>;
}
