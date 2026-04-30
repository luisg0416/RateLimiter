// Program.cs — Entry point for the ASP.NET Core application.
// In .NET 6+ the old Startup.cs pattern was replaced with this single file
// using the "minimal hosting model".
//
// Changes from Phase 1:
//   - Bound RateLimitOptions to the "RateLimiting" config section
//   - Registered SlidingWindowService with the DI container
//
// Changes from Phase 4:
//   - Added ProductionCors policy for Azure Static Web Apps origin
//   - CORS policy is selected based on the current environment

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
// Bind RateLimitOptions to the "RateLimiting" section
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
// Register services with the DI container.
//
// Scoped means one instance is created per HTTP request and
// disposed when the request ends.
//
// Reference: https://learn.microsoft.com/en-us/aspnet/core/fundamentals/dependency-injection#service-lifetimes
// ----------------------------------------------------------------
builder.Services.AddScoped<SlidingWindowService>();
builder.Services.AddScoped<TokenBucketService>();
builder.Services.AddScoped<ClientConfigService>();

// ----------------------------------------------------------------
// Standard ASP.NET Core setup
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

// ----------------------------------------------------------------
// CORS policies
//
// Two policies — one for local development, one for production.
// The correct policy is selected in the middleware pipeline below
// based on the current environment.
//
// DevelopmentCors — allows requests from the Vite dev server
// ProductionCors  — allows requests from Azure Static Web Apps
//
// Reference: https://learn.microsoft.com/en-us/aspnet/core/security/cors
// ----------------------------------------------------------------
builder.Services.AddCors(options =>
{
    options.AddPolicy("DevelopmentCors", policy =>
    {
        policy
            .WithOrigins("http://localhost:5173") // Vite default dev port
            .AllowAnyHeader()
            .AllowAnyMethod();
    });

    options.AddPolicy("ProductionCors", policy =>
    {
        policy
            .WithOrigins("https://gentle-bush-034e0e40f.7.azurestaticapps.net")
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
//
// CORS policy is selected based on the current environment:
// Development → DevelopmentCors (localhost:5173)
// Production  → ProductionCors  (Azure Static Web Apps URL)
// ----------------------------------------------------------------
app.UseCors(app.Environment.IsDevelopment() ? "DevelopmentCors" : "ProductionCors");
app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();