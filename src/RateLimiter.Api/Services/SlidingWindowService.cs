using Microsoft.Extensions.Options;
using RateLimiter.Api.Configuration;
using StackExchange.Redis;

namespace RateLimiter.Api.Services;

public record RateLimitResult(
    bool IsAllowed, // status is dependant on whether request is within limit
    int Limit, // max number of requests for this client
    int Remaining, // how many requests the client has left in this window
    long RetryAfterMs // milliseconds until the window resets (0 if allowed)
);

public class SlidingWindowService
{
    private readonly IConnectionMultiplexer _redis; // holds redis connection
    private readonly RateLimitOptions _options; // holds configurations from RateLimitOptions.cs; what rates the limits
    private readonly ILogger<SlidingWindowService> _logger; // logs info

    private const string LuaScript = @"
        local key        = KEYS[1] 
        local now        = tonumber(ARGV[1])
        local windowMs   = tonumber(ARGV[2])
        local limit      = tonumber(ARGV[3])
        local requestId  = ARGV[4]
        local ttlSeconds = tonumber(ARGV[5])

        redis.call('ZREMRANGEBYSCORE', key, '-inf', now - windowMs)

        local count = redis.call('ZCARD', key)

        if count < limit then
        
            redis.call('ZADD', key, now, requestId)

            redis.call('EXPIRE', key, ttlSeconds)

            return {1, count + 1}
        
        else
            return {0, count}

        end

        ";

        /* 
        Description of LuaScript
        Rate limiting is read -> decide -> write; Lua allows this in one unbreakable step
        KEYS[1] the sorted set key for respective client
        ARGV[1] current time ms
        ARGV[2] window size ms
        ARGV[3] request limit
        ARGV[4] member id for respective request
        ARGV[5] TTL for key in seconds

        */

        public SlidingWindowService(
            IConnectionMultiplexer redis,
            IOptions<RateLimitOptions> options,
            ILogger<SlidingWindowService> logger)
    {
        _redis = redis;
        _options = options.Value;
        _logger = logger;
    }

     /// <summary>
    /// Checks whether the given client is within their rate limit.
    /// </summary>
    /// <param name="clientId">
    /// An arbitrary string identifying the caller —
    /// could be an API key, IP address, or user ID.
    /// </param>
    /// <param name="limit">
    /// Max requests allowed. If null, falls back to DefaultLimit
    /// from appsettings.json via RateLimitOptions.
    /// </param>
    /// <param name="windowSeconds">
    /// Window size in seconds. If null, falls back to DefaultWindowSeconds.
    /// </param>
    /// 
    public async Task<RateLimitResult> CheckAsync(
        string clientId,
        int?   limit         = null,
        int?   windowSeconds = null)
    {
        
        var effectiveLimit   = limit         ?? _options.DefaultLimit;
        var effectiveWindow  = windowSeconds ?? _options.DefaultWindowSeconds;
        var windowMs         = effectiveWindow * 1000L; // convert to milliseconds

        var key = $"ratelimiter:{clientId}"; // unique Redis key per client

        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(); // gets current time

        var requestId = Guid.NewGuid().ToString("N"); // Unique id for specific request

        var ttlSeconds = effectiveWindow + 10; // how long does redis keep the key

        try
        {
            var db = _redis.GetDatabase(); // reuse exisiting connection

            var result = await db.ScriptEvaluateAsync( // acutally running the LuaScript
                LuaScript,
                keys: new RedisKey[]   { key },
                values: new RedisValue[]
                {
                    nowMs,
                    windowMs,
                    effectiveLimit,
                    requestId,
                    ttlSeconds
                }
            );

            var resultArray = (RedisResult[])result!; 
            var allowed     = (int)resultArray[0] == 1; // is request allowed
            var count       = (int)resultArray[1]; // how many requests in window
            var remaining   = Math.Max(0, effectiveLimit - count); // how many requests client has left

            var retryAfterMs = allowed ? 0L : windowMs; // lets client know when it can make request again

            _logger.LogDebug(
                "Rate limit check — client: {ClientId}, allowed: {Allowed}, " +
                "count: {Count}/{Limit}, window: {Window}s",
                clientId, allowed, count, effectiveLimit, effectiveWindow);

            return new RateLimitResult(allowed, effectiveLimit, remaining, retryAfterMs);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Redis unavailable during rate limit check for client {ClientId}. " +
                "Failing open — request allowed.", clientId);

            return new RateLimitResult(
                IsAllowed:   true,
                Limit:       effectiveLimit,
                Remaining:   effectiveLimit,
                RetryAfterMs: 0
            );
        }
    }
}