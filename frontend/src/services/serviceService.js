import api from '../config/api';

export const serviceService = {
    // Config (Admins)
    getAllServices: async () => {
        const response = await api.get('/services');
        return response.data;
    },

    createService: async (data) => {
        const response = await api.post('/services', data);
        return response.data;
    },

    updateService: async (id, data) => {
        const response = await api.put(`/services/${id}`, data);
        return response.data;
    },

    deleteService: async (id) => {
        const response = await api.delete(`/services/${id}`);
        return response.data;
    },

    previewTemplate: async (data) => {
        const response = await api.post('/services/preview', data, {
            responseType: 'blob'
        });
        return response.data;
    },

    // Requests
    getRequests: async (filters = {}) => {
        const params = new URLSearchParams(filters).toString();
        const response = await api.get(`/services/requests?${params}`);
        return response.data;
    },

    requestService: async (data) => {
        const response = await api.post('/services/requests', data);
        return response.data;
    },

    deleteRequest: (id) => api.delete(`/services/requests/${id}`),

    createRequestByAdmin: async (data) => {
        const response = await api.post('/services/requests/admin', data);
        return response.data;
    },

    processPayment: async (requestId) => {
        const response = await api.post('/services/pay', { request_id: requestId });
        return response.data;
    },

    getDownloadUrl: (requestId) => {
        const baseUrl = api.defaults.baseURL || 'http://localhost:5000/api';
        return `${baseUrl}/services/requests/${requestId}/download`;
    },

    updateRequestStatus: async (id, data) => {
        const response = await api.put(`/services/requests/${id}/status`, data);
        return response.data;
    },

    updateRequestData: async (id, data) => {
        const response = await api.put(`/services/requests/${id}`, data);
        return response.data;
    },
};
