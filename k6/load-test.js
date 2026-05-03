import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ----------------------------------------------------------------
// Custom metrics
// These show up in the k6 summary at the end of the run and give
// us the numbers to put on the resume.
// Reference: https://k6.io/docs/using-k6/metrics/
// ----------------------------------------------------------------
const rateLimitedRate   = new Rate('rate_limited_responses');   // % of requests that got 429
const allowedRate       = new Rate('allowed_responses');        // % of requests that got 200
const rateLimitLatency  = new Trend('rate_limit_check_duration'); // latency of /check endpoint
const totalRequests     = new Counter('total_requests');        // total requests fired

// ----------------------------------------------------------------
// Test configuration
// Stages define how virtual users (VUs) ramp up and down over time.
//
// Stage 1 — Ramp up to 10 VUs over 30s (warm up)
// Stage 2 — Hold 10 VUs for 60s (steady state, should stay within limits)
// Stage 3 — Spike to 50 VUs for 30s (burst, should trigger 429s)
// Stage 4 — Ramp down to 0 over 10s (cool down)
//
// Reference: https://k6.io/docs/using-k6/scenarios/executors/ramping-vus/
// ----------------------------------------------------------------
export const options = {
  stages: [
    { duration: '30s', target: 10 }, // ramp up
    { duration: '60s', target: 10 }, // steady state
    { duration: '30s', target: 50 }, // burst — triggers rate limiting
    { duration: '10s', target: 0  }, // ramp down
  ],

  // ----------------------------------------------------------------
  // Thresholds — the test fails if these are not met.
  // These are the numbers that go on your resume.
  //
  // p95 latency under 200ms — 95% of requests complete in under 200ms
  // Error rate under 5% — fewer than 5% of requests fail unexpectedly
  //   (429s are expected and don't count as errors here)
  //
  // Reference: https://k6.io/docs/using-k6/thresholds/
  // ----------------------------------------------------------------
  thresholds: {
    http_req_duration: ['p(95)<200'],  // p95 latency < 200ms
    http_req_failed:   ['rate<0.05'],  // error rate < 5%
  },
};

// ----------------------------------------------------------------
// BASE_URL — defaults to localhost for local runs.
// Override with -e BASE_URL=https://... for production runs.
// ----------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// ----------------------------------------------------------------
// Main test function
// k6 calls this function once per virtual user per iteration.
// Reference: https://k6.io/docs/using-k6/test-lifecycle/
// ----------------------------------------------------------------
export default function () {
  // Each VU uses a unique client ID so they don't share rate limit buckets.
  // This simulates N distinct API consumers hitting the service simultaneously.
  const clientId = `load-test-client-${__VU}`;

  const payload = JSON.stringify({
    clientId:      clientId,
    limit:         100,
    windowSeconds: 60,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // ----------------------------------------------------------------
  // Hit the rate limit check endpoint
  // ----------------------------------------------------------------
  const res = http.post(`${BASE_URL}/api/rate-limit/check`, payload, params);

  totalRequests.add(1);

  // Track latency for this specific endpoint
  rateLimitLatency.add(res.timings.duration);

  // ----------------------------------------------------------------
  // Check response validity
  // Both 200 (allowed) and 429 (rate limited) are valid responses.
  // Anything else is an unexpected error.
  // ----------------------------------------------------------------
  const isAllowed      = res.status === 200;
  const isRateLimited  = res.status === 429;
  const isUnexpected   = !isAllowed && !isRateLimited;

  check(res, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
    'response has isAllowed field': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.isAllowed === 'boolean';
      } catch {
        return false;
      }
    },
  });

  // Record custom metric rates
  allowedRate.add(isAllowed);
  rateLimitedRate.add(isRateLimited);

  // ----------------------------------------------------------------
  // Sleep between requests to simulate realistic user behavior.
  // Without sleep, k6 hammers as fast as possible which isn't
  // representative of real traffic patterns.
  // ----------------------------------------------------------------
  sleep(0.1); // 100ms between requests per VU
}

// ----------------------------------------------------------------
// Summary handler — runs once at the end of the test.
// Prints a clean summary of the metrics we care about for the resume.
// Reference: https://k6.io/docs/results-output/end-of-test/custom-summary/
// ----------------------------------------------------------------
export function handleSummary(data) {
  const p95    = data.metrics.http_req_duration?.values?.['p(95)']?.toFixed(2) ?? 'N/A';
  const p99    = data.metrics.http_req_duration?.values?.['p(99)']?.toFixed(2) ?? 'N/A';
  const median = data.metrics.http_req_duration?.values?.['med']?.toFixed(2)   ?? 'N/A';
  const rps    = data.metrics.http_reqs?.values?.rate?.toFixed(2)              ?? 'N/A';
  const total  = data.metrics.total_requests?.values?.count                    ?? 'N/A';
  const rl     = ((data.metrics.rate_limited_responses?.values?.rate ?? 0) * 100).toFixed(1);
  const ok     = ((data.metrics.allowed_responses?.values?.rate     ?? 0) * 100).toFixed(1);

  console.log('\n========================================');
  console.log('       RateLimiter Load Test Results    ');
  console.log('========================================');
  console.log(`Total requests:      ${total}`);
  console.log(`Throughput:          ${rps} req/s`);
  console.log(`Median latency:      ${median}ms`);
  console.log(`p95 latency:         ${p95}ms`);
  console.log(`p99 latency:         ${p99}ms`);
  console.log(`Allowed (200):       ${ok}%`);
  console.log(`Rate limited (429):  ${rl}%`);
  console.log('========================================\n');

  // Return the default summary as well
  return {
    stdout: '\n', // suppress default output duplication
  };
}
