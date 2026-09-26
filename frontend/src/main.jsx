import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import {ready} from './i18n';
import App from './StockSense.jsx';

ready.then(()=>ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
));
