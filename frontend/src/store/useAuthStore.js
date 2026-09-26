import {create} from 'zustand';
import api from '../api/client';
let cached;try{cached=JSON.parse(localStorage.getItem('stocksense_user')||'null');}catch{cached=null;}
export const useAuthStore=create((set,get)=>({
 user:cached,accessToken:localStorage.getItem('stocksense_access_token'),isAuthenticated:!!localStorage.getItem('stocksense_access_token'),isLoading:false,
 logout:async()=>{
  try{await api.post('/auth/logout');}catch{}
  try{await get().signOutProvider?.();}catch{}
  localStorage.removeItem('stocksense_access_token');localStorage.removeItem('stocksense_user');delete api.defaults.headers.common.Authorization;
  set({user:null,accessToken:null,isAuthenticated:false});
 },
 checkAuth:async()=>{
  if(!localStorage.getItem('stocksense_access_token')){set({user:null,isAuthenticated:false});return;}
  try{const r=await api.get('/auth/me');localStorage.setItem('stocksense_user',JSON.stringify(r.data.user));set({user:r.data.user,isAuthenticated:true,accessToken:localStorage.getItem('stocksense_access_token')});}
  catch{localStorage.removeItem('stocksense_access_token');localStorage.removeItem('stocksense_user');set({user:null,accessToken:null,isAuthenticated:false});}
 },
}));
