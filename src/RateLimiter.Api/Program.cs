// Program.cs — Entry point for the ASP.NET Core application.
// In .NET 6+ the old Startup.cs pattern was replaced with this single file
// using the "minimal hosting model".

using System.ComponentModel;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args); // setup/configuartion object for we app

// Make redisConnectionString equal to our connection string in appsettings.Development.json
// Port we're using for redis

var redisConnectionString = builder.Configuration["Redis:ConnectionString"]
?? throw new InvalidOperationException(
    "Redis:ConnectionString is not configured. " +
    "Check appsettings.json or environment variables.");



// Defines our connection
builder.Services.AddSingleton<IConnectionMultiplexer>(sp =>
{
    var config = ConfigurationOptions.Parse(redisConnectionString);
    config.AbortOnConnectFail = false; // App will try to continue to connect to Redis instead of crashing

    return ConnectionMultiplexer.Connect(config); // Returns connection to Redis
});

builder.Services.AddControllers(); // Provide data from endpoint to endpoint

builder.Services.AddEndpointsApiExplorer(); // exposes endpoint metadata
builder.Services.AddSwaggerGen(options => // generates the Swagger doc from that metadata
{
    options.SwaggerDoc("v1", new()
    {
        Title = "RateLimiter Api",
        Version = "v1",
        Description = "A rate limiting service supporting multiple algorithims",
    });
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("DevelopmentCors", policy =>
    {
        policy
            .WithOrigins("http://localhost:5173") // Vite's default dev server port
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});


// Add services to the container.

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "RateLimiter API v1");
        options.RoutePrefix = string.Empty;
    });
}

// ------------------------------------------------------------
// Middleware pipeline (order is intentional):
// 1. CORS  — must be before routing so preflight OPTIONS
//            requests are handled correctly
// 2. HTTPS — redirect any HTTP requests to HTTPS
// 3. Auth  — placeholder for future auth middleware
// 4. Controllers — route requests to the right controller
// ------------------------------------------------------------
app.UseCors("DevelopmentCors");
app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();


app.MapGet("/health", () => Results.Ok(new
{
    status = "healthy",
    timestamp = DateTime.UtcNow
}));

app.Run();