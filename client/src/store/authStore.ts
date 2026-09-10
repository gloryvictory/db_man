import { create } from 'zustand';
import { api } from '../api';
import { useStore } from '../store';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  init: () => Promise<void>;
  login: (login: string, password: string) => Promise<string | null>;
  register: (fio: string, login: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,

  init: async () => {
    try {
      const r = await api.me();
      set({ user: r.user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  login: async (login, password) => {
    try {
      const r = await api.login(login, password);
      useStore.getState().reset();
      set({ user: r.user });
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Ошибка входа';
    }
  },

  register: async (fio, login, password) => {
    try {
      const r = await api.register(fio, login, password);
      useStore.getState().reset();
      set({ user: r.user });
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Ошибка регистрации';
    }
  },

  logout: async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    useStore.getState().reset();
    set({ user: null });
  },
}));
