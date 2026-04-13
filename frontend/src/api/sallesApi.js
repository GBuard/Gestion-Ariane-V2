import api from "../lib/axios.js";

export const sallesApi = {
    list: (params) => api.get("/api/salles", { params }),
    get: (id) => api.get(`/api/salles/${id}`),
    create: (body) => api.post("/api/salles", body),
    update: (id, body) => api.put(`/api/salles/${id}`, body),
    archive: (id) => api.delete(`/api/salles/${id}`),
};
