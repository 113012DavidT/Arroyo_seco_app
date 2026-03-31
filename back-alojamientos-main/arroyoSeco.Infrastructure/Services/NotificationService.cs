using arroyoSeco.Application.Common.Interfaces;
using arroyoSeco.Domain.Entities.Notificaciones;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using arroyoSeco.Domain.Entities.Usuarios;
using WebPush;
using System.Text.Json;

namespace arroyoSeco.Infrastructure.Services;

public class NotificationService : INotificationService
{
    private readonly IAppDbContext _ctx;
    private readonly IEmailService _email;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ILogger<NotificationService> _logger;
    private readonly IConfiguration _configuration;

    public NotificationService(
        IAppDbContext ctx,
        IEmailService email,
        UserManager<ApplicationUser> userManager,
        IConfiguration configuration,
        ILogger<NotificationService> logger)
    {
        _ctx = ctx;
        _email = email;
        _userManager = userManager;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<int> PushAsync(
        string usuarioId,
        string titulo,
        string mensaje,
        string tipo,
        string? url = null,
        CancellationToken ct = default)
    {
        var n = new Notificacion
        {
            UsuarioId = usuarioId,
            Titulo = titulo,
            Mensaje = mensaje,
            Tipo = tipo,
            UrlAccion = url,
            Leida = false,
            Fecha = DateTime.UtcNow
        };

        _ctx.Notificaciones.Add(n);
        await _ctx.SaveChangesAsync(ct);

        // Obtener el email ANTES de lanzar la tarea de background (mientras UserManager aún está disponible)
        var user = await _userManager.FindByIdAsync(usuarioId);
        var userEmail = user?.Email;

        _logger.LogInformation($"Notificación creada [{n.Id}] para usuario {usuarioId}. Email: {userEmail ?? "NO DISPONIBLE"}");

        // Enviar correo de forma asíncrona (sin bloquear) - usar CancellationToken.None para que no se cancele con la request
        if (!string.IsNullOrWhiteSpace(userEmail))
        {
            _logger.LogInformation($"Lanzando tarea background para enviar email a {userEmail}");
            _ = Task.Run(async () =>
            {
                try
                {
                    _logger.LogInformation($"[BACKGROUND] Iniciando envío de email a {userEmail} para notificación {n.Id}");
                    await _email.SendNotificationEmailAsync(
                        userEmail,
                        titulo,
                        mensaje,
                        url,
                        CancellationToken.None);
                    _logger.LogInformation($"[BACKGROUND] Email enviado exitosamente a {userEmail}");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"[BACKGROUND] Error enviando email para notificación {n.Id}");
                }
            }, CancellationToken.None);
        }
        else
        {
            _logger.LogWarning($"No se puede enviar email: usuario {usuarioId} no tiene email registrado");
        }

        _ = Task.Run(async () =>
        {
            try
            {
                await SendWebPushAsync(usuarioId, titulo, mensaje, url, CancellationToken.None);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error enviando web push para notificación {NotificacionId}", n.Id);
            }
        }, CancellationToken.None);

        return n.Id;
    }

    public async Task MarkAsReadAsync(int id, string usuarioId, CancellationToken ct = default)
    {
        var n = await _ctx.Notificaciones.FindAsync(new object[] { id }, ct);
        if (n is null || n.UsuarioId != usuarioId) return;

        n.Leida = true;
        await _ctx.SaveChangesAsync(ct);
    }

    private async Task SendWebPushAsync(string usuarioId, string titulo, string mensaje, string? url, CancellationToken ct)
    {
        var publicKey = _configuration["Push:PublicKey"];
        var privateKey = _configuration["Push:PrivateKey"];
        var subject = _configuration["Push:Subject"] ?? "mailto:soporte@arroyoseco.local";

        if (string.IsNullOrWhiteSpace(publicKey) || string.IsNullOrWhiteSpace(privateKey))
            return;

        var subs = await _ctx.PushSubscriptions
            .Where(x => x.UsuarioId == usuarioId && x.Activa)
            .AsNoTracking()
            .ToListAsync(ct);

        if (subs.Count == 0) return;

        var client = new WebPushClient();
        var vapid = new VapidDetails(subject, publicKey, privateKey);

        var payload = JsonSerializer.Serialize(new
        {
            notification = new
            {
                title = string.IsNullOrWhiteSpace(titulo) ? "Arroyo Seco" : titulo,
                body = mensaje,
                icon = "/icons/icon-192x192.png",
                badge = "/icons/icon-72x72.png",
                data = new
                {
                    url = string.IsNullOrWhiteSpace(url) ? "/cliente/notificaciones" : url
                }
            }
        });

        foreach (var sub in subs)
        {
            var pushSub = new WebPush.PushSubscription(sub.Endpoint, sub.P256DH, sub.Auth);
            try
            {
                await client.SendNotificationAsync(pushSub, payload, vapid);
            }
            catch (WebPushException ex) when ((int)ex.StatusCode is 404 or 410)
            {
                var stale = await _ctx.PushSubscriptions.FirstOrDefaultAsync(x => x.Endpoint == sub.Endpoint, ct);
                if (stale is not null)
                {
                    stale.Activa = false;
                    await _ctx.SaveChangesAsync(ct);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo enviar push al endpoint {Endpoint}", sub.Endpoint);
            }
        }
    }
}