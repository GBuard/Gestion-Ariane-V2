import api from "../lib/axios.js";

export const formationsApi = {
    list: (params) => api.get("/api/formations", { params }),
    get: (id) => api.get(`/api/formations/${id}`),
    create: (body) => api.post("/api/formations", body),
    update: (id, body) => api.put(`/api/formations/${id}`, body),
    archive: (id) => api.delete(`/api/formations/${id}`),
    destroy: (id) => api.post(`/api/formations/${id}/destroy`),
};
