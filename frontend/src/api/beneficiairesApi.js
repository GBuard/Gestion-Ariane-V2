import api from "../lib/axios.js";

export const beneficiairesApi = {
    list: (params) => api.get("/api/beneficiaires", { params }),
    get: (id) => api.get(`/api/beneficiaires/${id}`),
    create: (body) => api.post("/api/beneficiaires", body),
    update: (id, body) => api.put(`/api/beneficiaires/${id}`, body),
    archive: (id) => api.delete(`/api/beneficiaires/${id}`),
    destroy: (id) => api.post(`/api/beneficiaires/${id}/destroy`),
};
