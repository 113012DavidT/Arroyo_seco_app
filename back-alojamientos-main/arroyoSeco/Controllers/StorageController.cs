using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.Options;
using arroyoSeco.Application.Common.Interfaces;
using arroyoSeco.Infrastructure.Storage;

namespace arroyoSeco.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StorageController : ControllerBase
{
    private readonly IStorageService _storage;
    private readonly StorageOptions _storageOptions;
    private readonly FileExtensionContentTypeProvider _contentTypeProvider = new();

    public StorageController(IStorageService storage, IOptions<StorageOptions> storageOptions)
    {
        _storage = storage;
        _storageOptions = storageOptions.Value;
    }

    [Authorize]
    [HttpPost("upload")]
    public async Task<ActionResult<string>> Upload([FromForm] IFormFile file, [FromQuery] string folder = "general", CancellationToken ct = default)
    {
        if (file == null || file.Length == 0)
            return BadRequest("Archivo vacío");

        if (!IsImageFile(file))
            return BadRequest(new { message = "Solo se permiten archivos de imagen" });

        using var stream = file.OpenReadStream();
        var relativePath = await _storage.SaveFileAsync(stream, file.FileName, folder, ct);
        var publicUrl = _storage.GetPublicUrl(relativePath);
        return Ok(new { url = publicUrl });
    }

    [AllowAnonymous]
    [HttpGet("public/{**relativePath}")]
    public IActionResult GetPublicFile(string relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath))
            return BadRequest(new { message = "Ruta inválida" });

        var normalizedRelativePath = relativePath.Replace('/', Path.DirectorySeparatorChar);
        var rootPath = _storageOptions.ComprobantesPath;
        if (string.IsNullOrWhiteSpace(rootPath))
            return NotFound();

        var fullPath = Path.GetFullPath(Path.Combine(rootPath, normalizedRelativePath));
        var fullRootPath = Path.GetFullPath(rootPath);

        if (!fullPath.StartsWith(fullRootPath, StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Ruta inválida" });

        if (!System.IO.File.Exists(fullPath))
            return NotFound();

        if (!_contentTypeProvider.TryGetContentType(fullPath, out var contentType))
            contentType = "application/octet-stream";

        return PhysicalFile(fullPath, contentType, enableRangeProcessing: true);
    }

    private static bool IsImageFile(IFormFile file)
    {
        if (file is null || string.IsNullOrWhiteSpace(file.ContentType))
            return false;

        return file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase);
    }
}
