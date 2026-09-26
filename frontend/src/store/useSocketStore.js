import { create } from 'zustand';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const useSocketStore = create((set, get) => ({
  socket: null,
  isConnected: false,
  notifications: [],
  unreadCount: 0,
  activeToast: null,

  initSocket: () => {
    if (get().socket) return;

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('⚡ Connected to StockSense live socket');
      set({ isConnected: true });
    });

    socket.on('disconnect', () => {
      console.log('🔌 Disconnected from StockSense socket');
      set({ isConnected: false });
    });

    // Realtime events
    socket.on('stock:low', (data) => {
      const notification = {
        id: Date.now() + Math.random(),
        type: 'warning',
        title: '⚠️ Low Stock Alert',
        message: `${data.productName} (${data.sku}) is at ${data.currentStock} ${data.unitOfMeasure} (Threshold: ${data.reorderThreshold})`,
        timestamp: new Date(),
        data,
      };
      get().addNotification(notification);
    });

    socket.on('receipt:validated', (data) => {
      const notification = {
        id: Date.now() + Math.random(),
        type: 'success',
        title: '📥 Receipt Validated',
        message: `Supplier ${data.supplier} validated by ${data.validatedBy}. Ledger stock updated.`,
        timestamp: new Date(),
        data,
      };
      get().addNotification(notification);
    });

    socket.on('delivery:validated', (data) => {
      const notification = {
        id: Date.now() + Math.random(),
        type: 'info',
        title: '📤 Delivery Dispatched',
        message: `Order for ${data.customer} validated by ${data.validatedBy}. Stock deducted from ledger.`,
        timestamp: new Date(),
        data,
      };
      get().addNotification(notification);
    });

    socket.on('transfer:validated', (data) => {
      const notification = {
        id: Date.now() + Math.random(),
        type: 'info',
        title: '🔄 Stock Transfer Completed',
        message: `Transferred from ${data.from} to ${data.to} by ${data.validatedBy}.`,
        timestamp: new Date(),
        data,
      };
      get().addNotification(notification);
    });

    socket.on('adjustment:created', (data) => {
      const notification = {
        id: Date.now() + Math.random(),
        type: 'warning',
        title: '⚖️ Physical Count Adjusted',
        message: `${data.product} at ${data.location}: Delta of ${data.delta >= 0 ? '+' : ''}${data.delta} recorded by ${data.createdBy}.`,
        timestamp: new Date(),
        data,
      };
      get().addNotification(notification);
    });

    set({ socket });
  },

  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 30),
      unreadCount: state.unreadCount + 1,
      activeToast: notification,
    }));

    // Auto-dismiss toast after 5 seconds
    setTimeout(() => {
      if (get().activeToast?.id === notification.id) {
        set({ activeToast: null });
      }
    }, 5000);
  },

  clearToast: () => set({ activeToast: null }),

  markAllAsRead: () => set({ unreadCount: 0 }),

  clearNotifications: () => set({ notifications: [], unreadCount: 0 }),
}));
