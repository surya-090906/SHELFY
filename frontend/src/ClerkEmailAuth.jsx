import React,{useState} from 'react';
import {useClerk,useSignIn,useSignUp} from '@clerk/react';
import {useTranslation} from 'react-i18next';
import {ChevronRight} from 'lucide-react';
import AuthLayout from './AuthLayout';
import {OtpInput} from './ShelfyAuth';
import api from './api/client';
import {applyPreferences} from './preferences';
import {useAuthStore} from './store/useAuthStore';

const raise=result=>{if(result?.error)throw result.error;};
export default function ClerkEmailAuth(){
 const {t,i18n}=useTranslation(),clerk=useClerk(),{signIn}=useSignIn(),{signUp}=useSignUp();
 const initialInvite=new URLSearchParams(location.search).get('invite')||'';
 const [intent,setIntent]=useState(initialInvite?'join':'login');
 const [form,setForm]=useState({email:'',company_code:'',company_name:'',name:'',login_id:'',invite_code:initialInvite});
 const [verifying,setVerifying]=useState(false),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const signedEmail=clerk.user?.primaryEmailAddress?.emailAddress;
 const field=(key,label,props={})=><label className="ss-field"><span>{t(label)}</span><input required name={key} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} {...props}/></label>;
 async function exchange(session){
  if(!session||session.currentTask)throw new Error('Email sign-in needs additional account setup. Contact your administrator.');
  const token=await session.getToken();
  if(!token)throw new Error('Email verification required');
  const {data}=await api.post('/auth/clerk/session',{...form,intent,email:undefined},{headers:{Authorization:`Bearer ${token}`}});
  localStorage.setItem('stocksense_access_token',data.accessToken);
  localStorage.setItem('stocksense_user',JSON.stringify(data.user));
  applyPreferences(data.user);await i18n.changeLanguage(data.user.language);
  useAuthStore.setState({user:data.user,isAuthenticated:true,accessToken:data.accessToken});
  history.replaceState(null,'',location.pathname+'#dashboard');window.dispatchEvent(new HashChangeEvent('hashchange'));
 }
 async function finalize(resource){
  if(resource.status!=='complete')throw new Error('Email sign-in needs additional account setup. Contact your administrator.');
  raise(await resource.finalize({navigate:async({session})=>exchange(session)}));
 }
 async function perform(fn){
  setBusy(true);setError('');setNotice('');
  try{await fn();}catch(e){setError(e.response?.data?.message||e.errors?.[0]?.longMessage||e.errors?.[0]?.message||e.message||'Unable to reach the server');}finally{setBusy(false);}
 }
 async function submit(event){
  event.preventDefault();
  await perform(async()=>{
   if(clerk.session){await exchange(clerk.session);return;}
   if(!verifying){
    raise(await signIn.create({identifier:form.email.trim(),signUpIfMissing:true}));
    raise(await signIn.emailCode.sendCode());setVerifying(true);return;
   }
   const result=await signIn.emailCode.verifyCode({code});
   if(result.error?.errors?.some(e=>e.code==='sign_up_if_missing_transfer')){
    raise(await signUp.create({transfer:true}));await finalize(signUp);
   }else{raise(result);await finalize(signIn);}
  });
 }
 const changeIntent=next=>{setIntent(next);setError('');setNotice('');setVerifying(false);setCode('');};
 return <AuthLayout><form onSubmit={submit}><span className="ss-eyebrow">{t('WELCOME TO SHELFY')}</span><h1>{t(verifying?'Verify your email':intent==='create'?'Create your company':intent==='join'?'Join your company':'Welcome back')}</h1><p>{t('Sign in securely with a code sent to your email.')}</p>
  {error&&<div className="ss-error" role="alert">{t(error)}</div>}{notice&&<div className="ss-notice" role="status">{t(notice)}</div>}
  {verifying&&!clerk.session?<><p>{form.email}</p><OtpInput value={code} onChange={setCode}/></>:<>
   {intent==='create'&&field('company_name','Company name')}
   {intent==='join'?field('invite_code','Invitation code'):field('company_code','Company code',{autoComplete:'organization',...(intent==='create'&&{pattern:'[A-Za-z0-9_-]{2,12}',maxLength:12})})}
   {signedEmail?<div className="ss-notice">{t('Verified email')}: {signedEmail}</div>:field('email','Email Id',{type:'email',autoComplete:'email'})}
   {intent!=='login'&&<>{field('name','Name',{autoComplete:'name'})}{field('login_id','Login Id',{pattern:'[A-Za-z0-9_]{6,12}',minLength:6,maxLength:12,autoComplete:'username'})}</>}
  </>}
  <button className="ss-primary ss-full" disabled={busy||(!clerk.session&&!signIn)||verifying&&!clerk.session&&!/^\d{6}$/.test(code)}>{t(busy?'Please wait…':clerk.session?'Continue':verifying?'Verify email':'SEND CODE')}<ChevronRight size={17}/></button>
  {verifying&&!clerk.session&&<div className="ss-auth-links"><button type="button" disabled={busy} onClick={()=>perform(async()=>{raise(await signIn.emailCode.sendCode());setNotice('A new verification code has been sent.');})}>{t('Resend code')}</button><button type="button" disabled={busy} onClick={()=>{setVerifying(false);setCode('');setError('');}}>{t('Change email')}</button></div>}
  <div className="ss-auth-links">{intent!=='login'&&<button type="button" disabled={busy} onClick={()=>changeIntent('login')}>{t('Back to Sign In')}</button>}{intent!=='create'&&<button type="button" disabled={busy} onClick={()=>changeIntent('create')}>{t('Create a company')}</button>}{intent!=='join'&&<button type="button" disabled={busy} onClick={()=>changeIntent('join')}>{t('Join with invitation')}</button>}{clerk.session&&<button type="button" disabled={busy} onClick={()=>perform(async()=>{await clerk.signOut();setVerifying(false);setCode('');})}>{t('Use another email')}</button>}</div>
  <div id="clerk-captcha"/>
 </form></AuthLayout>;
}
