import api from "../lib/axios.js";

export const inscriptionsApi = {
    listBySeance: (seanceId) =>
        api.get(`/api/inscriptions/seance/${seanceId}`),
    create: (body) => api.post("/api/inscriptions", body),
    bulk: (body) => api.post("/api/inscriptions/bulk", body),
    update: (id, body) => api.put(`/api/inscriptions/${id}`, body),
    removeFromSeance: (id, seanceId) =>
        api.post(`/api/inscriptions/${id}/remove-from-seance`, { seanceId }),
    delete: (id) => api.delete(`/api/inscriptions/${id}`),
};
