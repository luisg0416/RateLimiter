// Gets live traffic for our chart; what requests are allowed and what requests are blocked

import { useState, useEffect } from 'react';
import { checkRateLimit } from '../api/rateLimiterClient';
import type { RateLimitCheckResponse } from '../types';


export interface TrafficDataPoint {
  timestamp: number;   // time request is made; not given from backend
  isAllowed: boolean;  // was this request allowed or blocked?
  remaining: number;   // how many requests were left at this moment
  limit: number;       // the configured limit for this client
}

// What the hook returns to whatever component uses it
export interface UseTrafficPollerResult {
  data: TrafficDataPoint[];        // rolling history for the chart
  latest: RateLimitCheckResponse | null; 
  allowed: number;                 
  blocked: number;                 
}

// How many data points to keep in memory at once.
// At 1 poll/second this is ~50 seconds of history.
const MAX_POINTS = 50;

export function useTrafficPoller(clientId: string, intervalMs: number = 1000 ): UseTrafficPollerResult {

  // Rolling array of traffic data points
  const [data, setData] = useState<TrafficDataPoint[]>([]);

  // Most recent raw API response
  const [latest, setLatest] = useState<RateLimitCheckResponse | null>(null);

  useEffect(() => {
    async function poll() {
      try {
        const result = await checkRateLimit({ clientId });

        setLatest(result);

        const point: TrafficDataPoint = {
          timestamp: Date.now(),
          isAllowed: result.isAllowed,
          remaining: result.remaining,
          limit: result.limit,
        };

        setData(prev => [...prev, point].slice(-MAX_POINTS));

      } catch {
      }
    }

    poll();

    // Then poll on the interval
    const interval = setInterval(poll, intervalMs);
    return () => clearInterval(interval);

  }, [clientId, intervalMs]);

  const allowed = data.filter(d => d.isAllowed).length;
  const blocked = data.filter(d => !d.isAllowed).length;

  return { data, latest, allowed, blocked };
}