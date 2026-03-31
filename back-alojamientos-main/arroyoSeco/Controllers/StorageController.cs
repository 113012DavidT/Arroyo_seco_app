using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using arroyoSeco.Application.Common.Interfaces;

namespace arroyoSeco.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StorageController : ControllerBase
{
    private static readonly HashSet<string> AllowedImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp", ".gif"
    };

    private readonly IStorageService _storage;

    public StorageController(IStorageService storage)
    {
        _storage = storage;
    }

    [Authorize]
    [HttpPost("upload")]
    public async Task<ActionResult<string>> Upload([FromForm] IFormFile file, [FromQuery] string folder = "general", CancellationToken ct = default)
    {
        if (file == null || file.Length == 0)
            return BadRequest("Archivo vacío");

        if (!IsImageFile(file))
            return BadRequest(new { message = "Solo se permiten archivos de imagen (jpg, jpeg, png, webp, gif)" });

        using var stream = file.OpenReadStream();
        var relativePath = await _storage.SaveFileAsync(stream, file.FileName, folder, ct);
        var publicUrl = _storage.GetPublicUrl(relativePath);
        return Ok(new { url = publicUrl });
    }

    private static bool IsImageFile(IFormFile file)
    {
        if (file is null || string.IsNullOrWhiteSpace(file.ContentType))
            return false;

        if (!file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            return false;

        var ext = Path.GetExtension(file.FileName);
        return !string.IsNullOrWhiteSpace(ext) && AllowedImageExtensions.Contains(ext);
    }
}
