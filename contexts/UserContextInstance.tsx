import { createContext } from 'react';
import { User } from '../utils/types';

export interface UserContextType {
  currentUser: User | null;
  isLoggedIn: boolean;
  isAuthLoading: boolean;
  isAuthResolving: boolean;
  loginError: string | null;
  showForcePasswordChangeModal: boolean;
  userPermisos: any;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updatePasswordSecurely: (newPassword: string) => Promise<{ success: boolean; message?: string }>;
  setLoginError: (error: string | null) => void;
  authReady: boolean;
  isAuthResolved: boolean;
  sessionHydrated: boolean;
}

export const UserContext = createContext<UserContextType | null>(null);
