import api from "../lib/axios.js";

export const inscriptionsApi = {
    listBySeance: (seanceId) =>
        api.get(`/api/inscriptions/seance/${seanceId}`),
    create: (body) => api.post("/api/inscriptions", body),
    bulk: (body) => api.post("/api/inscriptions/bulk", body),
    update: (id, body) => api.put(`/api/inscriptions/${id}`, body),
};
