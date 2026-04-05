// HealthController.cs
// A simple health check endpoint that verifies two things:
// 1. The API itself is running
// 2. The Redis connection is alive
//
// This is the first endpoint we're building because it lets us
// verify the entire Docker stack is wired up correctly before
// writing any rate limiting logic.
//
// In production, Azure Container Apps will ping /health to decide
// whether to route traffic to this container or restart it.

using Microsoft.AspNetCore.Mvc;
using StackExchange.Redis;

namespace RateLimiter.Api.Controllers;

[ApiController] // Marks as API controller


[Route("api/[controller]")]
public class HealthController : ControllerBase // Our controller which inherits from ControllerBase
{
    private readonly IConnectionMultiplexer _redis; // Holds Redis connection
    private readonly ILogger<HealthController> _logger; // Holds the llooger

    public HealthController(
        IConnectionMultiplexer redis, // DI injects the Redis
        ILogger<HealthController> logger) // DI injects the Logger
    {
        _redis = redis; // injection stored
        _logger = logger; // injection stored
    }

    // GET api/health
    // Returns 200 OK if both the API and Redis are healthy.
    // Returns 503 Service Unavailable if Redis is unreachable.
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> GetHealth()
    {
        try
        {
            // Ping Redis to verify the connection is alive.
            // This is a lightweight command — Redis responds with "PONG".
            var db = _redis.GetDatabase();
            var pingResult = await db.PingAsync();

            _logger.LogInformation("Health check passed. Redis ping: {PingMs}ms",
                pingResult.TotalMilliseconds);

            return Ok(new
            {
                status = "healthy",
                redis = new
                {
                    connected = true,
                    pingMs = Math.Round(pingResult.TotalMilliseconds, 2)
                },
                timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            // Log the full exception internally but don't expose
            // internal error details in the response body.
            _logger.LogError(ex, "Health check failed — Redis unreachable");

            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                status = "unhealthy",
                redis = new
                {
                    connected = false,
                    pingMs = (double?)null
                },
                timestamp = DateTime.UtcNow
            });
        }
    }
}