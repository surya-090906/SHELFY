import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useSocketStore } from '../store/useSocketStore';
import { Bell, User, LogOut, ShieldCheck, CheckCheck, Box, ExternalLink } from 'lucide-react';

export default function Navbar({ onNavigate, currentTab }) {
  const { user, logout } = useAuthStore();
  const { isConnected, notifications, unreadCount, markAllAsRead, clearNotifications } = useSocketStore();
  const [showBellMenu, setShowBellMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Brand & Connection Status */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => onNavigate('dashboard')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Box className="w-5 h-5 text-white stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                Shelfy
              </span>
              {user?.company_code && (
                <span className="hidden sm:inline-block text-xs font-mono font-semibold px-2 py-0.5 rounded bg-brand-500/20 border border-brand-500/30 text-brand-300">
                  {user.company_code}
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 font-medium block">
              Multi-Tenant IMS
            </span>
          </div>
        </div>

        {/* Live Socket Status Dot */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="text-slate-400 font-medium text-[11px]">
            {isConnected ? 'Realtime Connected' : 'Connecting...'}
          </span>
        </div>
      </div>

      {/* Right side items */}
      <div className="flex items-center space-x-3">
        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => {
              setShowBellMenu(!showBellMenu);
              setShowUserMenu(false);
              if (!showBellMenu && unreadCount > 0) {
                markAllAsRead();
              }
            }}
            className="relative p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title="Realtime Alerts"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Drawer */}
          {showBellMenu && (
            <div className="absolute right-0 mt-2 w-84 sm:w-96 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-sm text-slate-200">System Notifications</span>
                  <span className="px-2 py-0.5 text-[11px] rounded-full bg-brand-500/20 text-brand-400">
                    Live Feed
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {notifications.length > 0 && (
                    <button
                      onClick={clearNotifications}
                      className="text-[11px] text-slate-400 hover:text-slate-200 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-3 max-h-80 overflow-y-auto space-y-2.5 pr-1">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    No new activity alerts. Operations will stream here in real time.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3 rounded-xl border text-xs transition ${
                        n.type === 'warning'
                          ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                          : n.type === 'success'
                          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold mb-1">
                        <span>{n.title}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-300 text-[11px] leading-relaxed">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Role Badge */}
        <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80">
          <ShieldCheck
            className={`w-4 h-4 ${
              user?.role === 'manager' ? 'text-brand-400' : 'text-emerald-400'
            }`}
          />
          <span className="text-xs font-semibold capitalize text-slate-200">
            {user?.role === 'manager' ? 'Inventory Manager' : 'Warehouse Staff'}
          </span>
        </div>

        {/* User Profile Button */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowBellMenu(false);
            }}
            className="flex items-center space-x-2 p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 transition border border-slate-700"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-600 to-indigo-600 flex items-center justify-center font-bold text-xs text-white uppercase">
              {user?.name ? user.name.charAt(0) : 'U'}
            </div>
            <span className="hidden md:inline-block text-xs font-medium text-slate-200 pr-1 max-w-[130px] truncate">
              {user?.name}
            </span>
          </button>

          {/* Profile Dropdown */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50 animate-in fade-in duration-100">
              <div className="px-3 py-2 border-b border-slate-800">
                <p className="text-xs font-bold text-slate-200 truncate">{user?.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                <div className="mt-1 inline-block text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300">
                  Role: {user?.role}
                </div>
              </div>

              <div className="pt-1">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onNavigate('dashboard');
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 rounded-lg transition"
                >
                  My Dashboard
                </button>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    logout();
                  }}
                  className="w-full flex items-center space-x-2 text-left px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
