"use client";

import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import { getCurrentStoreId } from "./client-store-context";
import { shopperErrorMessage } from "./shopper-error";

const AUTH_TOKEN_KEY = "auth_token";
const GUEST_ID_KEY = "guest_id";
const SIGNED_OUT_KEY = "sf_signed_out";

export const getAuthToken = () => (typeof window === "undefined" ? null : localStorage.getItem(AUTH_TOKEN_KEY));
export const setAuthToken = (token: string) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(SIGNED_OUT_KEY);
};
export const clearAuthToken = () => localStorage.removeItem(AUTH_TOKEN_KEY);

export const markSignedOut = () => {
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(SIGNED_OUT_KEY, "1");
};
export const isSignedOutSession = () => (typeof sessionStorage === "undefined" ? false : sessionStorage.getItem(SIGNED_OUT_KEY) === "1");
export const clearSignedOutSession = () => {
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(SIGNED_OUT_KEY);
};

export const getGuestId = () => (typeof window === "undefined" ? null : localStorage.getItem(GUEST_ID_KEY));
export const setGuestId = (id: string) => localStorage.setItem(GUEST_ID_KEY, id);
export const clearGuestId = () => localStorage.removeItem(GUEST_ID_KEY);

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
    headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
    const token = getAuthToken();
    const guestId = getGuestId();

    if (token && !isSignedOutSession()) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    // Sent on every request:
    // - Unauthenticated: server uses it to read/write the guest cart
    // - Authenticated: server uses it to merge the guest cart on login
    if (guestId) {
        config.headers["x-guest-id"] = guestId;
    }

    return config;
});

api.interceptors.response.use(
    (response) => {
        // Persist guestId whenever the server echoes it back
        const guestId = response.data?.data?.cart?.guestId ?? response.data?.cart?.guestId;
        if (guestId) setGuestId(guestId);

        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        const requestUrl = String(originalRequest?.url ?? "");
        const skipRefresh =
            !getAuthToken() ||
            isSignedOutSession() ||
            requestUrl.includes("/logout") ||
            requestUrl.includes("/refresh");

        if (error.response?.status === 401 && !originalRequest._retry && !skipRefresh) {
            originalRequest._retry = true;

            try {
                const storeId = getCurrentStoreId();
                const res = await api.post(`/customer/${storeId}/refresh`, {}, { withCredentials: true });
                const newToken: string = res.data?.data?.token ?? res.data?.token;

                if (newToken) {
                    setAuthToken(newToken);
                    originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
                    return api(originalRequest);
                }
            } catch {
                clearAuthToken();
            }
        }

        return Promise.reject(error);
    }
);

export const getApi = <T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
    api.get<T>(url, config);

export const postApi = <T = unknown, D = unknown>(
    url: string,
    data: D,
    config?: AxiosRequestConfig
): Promise<AxiosResponse<T>> => api.post<T>(url, data, config);

export const putApi = <T = unknown, D = unknown>(
    url: string,
    data: D,
    config?: AxiosRequestConfig
): Promise<AxiosResponse<T>> => api.put<T>(url, data, config);

export const deleteApi = <T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
    api.delete<T>(url, config);

/**
 * What the shopper is told about a failed API call: the backend's own message when it's one written for shoppers,
 * otherwise `fallback` (never a raw server or network error - see lib/shopper-error.ts).
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
    if (axios.isAxiosError(error)) {
        return shopperErrorMessage(error.response?.status, error.response?.data, fallback);
    }
    return fallback;
}

export default api;
