import { createContext } from 'react';
import type { User } from '../api/types.ts';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'error';

export interface AuthState {
  status: AuthStatus;
  user: User | null;
  error: string | null;
}

export interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  retry: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
