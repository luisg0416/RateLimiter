export interface ClientConfig {
    clientId: string;
    name: string | null;
    limit: number | null;
    windowSeconds: number | null;
    algorithm: string | null;
    refillRatePerSecond: number | null;
    isEnabled: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface RateLimitCheckRequest {
    clientId: string;
    limit?: number | null;
    windowSeconds?: number | null;
    refillRatePerSecond?: number | null;
}

export interface RateLimitCheckResponse {
    isAllowed: boolean;
    limit: number;
    remaining: number;
    retryAfterMs: number;
    message: string;
}