// rateLimiterClient.ts
//
// Typed fetch wrapper for all RateLimiter API endpoints.
//
// BASE_URL is injected at build time by Vite from the VITE_API_BASE_URL
// environment variable. In local development this is empty string and the
// Vite dev server proxy (vite.config.ts) forwards /api/* to localhost:8080.
// In production (Azure Static Web Apps) this is the full Container Apps URL,
// e.g. https://ratelimiter-api.redwave-cfa783b1.eastus.azurecontainerapps.io
//
// Reference: https://vitejs.dev/guide/env-and-mode

import type { ClientConfig, RateLimitCheckRequest, RateLimitCheckResponse, HealthResponse } from "../types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export async function checkRateLimit(request: RateLimitCheckRequest): Promise<RateLimitCheckResponse> {
    const response = await fetch(`${BASE_URL}/api/rate-limit/check`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
    });

    if (response.status === 200 || response.status === 429) {
        return response.json() as Promise<RateLimitCheckResponse>;
    }

    throw new Error(`Unexpected error from rate limit check: ${response.status}`);
}

export async function getHealth(): Promise<HealthResponse> {
    const response = await fetch(`${BASE_URL}/api/health`);

    if (!response.ok) {
        throw new Error(`Failed to fetch health: ${response.status}`);
    }

    return response.json() as Promise<HealthResponse>;
}

export async function getAllClients(): Promise<ClientConfig[]> {
    const response = await fetch(`${BASE_URL}/api/admin/clients`);

    if (!response.ok) {
        throw new Error(`Failed to fetch all configs: ${response.status}`);
    }

    return response.json() as Promise<ClientConfig[]>;
}

export async function getClientById(id: string): Promise<ClientConfig> {
    const response = await fetch(`${BASE_URL}/api/admin/clients/${id}`);

    if (!response.ok) {
        throw new Error(`Failed to fetch client with ${id}: ${response.status}`);
    }

    return response.json() as Promise<ClientConfig>;
}

export async function createClient(config: ClientConfig): Promise<ClientConfig> {
    const response = await fetch(`${BASE_URL}/api/admin/clients`, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
    });

    if (!response.ok) {
        throw new Error(`Failed to create client: ${response.status}`);
    }

    return response.json() as Promise<ClientConfig>;
}

export async function updateClient(id: string, config: ClientConfig): Promise<ClientConfig> {
    const response = await fetch(`${BASE_URL}/api/admin/clients/${id}`, {
        method: "PUT",
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
    });

    if (!response.ok) {
        throw new Error(`Failed to update client with ${id}: ${response.status}`);
    }

    return response.json() as Promise<ClientConfig>;
}

export async function deleteClient(id: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/api/admin/clients/${id}`, {
        method: "DELETE",
    });

    if (!response.ok) {
        throw new Error(`Failed to delete client with ${id}: ${response.status}`);
    }
}