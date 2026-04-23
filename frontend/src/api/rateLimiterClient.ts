import type { ClientConfig, RateLimitCheckRequest, RateLimitCheckResponse, HealthResponse} from "../types";

export async function checkRateLimit(request :RateLimitCheckRequest): Promise<RateLimitCheckResponse> {
    const response = await fetch('api/rate-limit/check', {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
    });

    if(!response.ok){
        throw new Error(`Failed to fetch rate limit: ${response.status}`);
    }

    return response.json() as Promise <RateLimitCheckResponse>;
}

export async function getHealth(): Promise <HealthResponse> {
    const response = await fetch('/api/health')

    if (!response.ok) {
        throw new Error(`Failed to fetch all configs: ${response.status}`);
    }

    return response.json() as Promise<HealthResponse>;
}

export async function getAllClients (): Promise<ClientConfig[]> {
    const response = await fetch('/api/admin/clients');

    if (!response.ok) {
        throw new Error(`Failed to fetch all configs: ${response.status}`);
  }

  return response.json() as Promise<ClientConfig[]>; // remember we're returning a list of configs
}

export async function getClientById (id: string): Promise<ClientConfig> {
    const response = await fetch(`/api/admin/clients/${id}`)

    if (!response.ok){
        throw new Error(`Failed to fetch client with ${id}: ${response.status}`);
    }

    return response.json() as Promise<ClientConfig>;
}

export async function createClient(config:ClientConfig): Promise <ClientConfig> {
    const response = await fetch('api/admin/clients', {
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

export async function updateClient (id: string, config:ClientConfig): Promise<ClientConfig> {
    const response = await fetch(`/api/admin/clients/${id}`, {
        method: "PUT",
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
    });

    if(!response.ok) {
        throw new Error(`Failed to update client with ${id}: ${response.status}`);
    }

    return response.json() as Promise<ClientConfig>;
}

export async function deleteClient(id: string): Promise<void>{
    const response = await fetch(`/api/admin/clients/${id}`,{
        method: "DELETE"
    });

    if(!response.ok) {
        throw new Error(`Failed to delete client with ${id}: ${response.status}`);
    }

}