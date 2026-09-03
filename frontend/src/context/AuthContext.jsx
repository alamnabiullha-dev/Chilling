import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { resetSocket } from "../socket/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("aurora_token"));
  const [loading, setLoading] = useState(Boolean(token));

  const refreshMe = useCallback(async () => {
    if (!localStorage.getItem("aurora_token")) {
      setLoading(false);
      return null;
    }
    try {
      const { data } = await api.get("/users/me");
      setUser(data);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe().catch(() => {
      localStorage.removeItem("aurora_token");
      setToken(null);
      setUser(null);
      setLoading(false);
    });
  }, [refreshMe]);

  const verifyOtp = async (phone, otp) => {
    const { data } = await api.post("/auth/verify-otp", { phone, otp });
    localStorage.setItem("aurora_token", data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const updateProfile = async (payload) => {
    const { data } = await api.put("/users/me", payload);
    setUser(data);
    return data;
  };

  const logout = async () => {
    await api.post("/auth/logout").catch(() => {});
    localStorage.removeItem("aurora_token");
    resetSocket();
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, token, loading, refreshMe, setUser, verifyOtp, updateProfile, logout }),
    [user, token, loading, refreshMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
