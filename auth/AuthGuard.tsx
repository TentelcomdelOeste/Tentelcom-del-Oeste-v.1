
import React from 'react';
import { useUserContext } from '../contexts/UserContext';

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { isLoggedIn, currentUser } = useUserContext();

  // Si no hay sesión activa o el perfil no se ha hidratado, no renderizar nada.
  // Esto evita crashes en componentes hijos que asumen que currentUser existe (assertion !).
  if (!isLoggedIn || !currentUser) {
    return null;
  }

  return <>{children}</>;
};
