using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace arroyoSeco.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UbicacionController : ControllerBase
{
    private readonly IHttpClientFactory _httpFactory;
    private readonly IMemoryCache _cache;
    private static readonly Regex CpRegex = new(@"^\d{5}$", RegexOptions.Compiled);
    private static readonly TimeSpan CpCacheTtl = TimeSpan.FromHours(24);

    public UbicacionController(IHttpClientFactory httpFactory, IMemoryCache cache)
    {
        _httpFactory = httpFactory;
        _cache = cache;
    }

    [AllowAnonymous]
    [HttpGet("cp/{cp}")]
    [ResponseCache(Duration = 86400, VaryByHeader = "none")]
    public async Task<IActionResult> GetCpInfo(string cp)
    {
        var cleanCp = (cp ?? "").Trim();
        if (!CpRegex.IsMatch(cleanCp))
            return BadRequest(new { message = "El código postal debe tener exactamente 5 dígitos." });

        var cacheKey = $"ubicacion:cp:{cleanCp}";
        if (_cache.TryGetValue(cacheKey, out CpInfoResponse? cached) && cached != null)
            return Ok(cached);

        var httpClient = _httpFactory.CreateClient("sepomex");
        JsonElement root;
        try
        {
            var response = await httpClient.GetAsync(
                $"https://api-sepomex.hckdrk.mx/query/info_cp/{cleanCp}",
                HttpContext.RequestAborted);

            if (!response.IsSuccessStatusCode)
                return NotFound(new { message = "CP no encontrado." });

            var json = await response.Content.ReadAsStringAsync();
            root = JsonSerializer.Deserialize<JsonElement>(json);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { message = "No se pudo consultar el servicio postal en este momento." });
        }

        if (!root.TryGetProperty("error", out var errorEl) || errorEl.GetBoolean())
            return NotFound(new { message = "CP no encontrado." });

        if (!root.TryGetProperty("response", out var responsesEl) || responsesEl.ValueKind != JsonValueKind.Array)
            return NotFound(new { message = "CP no encontrado." });

        var entries = responsesEl.EnumerateArray().ToList();
        if (entries.Count == 0)
            return NotFound(new { message = "CP no encontrado." });

        var first = entries[0];
        var estado = first.TryGetProperty("d_estado", out var eEl) ? eEl.GetString() ?? "" : "";
        var municipio = first.TryGetProperty("D_mnpio", out var mEl) ? mEl.GetString() ?? "" : "";

        var colonias = entries
            .Select(e => e.TryGetProperty("d_asenta", out var aEl) ? aEl.GetString()?.Trim() ?? "" : "")
            .Where(c => c.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(c => c, StringComparer.CurrentCultureIgnoreCase)
            .ToList();

        var result = new CpInfoResponse(cleanCp, estado, municipio, colonias);
        _cache.Set(cacheKey, result, CpCacheTtl);

        return Ok(result);
    }

    private sealed record CpInfoResponse(string Cp, string Estado, string Municipio, List<string> Colonias);
}
