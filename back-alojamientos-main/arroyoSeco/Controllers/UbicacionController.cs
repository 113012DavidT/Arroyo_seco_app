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

        // Try multiple SEPOMEX provider URLs in order until one succeeds.
        var result = await TryIcaliaLabsAsync(cleanCp)
                  ?? await TryHckdrkAsync(cleanCp);

        if (result is null)
            return NotFound(new { message = "Código postal no encontrado." });

        _cache.Set(cacheKey, result, CpCacheTtl);
        return Ok(result);
    }

    // ── Provider 1: IcaliaLabs (generally the most available) ────────────────
    private async Task<CpInfoResponse?> TryIcaliaLabsAsync(string cp)
    {
        try
        {
            var client = _httpFactory.CreateClient("sepomex");
            var response = await client.GetAsync(
                $"https://sepomex.icalialabs.com/api/v1/zip_codes?zip_code={cp}");

            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync();
            var root = JsonSerializer.Deserialize<JsonElement>(json);

            if (!root.TryGetProperty("zip_codes", out var arr) || arr.ValueKind != JsonValueKind.Array)
                return null;

            var entries = arr.EnumerateArray().ToList();
            if (entries.Count == 0) return null;

            var first = entries[0];
            var estado    = first.TryGetProperty("d_estado", out var eEl) ? eEl.GetString() ?? "" : "";
            var municipio = first.TryGetProperty("D_mnpio",  out var mEl) ? mEl.GetString() ?? "" : "";

            var colonias = entries
                .Select(e => e.TryGetProperty("d_asenta", out var aEl) ? aEl.GetString()?.Trim() ?? "" : "")
                .Where(c => c.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(c => c, StringComparer.CurrentCultureIgnoreCase)
                .ToList();

            return colonias.Count > 0 ? new CpInfoResponse(cp, estado, municipio, colonias) : null;
        }
        catch
        {
            return null;
        }
    }

    // ── Provider 2: hckdrk.mx (original) ─────────────────────────────────────
    private async Task<CpInfoResponse?> TryHckdrkAsync(string cp)
    {
        try
        {
            var client = _httpFactory.CreateClient("sepomex");
            var response = await client.GetAsync(
                $"https://api-sepomex.hckdrk.mx/query/info_cp/{cp}");

            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync();
            var root = JsonSerializer.Deserialize<JsonElement>(json);

            if (!root.TryGetProperty("error", out var errorEl) || errorEl.GetBoolean())
                return null;

            if (!root.TryGetProperty("response", out var arr) || arr.ValueKind != JsonValueKind.Array)
                return null;

            var entries = arr.EnumerateArray().ToList();
            if (entries.Count == 0) return null;

            var first = entries[0];
            var estado    = first.TryGetProperty("d_estado", out var eEl) ? eEl.GetString() ?? "" : "";
            var municipio = first.TryGetProperty("D_mnpio",  out var mEl) ? mEl.GetString() ?? "" : "";

            var colonias = entries
                .Select(e => e.TryGetProperty("d_asenta", out var aEl) ? aEl.GetString()?.Trim() ?? "" : "")
                .Where(c => c.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(c => c, StringComparer.CurrentCultureIgnoreCase)
                .ToList();

            return colonias.Count > 0 ? new CpInfoResponse(cp, estado, municipio, colonias) : null;
        }
        catch
        {
            return null;
        }
    }

    private sealed record CpInfoResponse(string Cp, string Estado, string Municipio, List<string> Colonias);
}
