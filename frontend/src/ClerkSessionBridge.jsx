import {useEffect} from 'react';
import {useClerk} from '@clerk/react';
import {useAuthStore} from './store/useAuthStore';
export default function ClerkSessionBridge(){
 const clerk=useClerk();
 useEffect(()=>{useAuthStore.setState({signOutProvider:()=>clerk.signOut()});return()=>useAuthStore.setState({signOutProvider:undefined});},[clerk]);
 return null;
}
