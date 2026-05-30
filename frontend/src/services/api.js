import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

const stored = localStorage.getItem('token');
if (stored) {
  api.defaults.headers.common['Authorization'] = `Bearer ${stored}`;
}

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      delete api.defaults.headers.common['Authorization'];
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
