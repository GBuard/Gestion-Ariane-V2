import api from "../lib/axios.js";

export const seancesApi = {
    list: (params) => api.get("/api/seances", { params }),
    calendar: (params) => api.get("/api/seances/calendar", { params }),
    feuilleEmargement: (id) =>
        api.get(`/api/seances/${id}/feuille-emargement`, {
            responseType: "blob",
        }),
    get: (id) => api.get(`/api/seances/${id}`),
    create: (body) => api.post("/api/seances", body),
    update: (id, body) => api.put(`/api/seances/${id}`, body),
    archive: (id) => api.delete(`/api/seances/${id}`),
    destroy: (id) => api.post(`/api/seances/${id}/destroy`),
};
