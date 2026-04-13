import api from "../lib/axios.js";

export const usersApi = {
    list: () => api.get("/api/users"),
    create: (body) => api.post("/api/users", body),
    update: (id, body) => api.put(`/api/users/${id}`, body),
    delete: (id) => api.delete(`/api/users/${id}`),
};
