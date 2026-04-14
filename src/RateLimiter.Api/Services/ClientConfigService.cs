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

    public async Task<IReadOnlyList<ClientConfig>> GetAllAsync()
    {
        try
        {
            var endpoint = _redis.GetEndPoints().First();
            var server = _redis.GetServer(endpoint);

            var keys = server.Keys(pattern: $"{KeyPrefix}*").ToArray();

            if (keys.Length == 0)
            {
                return Array.Empty<ClientConfig>();
            } 

            var db = _redis.GetDatabase();
            var values = await db.StringGetAsync(keys);
            var configs = new List<ClientConfig>(keys.Length);

            foreach (var value in values)
            {
                if (value.IsNullOrEmpty)
                {
                    continue;
                }

                var config = JsonSerializer.Deserialize<ClientConfig>((string)value!, JsonOptions);

                if (config is not null)
                {
                    configs.Add(config);
                }
            }
            return configs;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve all client configs");

            return Array.Empty<ClientConfig>();
        }
    }
public async Task<bool> CreateAsync(ClientConfig config)
    {
        try
        {
            config.CreatedAt = DateTimeOffset.UtcNow;
            config.UpdatedAt = DateTimeOffset.UtcNow;
 
            var db   = _redis.GetDatabase();
            var key  = BuildKey(config.ClientId);
            var json = JsonSerializer.Serialize(config, JsonOptions);
 
            var created = await db.StringSetAsync(key, json, when: When.NotExists);
 
            if (created)
            {
                _logger.LogInformation(
                    "Created config for client {ClientId} — algorithm: {Algorithm}, limit: {Limit}",
                    config.ClientId, config.Algorithm, config.Limit);
            }
            else
            {
                _logger.LogWarning(
                    "Create failed — config already exists for client {ClientId}",
                    config.ClientId);
            }
 
            return created;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create config for client {ClientId}", config.ClientId);
            return false;
        }
    }
 
    public async Task<bool> UpdateAsync(ClientConfig config)
    {
        try
        {
            var db  = _redis.GetDatabase();
            var key = BuildKey(config.ClientId);
 
            var exists = await db.KeyExistsAsync(key);
 
            if (!exists)
            {
                _logger.LogWarning(
                    "Update failed — no config found for client {ClientId}",
                    config.ClientId);
                return false;
            }
 
            // Stamp the update time — CreatedAt is left as-is.
            config.UpdatedAt = DateTimeOffset.UtcNow;
 
            var json = JsonSerializer.Serialize(config, JsonOptions);
 
            // StringSetAsync with When.Always overwrites unconditionally.
            await db.StringSetAsync(key, json, when: When.Always);
 
            _logger.LogInformation(
                "Updated config for client {ClientId}",
                config.ClientId);
 
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update config for client {ClientId}", config.ClientId);
            return false;
        }
    }
 
    public async Task<bool> DeleteAsync(string clientId)
    {
        try
        {
            var db  = _redis.GetDatabase();
            var key = BuildKey(clientId);
 
            var deleted = await db.KeyDeleteAsync(key);
 
            if (deleted)
            {
                _logger.LogInformation("Deleted config for client {ClientId}", clientId);
            }
            else
            {
                _logger.LogWarning(
                    "Delete failed — no config found for client {ClientId}",
                    clientId);
            }
 
            return deleted;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete config for client {ClientId}", clientId);
            return false;
        }
    }
}