import { api } from './apiClient';

export const sessionService = { me: (o) => api.get('/me', o) };
