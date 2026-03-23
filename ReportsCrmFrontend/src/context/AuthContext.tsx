"use client";

import type React from "react";
import {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from "react";
import { auth } from "../api/client";

interface User {
  id: string;
  username: string;
  role: string;
  token?: string;
}

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  validateSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem("user");
    const sessionExpiry = localStorage.getItem("sessionExpiry");

    if (savedUser && sessionExpiry) {
      const expiry = new Date(sessionExpiry);
      if (expiry > new Date()) {
        return JSON.parse(savedUser);
      } else {
        localStorage.removeItem("user");
        localStorage.removeItem("sessionExpiry");
        return null;
      }
    }
    return null;
  });

  const logout = useCallback(async () => {
    if (user?.id) {
      try {
        await auth.logout(user.id);
      } catch (error) {
        console.error("[v0] Logout error:", error);
      }
    }
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("sessionExpiry");
  }, [user?.id]);

  const validateSession = useCallback(async (): Promise<boolean> => {
    if (!user?.id || !user?.token) {
      console.log("[v0] No user or token found");
      return false;
    }

    try {
      const response = await auth.validateSession(user.id);
      if (!response.data.valid) {
        console.log("[v0] Session validation returned false");
        await logout();
        return false;
      }
      console.log("[v0] Session validation passed");
      return true;
    } catch (error: any) {
      console.log("[v0] Session validation error:", error.message);
      // Don't logout on validation error, just return false
      return false;
    }
  }, [user?.id, user?.token, logout]);

  useEffect(() => {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + 24);
      localStorage.setItem("sessionExpiry", expiry.toISOString());
    } else {
      localStorage.removeItem("user");
      localStorage.removeItem("sessionExpiry");
    }
  }, [user]);

  // useEffect(() => {
  //   if (user) {
  //     const interval = setInterval(() => {
  //       validateSession();
  //     }, 5 * 60 * 60 * 1000); // Check every 5 hours

  //     return () => clearInterval(interval);
  //   }
  // }, [user, validateSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        isAuthenticated: !!user,
        logout,
        validateSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
