import api from "../lib/axios.js";



export const statsApi = {

    dashboard: () => api.get("/api/stats/dashboard"),

    global: () => api.get("/api/stats/global"),

    workshops: (params) => api.get("/api/stats/workshops", { params }),

};

