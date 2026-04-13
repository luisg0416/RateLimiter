using Microsoft.AspNetCore.Mvc;
using RateLimiter.Api.Services;
using RateLimiter.Api.Models;

namespace RateLimiter.Api.Controllers;

[ApiController]
[Route("api/admin/clients")]

public class ClientConfigController : ControllerBase
{
    private readonly ClientConfigService _clientConfig;
    private readonly ILogger<ClientConfigController> _logger;

    public ClientConfigController(ClientConfigService clientConfig, ILogger<ClientConfigController> logger)
    {
        _clientConfig = clientConfig;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetAllConfigs()
    {
        var result = await _clientConfig.GetAllAsync();
        return Ok(result);
    }


    [HttpGet("{clientId}")]
    public async Task<IActionResult> GetById(string clientId) 
    {
    var config = await _clientConfig.GetAsync(clientId);

    if (config is null)
    {
        return NotFound(new { error = $"No config found for client {clientId}" });
    }

    return Ok(config);
    }

    [HttpPost]
    public async Task<IActionResult> PostConfig([FromBody] ClientConfig config)
    {

        if (string.IsNullOrWhiteSpace(config.ClientId)) 
        {
            return BadRequest(new { error = "ClientId is required." });
        }

        var client = await _clientConfig.CreateAsync(config);

        if (!client)
        {
            return StatusCode(StatusCodes.Status409Conflict, "Configuration of client already exists");
        }

        return CreatedAtAction(nameof(GetById), new { clientId = config.ClientId }, config);
    }


    [HttpPut("{clientId}")]
    public async Task<IActionResult> PutConfig(string clientId, [FromBody] ClientConfig client)
    {

        if (string.IsNullOrWhiteSpace(clientId)) 
        {
            return BadRequest(new { error = "ClientId is required." });
        }

        if (client.ClientId != clientId) 
        {
            return BadRequest(new { error = "ClientId in URL must match ClientId in body." });
        }
        
        var updatedConfig = await _clientConfig.UpdateAsync(client);

        if (updatedConfig)
        {
            return Ok(client);
        }
        else
        {
            return NotFound(new { error = $"No config found for client {clientId}" });
        }
    }


    [HttpDelete("{clientId}")]
    public async Task<IActionResult> DeleteConfig(string clientId)
    {
        if (string.IsNullOrWhiteSpace(clientId)) 
            {
                return BadRequest(new { error = "ClientId is required." });
            }

            
        var deletedConfig = await _clientConfig.DeleteAsync(clientId);

        if (deletedConfig)
            {
                return NoContent();
            }
        else
            {
                return NotFound(new { error = $"No config found for client {clientId}" });
            }
    }

}