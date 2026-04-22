import type { ClientConfig, RateLimitCheckRequest, RateLimitCheckResponse } from "../types";

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

export async function updateClient (id: string): Promise<ClientConfig> {
    const response = await fetch(`/api/admin/clients/${id}`, {
        method: "Put"
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