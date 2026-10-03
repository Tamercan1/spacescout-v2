import axiosInstance from './axios';
import type { ProviderCredential, ValidationResponse } from '../types/credentials';

export const getCredentials = async (): Promise<ProviderCredential[]> => {
    const response = await axiosInstance.get('/credentials/');
    return response.data;
};

export const saveCredential = async (provider: string, raw_key: string): Promise<ProviderCredential> => {
    const response = await axiosInstance.post('/credentials/', {
        provider,
        raw_key
    });
    return response.data;
};

export const deleteCredential = async (provider: string): Promise<void> => {
    await axiosInstance.delete(`/credentials/${provider}/`);
};

export const validateCredential = async (provider: string): Promise<ValidationResponse> => {
    const response = await axiosInstance.post(`/credentials/${provider}/validate/`);
    return response.data;
};
