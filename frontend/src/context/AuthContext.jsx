import { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSession = async () => {
    const token = localStorage.getItem("authToken");

    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const data = await api.get("/admins/me");
      setAdmin(data.admin || data);
    } catch (error) {
      localStorage.removeItem("authToken");
      localStorage.removeItem("adminUser");
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSession();
  }, []);

  const login = async (email, password) => {
    const data = await api.post("/admins/login", {
      email,
      password,
    });

    localStorage.setItem("authToken", data.token);

    if (data.admin) {
      localStorage.setItem("adminUser", JSON.stringify(data.admin));
      setAdmin(data.admin);
    }

    return data;
  };

  const logout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("adminUser");
    setAdmin(null);
  };

  return (
    <AuthContext.Provider
      value={{
        admin,
        loading,
        login,
        logout,
        isAuthenticated: !!admin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};