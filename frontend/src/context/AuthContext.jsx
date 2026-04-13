import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { authApi } from "../api/authApi.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const logout = useCallback(() => {
        localStorage.removeItem("ariane_token");
        setUser(null);
    }, []);

    const loadMe = useCallback(async () => {
        const token = localStorage.getItem("ariane_token");
        if (!token) {
            setLoading(false);
            return;
        }
        try {
            const { data } = await authApi.me();
            setUser(data.user);
        } catch {
            logout();
        } finally {
            setLoading(false);
        }
    }, [logout]);

    useEffect(() => {
        loadMe();
    }, [loadMe]);

    const login = useCallback(async (email, password) => {
        const { data } = await authApi.login(email, password);
        localStorage.setItem("ariane_token", data.token);
        setUser(data.user);
        return data.user;
    }, []);

    const value = useMemo(
        () => ({ user, loading, login, logout, loadMe }),
        [user, loading, login, logout, loadMe],
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth doit être utilisé dans AuthProvider");
    }
    return ctx;
}
