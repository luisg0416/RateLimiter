using Microsoft.AspNetCore.Mvc;
using RateLimiter.Api.Services;
using RateLimiter.Api.Configuration;
using Microsoft.Extensions.Options;

namespace RateLimiter.Api.Controllers;

public record RateLimitCheckRequest(
    string ClientId,
    int? Limit = null,
    int? WindowSeconds = null,
    double? RefillRatePerSecond = null
);

public record RateLimitCheckResponse(
    bool   IsAllowed,      // true = go ahead, false = back off
    int    Limit,          // the configured max for this client
    int    Remaining,      // requests left in the current window
    long   RetryAfterMs,   // ms until the window resets (0 if allowed)
    string Message         // human-readable summary
);

[ApiController]
[Route("api/rate-limit")]
public class RateLimitController : ControllerBase
{
    private readonly SlidingWindowService _slidingWindow;
    private readonly TokenBucketService _tokenBucket;
    private readonly ClientConfigService _clientConfig;
    private readonly ILogger<RateLimitController> _logger;
    private readonly RateLimitOptions _options;

    public RateLimitController(
        SlidingWindowService slidingWindow, TokenBucketService tokenBucket, ClientConfigService clientConfig, ILogger<RateLimitController> logger, IOptions<RateLimitOptions> options)
    {
        _slidingWindow = slidingWindow;
        _tokenBucket = tokenBucket;
        _clientConfig = clientConfig;
        _logger = logger;
        _options = options.Value;
    }

    [HttpPost("check")]
    [ProducesResponseType(typeof(RateLimitCheckResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(RateLimitCheckResponse), StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Check([FromBody] RateLimitCheckRequest request)
    {

        if (string.IsNullOrWhiteSpace(request.ClientId))
        {
            return BadRequest(new { error = "ClientId is required." });
        }

        var config = await _clientConfig.GetAsync(request.ClientId);

        if (config is not null && !config.IsEnabled)
        {
            return StatusCode(StatusCodes.Status429TooManyRequests);
        }

        var algorithm = config?.Algorithm ?? _options.Algorithm;

        RateLimitResult result;

        if (algorithm == "SlidingWindow")
        {
            result = await _slidingWindow.CheckAsync(request.ClientId, config?.Limit ?? request.Limit, config?.WindowSeconds ?? request.WindowSeconds);
        }

        else if (algorithm == "TokenBucket")
        {
            result = await _tokenBucket.CheckAsync(request.ClientId, config?.Limit ?? request.Limit, config?.RefillRatePerSecond ?? request.RefillRatePerSecond);
        }

        else
        {
            return StatusCode(StatusCodes.Status429TooManyRequests);
        }


        // Build the response body — same shape regardless of outcome.
        var response = new RateLimitCheckResponse(
            IsAllowed:    result.IsAllowed,
            Limit:        result.Limit,
            Remaining:    result.Remaining,
            RetryAfterMs: result.RetryAfterMs,
            Message:      result.IsAllowed
                            ? $"Request allowed. {result.Remaining} requests remaining."
                            : $"Rate limit exceeded. Retry after {result.RetryAfterMs}ms."
        );

        if (result.IsAllowed)
        {
            return Ok(response); // 200
        }

        var retryAfterSeconds = (int)Math.Ceiling(result.RetryAfterMs / 1000.0);

        Response.Headers.Append("Retry-After", retryAfterSeconds.ToString());

        return StatusCode(StatusCodes.Status429TooManyRequests, response);
    }
}