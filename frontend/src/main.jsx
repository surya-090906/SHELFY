import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import {ready} from './i18n';
import App from './StockSense.jsx';
import {ClerkProvider} from '@clerk/react';
import {clerkEnabled,clerkPublishableKey} from './authConfig';
import ClerkSessionBridge from './ClerkSessionBridge';

ready.then(()=>ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {clerkEnabled&&clerkPublishableKey?<ClerkProvider publishableKey={clerkPublishableKey}><ClerkSessionBridge/><App/></ClerkProvider>:<App/>}
  </React.StrictMode>
));
