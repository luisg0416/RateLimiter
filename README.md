# RateLimiter — Rate Limiting as a Service

A production-deployed rate limiting service built with **ASP.NET Core**, **Redis**, and **React**. Implements two rate limiting algorithms from scratch using atomic Redis Lua scripts, with a live dashboard and full CI/CD pipeline to Azure.

**Live demo:** https://gentle-bush-034e0e40f.7.azurestaticapps.net  
**API:** https://ratelimiter-api.redwave-cfa783b1.eastus.azurecontainerapps.io/api/health

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Browser                        │
│              React + TypeScript (Vite) Dashboard             │
│         Azure Static Web Apps — gentle-bush-034e0e40f        │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    ASP.NET Core Web API                       │
│              Azure Container Apps (Docker)                    │
│         ratelimiter-api.redwave-cfa783b1.eastus              │
│                                                               │
│  POST /api/rate-limit/check  — sliding window or token bucket │
│  GET  /api/health            — Redis ping                     │
│  CRUD /api/admin/clients     — per-client config              │
└────────────────────────────┬────────────────────────────────┘
                             │ StackExchange.Redis
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  Azure Cache for Redis                        │
│              Basic C0 — ratelimiter-redis                     │
│                                                               │
│  Sorted sets  — sliding window counters per client           │
│  Hashes       — token bucket state per client                │
│  Strings      — per-client configuration (JSON)              │
└─────────────────────────────────────────────────────────────┘
```

**CI/CD:**
```
GitHub push → GitHub Actions → Docker build → Azure Container Registry → Container Apps
                             → React build  → Azure Static Web Apps
```

---

## Algorithms

### Sliding Window Counter
Implemented as a Redis sorted set per client. Each request adds a member with the current Unix timestamp as its score. On every request, members outside the window are pruned with `ZREMRANGEBYSCORE` before counting. The entire read-decide-write sequence runs as an **atomic Lua script** to prevent race conditions under concurrent load.

```lua
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - windowMs)
local count = redis.call('ZCARD', key)
if count < limit then
    redis.call('ZADD', key, now, requestId)
    return {1, count + 1}
else
    return {0, count}
end
```

**Properties:** Smooth request distribution, no boundary burst problem of fixed windows, O(log N) per request.

### Token Bucket
Implemented as a Redis hash storing `tokens` and `last_refill` per client. On each request, tokens are refilled proportionally based on elapsed time since the last request, then one token is consumed if available. Also runs as an **atomic Lua script**.

**Properties:** Allows controlled bursting up to bucket capacity, smooth rate enforcement, configurable refill rate independent of bucket size.

---

## Key Design Decisions

**Why Lua scripts?** Rate limiting is a classic read-modify-write problem. Without atomicity, two concurrent requests can both read `count = 99`, both decide they're under the limit, and both write — exceeding the limit. Redis executes Lua scripts atomically, making this a non-issue without requiring distributed locks.

**Why fail open?** If Redis becomes unreachable, the service allows all requests through rather than blocking them. For a rate limiter sitting in front of someone's API, taking down their service entirely because the limiter's cache is unavailable is worse than temporarily allowing excess traffic.

**Why per-client configuration in Redis?** Storing client configs as JSON strings in Redis means config changes take effect immediately without redeployment, and the config store scales with the same infrastructure already in use.

---

## Performance

Load tested with [k6](https://k6.io) against the production Azure deployment (50 virtual users, 2m10s):

| Metric | Result |
|---|---|
| Total requests | 7,525 |
| Throughput | 52.6 req/s |
| Median latency | 52.6ms |
| p95 latency | 74.3ms |
| Allowed (200) | 58.6% |
| Rate limited (429) | 41.4% |

p95 latency of **74ms** includes the full round trip: GitHub Actions runner → Azure Container Apps → Azure Cache for Redis → response. The atomic Lua script executes in a single Redis round trip with no additional locking overhead.

Run the load test yourself:
```bash
k6 run -e BASE_URL=https://ratelimiter-api.redwave-cfa783b1.eastus.azurecontainerapps.io k6/load-test.js
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | C# / ASP.NET Core 10 |
| Cache & state | Redis (StackExchange.Redis) |
| Frontend | React + TypeScript (Vite) |
| Containerization | Docker + docker-compose |
| Backend deployment | Azure Container Apps |
| Frontend deployment | Azure Static Web Apps |
| Container registry | Azure Container Registry |
| CI/CD | GitHub Actions |
| Load testing | k6 |

---

## Local Development

**Prerequisites:** Docker Desktop, Node.js 20+, .NET 10 SDK

```bash
# Clone
git clone https://github.com/luisg0416/RateLimiter.git
cd RateLimiter

# Start backend + Redis
docker-compose up

# Start frontend (separate terminal)
cd frontend
npm install
npm run dev
```

- API: http://localhost:8080
- Swagger UI: http://localhost:8080 (root)
- Frontend: http://localhost:5173

---

## API Reference

### Check rate limit
```
POST /api/rate-limit/check
```
```json
{
  "clientId": "my-api-key",
  "limit": 100,
  "windowSeconds": 60
}
```
Returns `200 OK` if allowed, `429 Too Many Requests` with `Retry-After` header if rate limited.

### Admin — manage clients
```
GET    /api/admin/clients          — list all clients
POST   /api/admin/clients          — create client config
GET    /api/admin/clients/{id}     — get client config
PUT    /api/admin/clients/{id}     — update client config
DELETE /api/admin/clients/{id}     — delete client config
```

### Health
```
GET /api/health   — returns API status + Redis ping in ms
```

---

## Project Structure

```
RateLimiter/
├── .github/workflows/
│   ├── backend.yml       — build, push to ACR, deploy to Container Apps
│   └── frontend.yml      — build React, deploy to Static Web Apps
├── k6/
│   └── load-test.js      — k6 load test (ramp up, burst, recovery)
├── src/RateLimiter.Api/
│   ├── Controllers/
│   │   ├── HealthController.cs
│   │   ├── RateLimitController.cs
│   │   └── ClientConfigController.cs
│   ├── Services/
│   │   ├── SlidingWindowService.cs   — sliding window + Lua script
│   │   ├── TokenBucketService.cs     — token bucket + Lua script
│   │   └── ClientConfigService.cs    — per-client config CRUD
│   ├── Configuration/
│   │   └── RateLimitOptions.cs
│   └── Models/
│       └── ClientConfig.cs
├── frontend/src/
│   ├── api/rateLimiterClient.ts      — typed fetch wrapper
│   ├── hooks/useTrafficPoller.ts     — live polling hook
│   └── components/
│       ├── TrafficChart.tsx          — Recharts live chart
│       ├── ClientTable.tsx           — admin client table
│       ├── ClientFormModal.tsx       — create/edit modal
│       └── DemoButton.tsx            — burst demo button
└── docker-compose.yml
```