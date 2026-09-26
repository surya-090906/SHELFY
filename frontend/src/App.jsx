import React, { useEffect, useState } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { useSocketStore } from './store/useSocketStore';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Receipts from './pages/Receipts';
import Deliveries from './pages/Deliveries';
import Transfers from './pages/Transfers';
import Adjustments from './pages/Adjustments';
import MoveHistory from './pages/MoveHistory';
import Warehouses from './pages/Warehouses';

export default function App() {
  const { isAuthenticated, checkAuth } = useAuthStore();
  const { initSocket } = useSocketStore();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [authPage, setAuthPage] = useState('login');
  const [resetEmail, setResetEmail] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      initSocket();
    }
  }, [isAuthenticated]);

  const navigate = (tab) => {
    if (['login', 'signup', 'forgot-password', 'reset-password'].includes(tab)) {
      setAuthPage(tab);
    } else {
      setCurrentTab(tab);
    }
  };

  if (!isAuthenticated) {
    switch (authPage) {
      case 'signup':
        return <Signup onNavigate={navigate} />;
      case 'forgot-password':
        return <ForgotPassword onNavigate={navigate} setResetEmail={setResetEmail} />;
      case 'reset-password':
        return <ResetPassword onNavigate={navigate} initialEmail={resetEmail} />;
      default:
        return <Login onNavigate={navigate} />;
    }
  }

  const renderPage = () => {
    switch (currentTab) {
      case 'dashboard':     return <Dashboard onNavigate={navigate} />;
      case 'products':      return <Products />;
      case 'receipts':      return <Receipts />;
      case 'deliveries':    return <Deliveries />;
      case 'transfers':     return <Transfers />;
      case 'adjustments':   return <Adjustments />;
      case 'move-history':  return <MoveHistory />;
      case 'warehouses':    return <Warehouses />;
      default:              return <Dashboard onNavigate={navigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar onNavigate={navigate} currentTab={currentTab} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentTab={currentTab} onNavigate={navigate} />
        <main className="flex-1 overflow-y-auto">
          {renderPage()}
        </main>
      </div>
      <Toast />
    </div>
  );
}
