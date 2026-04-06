import { useState, useEffect, useCallback } from 'react';

export type CurrentUser = {
  username: string;
  loginTime: string;
} | null;

// Tempo máximo de sessão em horas (8 horas = 28800000ms)
const SESSION_TIMEOUT_HOURS = 8;
const SESSION_TIMEOUT_MS = SESSION_TIMEOUT_HOURS * 60 * 60 * 1000;

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<CurrentUser>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  const logout = useCallback(() => {
    localStorage.removeItem("na-auth");
    localStorage.removeItem("na-current-user");
    setIsAuthenticated(false);
    setCurrentUser(null);
  }, []);

  const checkSessionExpiry = useCallback(() => {
    const userData = localStorage.getItem("na-current-user");
    if (!userData) return false;

    try {
      const { loginTime } = JSON.parse(userData);
      const now = new Date().getTime();
      const loginTimeMs = new Date(loginTime).getTime();
      const elapsed = now - loginTimeMs;

      return elapsed > SESSION_TIMEOUT_MS;
    } catch {
      return true; // Se há erro ao ler dados, considerar como expirado
    }
  }, []);

  useEffect(() => {
    // Verificar se está autenticado
    const authStatus = localStorage.getItem("na-auth") === "true";

    if (authStatus) {
      // Verificar se a sessão expirou
      if (checkSessionExpiry()) {
        console.log("Sessão expirada. Fazendo logout automático...");
        logout();
        return;
      }

      // Carregar usuário atual
      try {
        const userData = localStorage.getItem("na-current-user");
        if (userData) {
          setCurrentUser(JSON.parse(userData));
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error("Erro ao carregar dados do usuário:", error);
        logout();
      }
    } else {
      setIsAuthenticated(false);
      setCurrentUser(null);
    }
  }, [logout, checkSessionExpiry]);

  // Verificar expiração da sessão periodicamente (a cada 5 minutos)
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkInterval = setInterval(() => {
      if (checkSessionExpiry()) {
        console.log("Sessão expirada durante o uso. Fazendo logout automático...");
        logout();
      }
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(checkInterval);
  }, [isAuthenticated, logout, checkSessionExpiry]);

  const getUserRole = () => {
    if (!currentUser) return null;
    return currentUser.username === "admin" ? "Administrador" : "Operador";
  };

  const getLoginDuration = () => {
    if (!currentUser?.loginTime) return null;

    const loginTime = new Date(currentUser.loginTime);
    const now = new Date();
    const diff = now.getTime() - loginTime.getTime();

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    } else {
      return `${minutes}min`;
    }
  };

  const getTimeUntilExpiry = () => {
    if (!currentUser?.loginTime) return null;

    const loginTime = new Date(currentUser.loginTime).getTime();
    const now = new Date().getTime();
    const elapsed = now - loginTime;
    const remaining = SESSION_TIMEOUT_MS - elapsed;

    if (remaining <= 0) return null;

    const remainingHours = Math.floor(remaining / (1000 * 60 * 60));
    const remainingMinutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    if (remainingHours > 0) {
      return `${remainingHours}h ${remainingMinutes}min`;
    } else {
      return `${remainingMinutes}min`;
    }
  };

  const isSessionNearExpiry = () => {
    if (!currentUser?.loginTime) return false;

    const loginTime = new Date(currentUser.loginTime).getTime();
    const now = new Date().getTime();
    const elapsed = now - loginTime;
    const remaining = SESSION_TIMEOUT_MS - elapsed;

    // Considera "próximo do fim" se restam menos de 30 minutos
    return remaining <= 30 * 60 * 1000 && remaining > 0;
  };

  return {
    currentUser,
    isAuthenticated,
    logout,
    getUserRole,
    getLoginDuration,
    getTimeUntilExpiry,
    isSessionNearExpiry,
    sessionTimeoutHours: SESSION_TIMEOUT_HOURS
  };
}