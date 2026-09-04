
import React from 'react';
import { useUserContext } from '../contexts/UserContext';

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { isLoggedIn, currentUser } = useUserContext();

  // Si hay sesión pero el perfil aún no se ha hidratado, mostramos loader
  if (isLoggedIn && !currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-slate-500 font-bold animate-pulse">Preparando perfil...</p>
      </div>
    );
  }

  // Si no hay sesión activa o el perfil no se ha hidratado, no renderizar nada.
  // Esto evita crashes en componentes hijos que asumen que currentUser existe (assertion !).
  if (!isLoggedIn || !currentUser) {
    return null;
  }

  return <>{children}</>;
};
