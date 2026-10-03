import api from "./axios";

export interface UserProfile {
    preferred_model: string | null;
    theme: string;
    onboarding_completed_at: string | null;
}

export interface User {
    id: number;
    username: string;
    email: string;
    profile: UserProfile | null;
}

export async function getCurrentUser(): Promise<User> {
    const response = await api.get<User>("/auth/me/");
    return response.data;
}

export async function completeOnboarding(): Promise<User> {
    const response = await api.post<User>("/auth/onboarding/complete/");
    return response.data;
}

export async function updateUserProfile(data: Partial<UserProfile>): Promise<User> {
    const response = await api.patch<User>("/auth/me/", data);
    return response.data;
}
