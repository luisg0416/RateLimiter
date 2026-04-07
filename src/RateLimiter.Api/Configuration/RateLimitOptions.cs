namespace RateLimiter.Api.Configuration;

public class RateLimitOptions
{
    public const string SectionName = "RateLimiting";

    public int DefaultLimit { get; set; } = 100;

    public int DefaultWindowSeconds {get; set; } = 60;

    public string Algorithm { get; set; } = "SlidingWindow";
}

/* 
 Why does this file exist?
 1. Type safety; no longer reading from config and casting ourselves

 2. If we want to change values all we have to do is change it here.            
            */