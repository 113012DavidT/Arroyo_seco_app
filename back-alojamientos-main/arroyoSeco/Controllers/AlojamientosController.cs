using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using arroyoSeco.Application.Common.Interfaces;
using arroyoSeco.Application.Features.Alojamiento.Commands.Crear;
using arroyoSeco.Domain.Entities.Alojamientos;
using AlojamientoEntity = arroyoSeco.Domain.Entities.Alojamientos.Alojamiento;

namespace arroyoSeco.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AlojamientosController : ControllerBase
{
    private readonly IAppDbContext _db;
    private readonly CrearAlojamientoCommandHandler _crear;
    private readonly ICurrentUserService _current;
    private readonly IStorageService _storage;

    public AlojamientosController(IAppDbContext db, CrearAlojamientoCommandHandler crear, ICurrentUserService current, IStorageService storage)
    {
        _db = db;
        _crear = crear;
        _current = current;
        _storage = storage;
    }

    // Público
    [AllowAnonymous]
    [HttpGet]
    [ResponseCache(Duration = 60, Location = ResponseCacheLocation.Any, VaryByHeader = "Accept")]
    public async Task<ActionResult<IEnumerable<AlojamientoEntity>>> List(CancellationToken ct)
        => Ok(await _db.Alojamientos
            .Include(a => a.Fotos)
            .AsNoTracking()
            .ToListAsync(ct));

    // Público
    [AllowAnonymous]
    [HttpGet("{id:int}")]
    [ResponseCache(Duration = 60, Location = ResponseCacheLocation.Any, VaryByHeader = "Accept")]
    public async Task<ActionResult<AlojamientoEntity>> GetById(int id, CancellationToken ct)
    {
        var a = await _db.Alojamientos
            .Include(x => x.Fotos)
            .Include(x => x.Reservas)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        return a is null ? NotFound() : Ok(a);
    }

    // Nuevo: rangos ocupados (Confirmada) para pintar en calendario
    [AllowAnonymous]
    [HttpGet("{id:int}/calendario")]
    public async Task<IActionResult> Calendario(int id, CancellationToken ct)
    {
        var rangos = await _db.Reservas
            .Where(r => r.AlojamientoId == id && r.Estado == "Confirmada")
            .Select(r => new { inicio = r.FechaEntrada, fin = r.FechaSalida })
            .AsNoTracking()
            .ToListAsync(ct);

        return Ok(rangos);
    }

    // Solo Oferente autenticado: obtiene sus alojamientos
    [Authorize(Roles = "Oferente")]
    [HttpGet("mios")]
    public async Task<ActionResult<IEnumerable<AlojamientoEntity>>> MisAlojamientos(CancellationToken ct)
    {
        var userId = _current.UserId;
        var items = await _db.Alojamientos
            .Where(a => a.OferenteId == userId)
            .Include(a => a.Fotos)
            .Include(a => a.Reservas)
            .AsNoTracking()
            .ToListAsync(ct);

        return Ok(items);
    }

    // Solo Oferente autenticado
    [Authorize(Roles = "Oferente")]
    [HttpPost]
    public async Task<ActionResult<int>> Crear([FromBody] CrearAlojamientoCommand cmd, CancellationToken ct)
    {
        var id = await _crear.Handle(cmd, ct);
        return CreatedAtAction(nameof(GetById), new { id }, id);
    }

    public record ActualizarAlojamientoDto(string Nombre, string Ubicacion, double? Latitud, double? Longitud, string? Direccion, int MaxHuespedes, int Habitaciones, int Banos, decimal PrecioPorNoche, List<string>? Amenidades, string? FotoPrincipal, List<string>? FotosUrls);

    // Solo Oferente
    [Authorize(Roles = "Oferente")]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] ActualizarAlojamientoDto dto, CancellationToken ct)
    {
        if (dto.PrecioPorNoche < 1)
            return BadRequest(new { message = "El precio por noche debe ser mayor o igual a 1.00" });

        var a = await _db.Alojamientos
            .Include(x => x.Fotos)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (a is null) return NotFound();

        a.Nombre = dto.Nombre;
        a.Ubicacion = dto.Ubicacion;
        a.Latitud = dto.Latitud;
        a.Longitud = dto.Longitud;
        a.Direccion = dto.Direccion;
        a.MaxHuespedes = dto.MaxHuespedes;
        a.Habitaciones = dto.Habitaciones;
        a.Banos = dto.Banos;
        a.PrecioPorNoche = dto.PrecioPorNoche;
        a.Amenidades = dto.Amenidades ?? new List<string>();
        a.FotoPrincipal = dto.FotoPrincipal;

        if (dto.FotosUrls is not null)
        {
            _db.FotosAlojamiento.RemoveRange(a.Fotos);
            a.Fotos = dto.FotosUrls
                .Where(url => !string.IsNullOrWhiteSpace(url))
                .Select((url, index) => new FotoAlojamiento
                {
                    Url = url.Trim(),
                    Orden = index + 1
                })
                .ToList();
        }

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [AllowAnonymous]
    [HttpGet("{id:int}/fotos")]
    public async Task<ActionResult<IEnumerable<FotoAlojamiento>>> ListFotos(int id, CancellationToken ct)
    {
        var exists = await _db.Alojamientos.AnyAsync(a => a.Id == id, ct);
        if (!exists) return NotFound();

        var fotos = await _db.FotosAlojamiento
            .Where(f => f.AlojamientoId == id)
            .OrderBy(f => f.Orden)
            .AsNoTracking()
            .ToListAsync(ct);

        return Ok(fotos);
    }

    [Authorize(Roles = "Oferente")]
    [HttpPost("{id:int}/fotos")]
    [RequestSizeLimit(25_000_000)]
    public async Task<ActionResult<IEnumerable<FotoAlojamiento>>> UploadFotos(int id, [FromForm] List<IFormFile> files, CancellationToken ct)
    {
        var alojamiento = await _db.Alojamientos
            .Include(a => a.Fotos)
            .FirstOrDefaultAsync(a => a.Id == id, ct);
        if (alojamiento is null) return NotFound();
        if (alojamiento.OferenteId != _current.UserId) return Forbid();
        if (files is null || files.Count == 0) return BadRequest(new { message = "Debes enviar al menos una imagen" });

        var nextOrder = alojamiento.Fotos.Count == 0 ? 1 : alojamiento.Fotos.Max(f => f.Orden) + 1;
        var created = new List<FotoAlojamiento>();

        foreach (var file in files.Where(f => f.Length > 0))
        {
            await using var stream = file.OpenReadStream();
            var relativePath = await _storage.SaveFileAsync(stream, file.FileName, "fotos/alojamientos", ct);
            var foto = new FotoAlojamiento
            {
                AlojamientoId = id,
                Url = _storage.GetPublicUrl(relativePath),
                Orden = nextOrder++
            };
            created.Add(foto);
            _db.FotosAlojamiento.Add(foto);
        }

        if (created.Count == 0) return BadRequest(new { message = "Los archivos enviados están vacíos" });

        if (string.IsNullOrWhiteSpace(alojamiento.FotoPrincipal))
        {
            alojamiento.FotoPrincipal = created[0].Url;
        }

        await _db.SaveChangesAsync(ct);
        return Ok(created);
    }

    [Authorize(Roles = "Oferente")]
    [HttpDelete("{id:int}/fotos/{fotoId:int}")]
    public async Task<IActionResult> DeleteFoto(int id, int fotoId, CancellationToken ct)
    {
        var alojamiento = await _db.Alojamientos
            .Include(a => a.Fotos)
            .FirstOrDefaultAsync(a => a.Id == id, ct);
        if (alojamiento is null) return NotFound();
        if (alojamiento.OferenteId != _current.UserId) return Forbid();

        var foto = alojamiento.Fotos.FirstOrDefault(f => f.Id == fotoId);
        if (foto is null) return NotFound();

        _db.FotosAlojamiento.Remove(foto);

        var relativePath = foto.Url.Replace("/comprobantes/", string.Empty).Replace('/', Path.DirectorySeparatorChar);
        await _storage.DeleteFileAsync(relativePath, ct);

        if (string.Equals(alojamiento.FotoPrincipal, foto.Url, StringComparison.OrdinalIgnoreCase))
        {
            alojamiento.FotoPrincipal = alojamiento.Fotos
                .Where(f => f.Id != fotoId)
                .OrderBy(f => f.Orden)
                .Select(f => f.Url)
                .FirstOrDefault();
        }

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // Solo Oferente
    [Authorize(Roles = "Oferente")]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var a = await _db.Alojamientos.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (a is null) return NotFound();
        _db.Alojamientos.Remove(a);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}