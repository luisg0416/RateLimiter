using Microsoft.Extensions.Options;
using RateLimiter.Api.Configuration;
using StackExchange.Redis;

namespace RateLimiter.Api.Services;

public class TokenBucketService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly RateLimitOptions _options;
    private readonly ILogger<TokenBucketService> _logger;

    private const string LuaScript = @"
        local key          = KEYS[1]
        local now          = tonumber(ARGV[1])
        local capacity     = tonumber(ARGV[2])
        local refillRateMs = tonumber(ARGV[3])
        local ttlSeconds   = tonumber(ARGV[4])
 
        -- Read the current state from the hash.
        -- HGET returns nil if the key doesn't exist yet; default to
        -- a full bucket so the first request always succeeds.
        local tokens      = tonumber(redis.call('HGET', key, 'tokens'))
        local last_refill = tonumber(redis.call('HGET', key, 'last_refill'))
 
        if tokens == nil then
            -- First request for this client — start with a full bucket.
            tokens      = capacity
            last_refill = now
        end
 
        -- Calculate how many tokens have accumulated since last refill.
        -- elapsed * refillRateMs gives the fractional tokens to add.
        local elapsed       = now - last_refill
        local tokensToAdd   = elapsed * refillRateMs
        tokens = math.min(capacity, tokens + tokensToAdd)
 
        -- Update last_refill to now regardless of outcome.
        last_refill = now
 
        local allowed = 0
 
        if tokens >= 1 then
            -- Consume one token and allow the request.
            tokens  = tokens - 1
            allowed = 1
        end
 
        -- Persist updated state back to Redis.
        -- We store tokens as a string because Redis hashes are string-typed.
        redis.call('HSET', key, 'tokens', tostring(tokens), 'last_refill', tostring(last_refill))
        redis.call('EXPIRE', key, ttlSeconds)
 
        -- Return allowed flag and floor of remaining tokens.
        return { allowed, math.floor(tokens) }
    ";

    public TokenBucketService(IConnectionMultiplexer redis, IOptions<RateLimitOptions> options, ILogger<TokenBucketService> logger)
    {
        _redis   = redis;
        _options = options.Value;
        _logger  = logger;
    }

    public async Task<RateLimitResult> CheckAsync(string clientId, int? capacity = null, double? refillRatePerSecond = null)
    {
        var effectiveCapacity = capacity ?? _options.DefaultLimit;

        var effectiveRefillPerSec = refillRatePerSecond ?? (double)_options.DefaultLimit / _options.DefaultWindowSeconds;

        var refillRateMs = effectiveRefillPerSec / 1000.0;

        var ttlSeconds = (int)Math.Ceiling(effectiveCapacity / effectiveRefillPerSec) + 10;

        var key   = $"ratelimiter:tokenbucket:{clientId}";
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        try
        {
            var db = _redis.GetDatabase();
 
            var result = await db.ScriptEvaluateAsync(
                LuaScript,
                keys:   new RedisKey[]   { key },
                values: new RedisValue[]
                {
                    nowMs,
                    effectiveCapacity,
                    refillRateMs,
                    ttlSeconds
                }
            );
 
            var arr       = (RedisResult[])result!;
            var allowed   = (int)arr[0] == 1;
            var remaining = (int)arr[1];
 
            // RetryAfterMs: how long until one token refills.
            // If allowed, 0. If denied, we tell the client to wait for
            // 1 token's worth of refill time.
            var retryAfterMs = allowed
                ? 0L
                : (long)Math.Ceiling(1.0 / effectiveRefillPerSec * 1000);
 
            _logger.LogDebug(
                "Token bucket check — client: {ClientId}, allowed: {Allowed}, " +
                "remaining: {Remaining}/{Capacity}, refill: {Rate}/s",
                clientId, allowed, remaining, effectiveCapacity, effectiveRefillPerSec);
 
            // RateLimitResult is already defined in SlidingWindowService.cs.
            // Both services return the same record — the controller doesn't
            // need to know which algorithm produced it.
            return new RateLimitResult(
                IsAllowed:    allowed,
                Limit:        effectiveCapacity,
                Remaining:    remaining,
                RetryAfterMs: retryAfterMs
            );
        }
        catch (Exception ex)
        {
            // Fail open: if Redis is down, allow the request rather than
            // taking down the client's service too.
            // Same policy as SlidingWindowService for consistency.
            _logger.LogError(ex,
                "Redis unavailable during token bucket check for client {ClientId}. " +
                "Failing open — request allowed.", clientId);
 
            return new RateLimitResult(
                IsAllowed:    true,
                Limit:        effectiveCapacity,
                Remaining:    effectiveCapacity,
                RetryAfterMs: 0
            );
        }
    }
}