using System.Text.Json;
using RateLimiter.Api.Models;
using StackExchange.Redis;

namespace RateLimiter.Api.Services;

public class ClientConfigService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<ClientConfigService> _logger;

    private const string KeyPrefix = "ratelimiter:config:";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
        PropertyNameCaseInsensitive = true,
    };

    public ClientConfigService(IConnectionMultiplexer redis, ILogger<ClientConfigService> logger)
    {
        _redis = redis;
        _logger = logger;
    }

    private static string BuildKey(string clientId) => $"{KeyPrefix}{clientId}";

    public async Task <ClientConfig?> GetAsync (string clientId)
    {
        try
        {
            var db = _redis.GetDatabase();
            var key = BuildKey(clientId);

            var json = await db.StringGetAsync(key);

            if (json.IsNullOrEmpty)
            {
                _logger.LogDebug("No vongih found for client {ClientId}", clientId);
                return null;
            }
            return JsonSerializer.Deserialize<ClientConfig>((string)json!, JsonOptions);
        } 
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to config for client {ClientId}", clientId);
            return null;
        }

    }
}