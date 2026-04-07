// Program.cs — Entry point for the ASP.NET Core application.
// In .NET 6+ the old Startup.cs pattern was replaced with this single file
// using the "minimal hosting model".
//
// Changes from Phase 1:
//   - Bound RateLimitOptions to the "RateLimiting" config section
//   - Registered SlidingWindowService with the DI container

using StackExchange.Redis;
using RateLimiter.Api.Configuration;
using RateLimiter.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// ----------------------------------------------------------------
// Redis connection
// Registered as a singleton — one shared connection for the
// lifetime of the app. StackExchange.Redis is designed this way;
// creating a new ConnectionMultiplexer per request is expensive
// and incorrect.
// Reference: https://stackexchange.github.io/StackExchange.Redis/Basics
// ----------------------------------------------------------------
var redisConnectionString = builder.Configuration["Redis:ConnectionString"]
    ?? throw new InvalidOperationException(
        "Redis:ConnectionString is not configured. " +
        "Check appsettings.json or environment variables.");

builder.Services.AddSingleton<IConnectionMultiplexer>(sp =>
{
    var config = ConfigurationOptions.Parse(redisConnectionString);
    config.AbortOnConnectFail = false; // retry instead of crash on startup
    return ConnectionMultiplexer.Connect(config);
});

// ----------------------------------------------------------------
// ADDITION 1: Bind RateLimitOptions to the "RateLimiting" section
// in appsettings.json.
//
// After this line, any class that declares a constructor parameter
// of IOptions<RateLimitOptions> will automatically receive the
// values from appsettings.json injected by the DI container.
//
// Reference: https://learn.microsoft.com/en-us/aspnet/core/fundamentals/configuration/options
// ----------------------------------------------------------------
builder.Services.Configure<RateLimitOptions>(
    builder.Configuration.GetSection(RateLimitOptions.SectionName)
);

// ----------------------------------------------------------------
// ADDITION 2: Register SlidingWindowService with the DI container.
//
// Scoped means one instance is created per HTTP request and
// disposed when the request ends.
//
// Why scoped and not singleton?
// The service itself holds no state between requests — all state
// lives in Redis. But scoped is safer than singleton here because
// it avoids any accidental state leaking between requests if the
// service ever grows. Singleton would also work functionally.
//
// Why not transient?
// Transient creates a new instance every time it's requested within
// the same request. Scoped is sufficient and slightly cheaper.
//
// Reference: https://learn.microsoft.com/en-us/aspnet/core/fundamentals/dependency-injection#service-lifetimes
// ----------------------------------------------------------------
builder.Services.AddScoped<SlidingWindowService>();

// ----------------------------------------------------------------
// Standard ASP.NET Core setup — unchanged from Phase 1
// ----------------------------------------------------------------
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new()
    {
        Title       = "RateLimiter API",
        Version     = "v1",
        Description = "A rate limiting service supporting multiple algorithms.",
    });
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("DevelopmentCors", policy =>
    {
        policy
            .WithOrigins("http://localhost:5173") // Vite default dev port
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "RateLimiter API v1");
        options.RoutePrefix = string.Empty; // Swagger UI at root: http://localhost:8080
    });
}

// ----------------------------------------------------------------
// Middleware pipeline — order is intentional.
// 1. CORS        — handles preflight OPTIONS before anything else
// 2. HTTPS       — redirect HTTP to HTTPS
// 3. Auth        — placeholder for future auth middleware
// 4. Controllers — route to the right controller action
// ----------------------------------------------------------------
app.UseCors("DevelopmentCors");
app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();