# Dockerfile for RateLimiter.Api
# Uses a multi-stage build to keep the final image small.
# Stage 1 (build) uses the full SDK image to compile the app.
# Stage 2 (runtime) uses the smaller runtime-only image to run it.
# This is the standard pattern for .NET in production containers.
# Reference: https://learn.microsoft.com/en-us/dotnet/core/docker/build-container

# ============================================================
# STAGE 1 — Build
# The SDK image includes the compiler, NuGet, and all build
# tools. It's large (~700MB) but we throw it away after build.
# ============================================================
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build

# Set the working directory inside the container
WORKDIR /src

# Copy the .csproj first and restore dependencies.
# We do this as a separate step before copying the rest of the
# code — Docker caches each layer, so as long as .csproj hasn't
# changed, it won't re-run dotnet restore on every build.
# This makes iterative builds much faster.
COPY src/RateLimiter.Api/RateLimiter.Api.csproj ./RateLimiter.Api/
RUN dotnet restore ./RateLimiter.Api/RateLimiter.Api.csproj

# Now copy the rest of the source code
COPY src/RateLimiter.Api/ ./RateLimiter.Api/

# Build and publish in Release mode.
# Output goes to /app/publish inside the container.
# --no-restore skips restore since we already did it above.
RUN dotnet publish ./RateLimiter.Api/RateLimiter.Api.csproj \
    --configuration Release \
    --output /app/publish

# ============================================================
# STAGE 2 — Runtime
# The ASP.NET runtime image is much smaller (~200MB) — it only
# contains what's needed to RUN the app, not build it.
# This is what actually gets deployed to Azure.
# ============================================================
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime

WORKDIR /app

# Copy only the published output from the build stage
COPY --from=build /app/publish .

# Port 8080 is the default for ASP.NET Core in containers.
# Azure Container Apps expects this port by default.
EXPOSE 8080

# Tell ASP.NET Core to listen on port 8080 inside the container.
# Without this it defaults to 5000/5001 which won't match EXPOSE.
ENV ASPNETCORE_URLS=http://+:8080

# Set to Production so Development-only middleware (Swagger UI
# at root, verbose logging) doesn't run in the container.
# We'll override this to Development in docker-compose for local dev.
ENV ASPNETCORE_ENVIRONMENT=Production

# The entrypoint — runs the compiled assembly when the container starts
ENTRYPOINT ["dotnet", "RateLimiter.Api.dll"]