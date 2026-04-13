import api from "../lib/axios.js";

export const authApi = {
    login: (email, password) =>
        api.post("/api/auth/login", { email, password }),
    me: () => api.get("/api/auth/me"),
};
