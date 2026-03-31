using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using arroyoSeco.Application.Common.Interfaces;
using arroyoSeco.Domain.Entities.Notificaciones;

namespace arroyoSeco.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PushController : ControllerBase
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUserService _current;
    private readonly IConfiguration _configuration;
    private readonly INotificationService _notifications;

    public PushController(
        IAppDbContext db,
        ICurrentUserService current,
        IConfiguration configuration,
        INotificationService notifications)
    {
        _db = db;
        _current = current;
        _configuration = configuration;
        _notifications = notifications;
    }

    public record SubscribeDto(string Endpoint, string P256dh, string Auth, string? UserAgent);
    public record UnsubscribeDto(string Endpoint);

    [AllowAnonymous]
    [HttpGet("public-key")]
    public IActionResult GetPublicKey()
    {
        var publicKey = _configuration["Push:PublicKey"];
        if (string.IsNullOrWhiteSpace(publicKey))
            return NotFound(new { message = "Push key no configurada" });

        return Ok(new { publicKey });
    }

    [Authorize]
    [HttpPost("subscribe")]
    public async Task<IActionResult> Subscribe([FromBody] SubscribeDto dto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_current.UserId))
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(dto.Endpoint) || string.IsNullOrWhiteSpace(dto.P256dh) || string.IsNullOrWhiteSpace(dto.Auth))
            return BadRequest(new { message = "Datos de suscripcion incompletos" });

        var existing = await _db.PushSubscriptions.FirstOrDefaultAsync(x => x.Endpoint == dto.Endpoint, ct);
        if (existing is null)
        {
            _db.PushSubscriptions.Add(new PushSubscription
            {
                UsuarioId = _current.UserId,
                Endpoint = dto.Endpoint,
                P256DH = dto.P256dh,
                Auth = dto.Auth,
                UserAgent = dto.UserAgent,
                Activa = true,
                FechaRegistroUtc = DateTime.UtcNow
            });
        }
        else
        {
            existing.UsuarioId = _current.UserId;
            existing.P256DH = dto.P256dh;
            existing.Auth = dto.Auth;
            existing.UserAgent = dto.UserAgent;
            existing.Activa = true;
            existing.FechaRegistroUtc = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "Suscripcion push registrada" });
    }

    [Authorize]
    [HttpPost("unsubscribe")]
    public async Task<IActionResult> Unsubscribe([FromBody] UnsubscribeDto dto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_current.UserId))
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(dto.Endpoint))
            return BadRequest(new { message = "Endpoint requerido" });

        var item = await _db.PushSubscriptions
            .FirstOrDefaultAsync(x => x.UsuarioId == _current.UserId && x.Endpoint == dto.Endpoint, ct);

        if (item is null) return NotFound();

        item.Activa = false;
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "Suscripcion desactivada" });
    }

    [Authorize]
    [HttpPost("test")]
    public async Task<IActionResult> SendTest(CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_current.UserId))
            return Unauthorized();

        await _notifications.PushAsync(
            _current.UserId,
            "Prueba de notificacion push",
            "Las notificaciones push de la PWA estan activas correctamente.",
            "PushTest",
            "/cliente/notificaciones",
            ct);

        return Ok(new { message = "Push de prueba enviada" });
    }
}
