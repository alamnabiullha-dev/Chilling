import axios from "axios";

export const API_URL =
  import.meta.env.VITE_API_URL || "https://localhost:5002";

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("aurora_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("aurora_token");
    }

    return Promise.reject(error);
  }
);

export default api;