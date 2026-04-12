namespace RateLimiter.Api.Models;

public class ClientConfig
{
    public required string ClientId { get; set; }
    public string? Name { get; set; }

    // Following functions are Rate Limiting Rules

    public int? Limit { get; set; }
    public int? WindowSeconds { get; set; }
    public string? Algorithm {get; set; }
    public double? RefillRatePerSecond { get; set; }

    // Metadata
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public bool IsEnabled { get; set; } = true;
    
}