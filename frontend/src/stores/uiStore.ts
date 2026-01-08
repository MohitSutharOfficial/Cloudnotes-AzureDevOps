import { create } from 'zustand';
import type { Toast } from '../types';

interface UIStore {
    // Sidebar
    sidebarOpen: boolean;
    toggleSidebar: () => void;
    setSidebarOpen: (open: boolean) => void;

    // Toasts
    toasts: Toast[];
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;

    // Modals
    modals: Map<string, boolean>;
    openModal: (key: string) => void;
    closeModal: (key: string) => void;
    isModalOpen: (key: string) => boolean;

    // Loading states
    globalLoading: boolean;
    setGlobalLoading: (loading: boolean) => void;

    // Search
    globalSearch: string;
    setGlobalSearch: (search: string) => void;
}

export const useUIStore = create<UIStore>((set, get) => ({
    // Sidebar
    sidebarOpen: true,
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),

    // Toasts
    toasts: [],
    addToast: (toast) => {
        const id = Math.random().toString(36).substring(7);
        const newToast = { ...toast, id };

        set((state) => ({ toasts: [...state.toasts, newToast] }));

        // Auto-remove after duration
        const duration = toast.duration || 5000;
        setTimeout(() => {
            get().removeToast(id);
        }, duration);
    },
    removeToast: (id: string) => {
        set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
        }));
    },

    // Modals
    modals: new Map(),
    openModal: (key: string) => {
        set((state) => {
            const modals = new Map(state.modals);
            modals.set(key, true);
            return { modals };
        });
    },
    closeModal: (key: string) => {
        set((state) => {
            const modals = new Map(state.modals);
            modals.set(key, false);
            return { modals };
        });
    },
    isModalOpen: (key: string) => {
        return get().modals.get(key) || false;
    },

    // Loading
    globalLoading: false,
    setGlobalLoading: (loading: boolean) => set({ globalLoading: loading }),

    // Search
    globalSearch: '',
    setGlobalSearch: (search: string) => set({ globalSearch: search }),
}));

// Toast helper functions
export const toast = {
    success: (title: string, message?: string) => {
        useUIStore.getState().addToast({ type: 'success', title, message });
    },
    error: (title: string, message?: string) => {
        useUIStore.getState().addToast({ type: 'error', title, message });
    },
    warning: (title: string, message?: string) => {
        useUIStore.getState().addToast({ type: 'warning', title, message });
    },
    info: (title: string, message?: string) => {
        useUIStore.getState().addToast({ type: 'info', title, message });
    },
};
