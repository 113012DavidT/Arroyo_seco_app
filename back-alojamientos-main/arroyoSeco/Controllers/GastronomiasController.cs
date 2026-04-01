using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using arroyoSeco.Application.Common.Interfaces;
using arroyoSeco.Application.Common.Helpers;
using arroyoSeco.Application.Common.Validation;
using arroyoSeco.Application.Features.Gastronomia.Commands.Crear;
using arroyoSeco.Domain.Entities.Gastronomia;
using arroyoSeco.Domain.Entities.Usuarios;
using arroyoSeco.Domain.Entities.Enums;
using EstablecimientoEntity = arroyoSeco.Domain.Entities.Gastronomia.Establecimiento;

namespace arroyoSeco.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GastronomiasController : ControllerBase
{
    private const string NeuronaBaseUrl = "http://34.51.58.191:5000";
    private const int MinNombreEstablecimiento = 3;
    private const int MaxNombreEstablecimiento = 120;
    private const int MinDescripcionEstablecimiento = 15;
    private const int MaxDescripcionEstablecimiento = 1000;
    private const int MaxModerationReasonLength = 250;
    private const string ReviewEstadoAprobada = "Aprobada";
    private const string ReviewEstadoRechazada = "Rechazada";
    private const string ReviewEstadoReportada = "Reportada";
    private const string ReviewEstadoReporteValido = "ReporteValido";
    private const string ReviewEstadoReporteNoValido = "ReporteNoValido";
    private const string ReviewEstadoEliminacionSolicitada = "EliminacionSolicitada";

    private readonly IAppDbContext _db;
    private readonly CrearEstablecimientoCommandHandler _crear;
    private readonly CrearMenuCommandHandler _crearMenu;
    private readonly AgregarMenuItemCommandHandler _agregarItem;
    private readonly CrearMesaCommandHandler _crearMesa;
    private readonly CrearReservaGastronomiaCommandHandler _crearReserva;
    private readonly ICurrentUserService _current;
    private readonly IStorageService _storage;
    private readonly INotificationService _notifications;
    private readonly UserManager<ApplicationUser> _userManager;

    public GastronomiasController(
        IAppDbContext db,
        CrearEstablecimientoCommandHandler crear,
        CrearMenuCommandHandler crearMenu,
        AgregarMenuItemCommandHandler agregarItem,
        CrearMesaCommandHandler crearMesa,
        CrearReservaGastronomiaCommandHandler crearReserva,
        ICurrentUserService current,
        IStorageService storage,
        INotificationService notifications,
        UserManager<ApplicationUser> userManager)
    {
        _db = db;
        _crear = crear;
        _crearMenu = crearMenu;
        _agregarItem = agregarItem;
        _crearMesa = crearMesa;
        _crearReserva = crearReserva;
        _current = current;
        _storage = storage;
        _notifications = notifications;
        _userManager = userManager;
    }

    [Authorize]
    [HttpPost("{id:int}/reviews")]
    public async Task<ActionResult<int>> CrearReview(int id, [FromBody] CrearReviewCommand cmd, CancellationToken ct)
    {
        if (cmd.Puntuacion < 1 || cmd.Puntuacion > 5)
            return BadRequest(new { message = "La puntuación debe estar entre 1 y 5" });
        if (string.IsNullOrWhiteSpace(cmd.Comentario))
            return BadRequest(new { message = "El comentario es obligatorio" });

        var comentarioLimpio = cmd.Comentario.Trim();
        if (ProfanityFilter.ContainsProfanity(comentarioLimpio, out _))
            return BadRequest(new { message = "Tu reseña contiene lenguaje inapropiado. Edita el comentario para poder publicarlo." });

        var exists = await _db.Establecimientos.AnyAsync(e => e.Id == id, ct);
        if (!exists)
            return NotFound(new { message = "Establecimiento no encontrado" });

        cmd.EstablecimientoId = id;
        cmd.UsuarioId = _current.UserId;
        cmd.Comentario = comentarioLimpio;

        try
        {
            using var client = new System.Net.Http.HttpClient();
            client.Timeout = TimeSpan.FromSeconds(5);
            var payload = new { puntuacion = cmd.Puntuacion, comentario = cmd.Comentario };
            var content = new System.Net.Http.StringContent(
                System.Text.Json.JsonSerializer.Serialize(payload),
                System.Text.Encoding.UTF8, "application/json");
            var response = await client.PostAsync("http://34.51.58.191:5000/predict", content, ct);
            if (response.IsSuccessStatusCode)
            {
                // ML enrichment is optional. We do not modify user-visible text here.
            }
        }
        catch
        {
            // Flask no disponible, guardar reseña igual sin clasificación
        }

        var handler = new CrearReviewCommandHandler(_db);
        var reviewId = await handler.Handle(cmd, ct);

        var establecimiento = await _db.Establecimientos
            .AsNoTracking()
            .Where(e => e.Id == id)
            .Select(e => new { e.Id, e.Nombre, e.OferenteId })
            .FirstOrDefaultAsync(ct);

        if (!string.IsNullOrWhiteSpace(establecimiento?.OferenteId))
        {
            await _notifications.PushAsync(
                establecimiento.OferenteId,
                "Nueva reseña publicada",
                $"Tu negocio {establecimiento.Nombre} recibió una nueva reseña.",
                "ReviewPublicada",
                "/oferente/gastronomia/analytics",
                ct);
        }

        return CreatedAtAction(nameof(GetReviews), new { id }, new { reviewId, estado = ReviewEstadoAprobada });
    }

    [AllowAnonymous]
    [HttpGet("{id:int}/reviews")]
    public async Task<ActionResult> GetReviews(int id, CancellationToken ct)
    {
        var reviews = await _db.Reviews
            .Where(r => r.EstablecimientoId == id && r.Estado != ReviewEstadoRechazada)
            .OrderByDescending(r => r.Fecha)
            .AsNoTracking()
            .ToListAsync(ct);
        return Ok(reviews);
    }

    [Authorize(Roles = "Oferente")]
    [HttpGet("reviews/mias")]
    public async Task<ActionResult> ListMisReviews(CancellationToken ct)
    {
        var reviews = await _db.Reviews
            .AsNoTracking()
            .Where(r => r.Establecimiento.OferenteId == _current.UserId && r.Estado != ReviewEstadoRechazada)
            .OrderByDescending(r => r.Fecha)
            .Select(r => new
            {
                r.Id,
                r.EstablecimientoId,
                EstablecimientoNombre = r.Establecimiento.Nombre,
                r.UsuarioId,
                r.Comentario,
                r.Puntuacion,
                r.Fecha,
                r.Estado,
                r.MotivoRechazo
            })
            .ToListAsync(ct);

        return Ok(reviews);
    }

    [Authorize(Roles = "Oferente")]
    [HttpPatch("reviews/{reviewId:int}/reportar")]
    public async Task<IActionResult> ReportarReview(int reviewId, [FromBody] ReportarReviewDto dto, CancellationToken ct)
    {
        var review = await _db.Reviews
            .Include(r => r.Establecimiento)
            .FirstOrDefaultAsync(r => r.Id == reviewId, ct);
        if (review is null)
            return NotFound(new { message = "Reseña no encontrada" });

        if (review.Establecimiento?.OferenteId != _current.UserId)
            return Forbid();

        if (review.Estado == ReviewEstadoReportada)
            return BadRequest(new { message = "La reseña ya fue reportada" });
        if (review.Estado == ReviewEstadoEliminacionSolicitada)
            return BadRequest(new { message = "La reseña ya tiene una solicitud de eliminación pendiente" });
        if (review.Estado == ReviewEstadoRechazada)
            return BadRequest(new { message = "No puedes reportar una reseña eliminada" });

        review.Estado = ReviewEstadoReportada;
        review.MotivoRechazo = BuildModerationReason("Reporte", dto.Motivo);
        review.FechaModeracionUtc = DateTime.UtcNow;
        review.ModeradaPorId = _current.UserId;
        await _db.SaveChangesAsync(ct);

        var admins = await _userManager.GetUsersInRoleAsync("Admin");
        foreach (var admin in admins)
        {
            await _notifications.PushAsync(
                admin.Id,
                "Reseña reportada por oferente",
                $"Se reportó una reseña en {review.Establecimiento?.Nombre ?? "un establecimiento"} y requiere revisión.",
                "ReporteReview",
                "/admin/gastronomia/notificaciones?tab=reportes",
                ct);
        }

        return NoContent();
    }

    [Authorize(Roles = "Oferente")]
    [HttpPatch("reviews/{reviewId:int}/solicitar-eliminacion")]
    public async Task<IActionResult> SolicitarEliminacionReview(int reviewId, [FromBody] ReportarReviewDto dto, CancellationToken ct)
    {
        var review = await _db.Reviews
            .Include(r => r.Establecimiento)
            .FirstOrDefaultAsync(r => r.Id == reviewId, ct);
        if (review is null)
            return NotFound(new { message = "Reseña no encontrada" });

        if (review.Establecimiento?.OferenteId != _current.UserId)
            return Forbid();

        if (review.Estado == ReviewEstadoEliminacionSolicitada)
            return BadRequest(new { message = "La reseña ya tiene una solicitud de eliminación pendiente" });
        if (review.Estado == ReviewEstadoReportada)
            return BadRequest(new { message = "La reseña ya fue reportada y está en revisión" });
        if (review.Estado == ReviewEstadoRechazada)
            return BadRequest(new { message = "La reseña ya fue eliminada" });

        var motivo = dto.Motivo?.Trim();
        if (string.IsNullOrWhiteSpace(motivo))
            return BadRequest(new { message = "Debes indicar el motivo para solicitar la eliminación" });

        review.Estado = ReviewEstadoEliminacionSolicitada;
        review.MotivoRechazo = BuildModerationReason("Solicitud eliminación", motivo);
        review.FechaModeracionUtc = DateTime.UtcNow;
        review.ModeradaPorId = _current.UserId;
        await _db.SaveChangesAsync(ct);

        var admins = await _userManager.GetUsersInRoleAsync("Admin");
        foreach (var admin in admins)
        {
            await _notifications.PushAsync(
                admin.Id,
                "Solicitud de eliminación de reseña",
                $"Se solicitó eliminar una reseña en {review.Establecimiento?.Nombre ?? "un establecimiento"} y requiere revisión.",
                "SolicitudEliminacionReview",
                "/admin/gastronomia/notificaciones?tab=reportes",
                ct);
        }

        return NoContent();
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("reviews/reportadas")]
    public async Task<ActionResult> ListReviewsReportadas(CancellationToken ct)
    {
        var reportadas = await _db.Reviews
            .AsNoTracking()
            .Where(r => r.Estado == ReviewEstadoReportada || r.Estado == ReviewEstadoEliminacionSolicitada)
            .OrderByDescending(r => r.FechaModeracionUtc ?? r.Fecha)
            .Select(r => new
            {
                r.Id,
                r.EstablecimientoId,
                EstablecimientoNombre = r.Establecimiento.Nombre,
                r.UsuarioId,
                r.Comentario,
                r.Puntuacion,
                r.Fecha,
                r.Estado,
                MotivoReporte = r.MotivoRechazo,
                TipoSolicitud = r.Estado == ReviewEstadoEliminacionSolicitada ? "Eliminacion" : "Reporte",
                r.ModeradaPorId,
                r.FechaModeracionUtc
            })
            .ToListAsync(ct);

        return Ok(reportadas);
    }

    [Authorize(Roles = "Admin")]
    [HttpPatch("reviews/{reviewId:int}/resolver-reporte")]
    public async Task<IActionResult> ResolverReporteReview(int reviewId, [FromBody] ResolverReporteReviewDto dto, CancellationToken ct)
    {
        var review = await _db.Reviews
            .Include(r => r.Establecimiento)
            .FirstOrDefaultAsync(r => r.Id == reviewId, ct);
        if (review is null)
            return NotFound(new { message = "Reseña no encontrada" });

        var esReporte = review.Estado == ReviewEstadoReportada;
        var esSolicitudEliminacion = review.Estado == ReviewEstadoEliminacionSolicitada;
        if (!esReporte && !esSolicitudEliminacion)
            return BadRequest(new { message = "La reseña no está en un estado pendiente de revisión" });

        if (esReporte)
        {
            review.Estado = dto.EsValido ? ReviewEstadoRechazada : ReviewEstadoReporteNoValido;
        }
        else
        {
            review.Estado = dto.EsValido ? ReviewEstadoRechazada : ReviewEstadoAprobada;
        }

        review.FechaModeracionUtc = DateTime.UtcNow;
        review.ModeradaPorId = _current.UserId;
        if (!string.IsNullOrWhiteSpace(dto.ComentarioAdmin))
            review.MotivoRechazo = AppendModerationReason(review.MotivoRechazo, $"Revision admin: {dto.ComentarioAdmin.Trim()}");

        await _db.SaveChangesAsync(ct);

        await _notifications.PushAsync(
            review.UsuarioId,
            "Tu reseña fue revisada",
            esReporte
                ? (dto.EsValido
                    ? "Tu reseña fue reportada y el admin confirmó el reporte, por lo que ya no se muestra públicamente."
                    : "Tu reseña fue reportada y el admin descartó el reporte.")
                : (dto.EsValido
                    ? "El admin aprobó la eliminación de tu reseña y ya no está publicada."
                    : "El admin rechazó la solicitud de eliminación y tu reseña sigue publicada."),
            "ReporteReview",
            $"/cliente/gastronomia/{review.EstablecimientoId}",
            ct);

        if (!string.IsNullOrWhiteSpace(review.Establecimiento?.OferenteId))
        {
            await _notifications.PushAsync(
                review.Establecimiento.OferenteId,
                esReporte ? "Reporte de reseña resuelto" : "Solicitud de eliminación resuelta",
                esReporte
                    ? (dto.EsValido
                        ? "El admin confirmó tu reporte de reseña y la ocultó del público."
                        : "El admin rechazó tu reporte de reseña.")
                    : (dto.EsValido
                        ? "El admin aprobó tu solicitud y la reseña fue eliminada."
                        : "El admin rechazó la solicitud de eliminación; la reseña sigue publicada."),
                "ReporteReview",
                "/oferente/gastronomia/analytics",
                ct);
        }

        return NoContent();
    }

    [AllowAnonymous]
    [HttpGet]
    [ResponseCache(Duration = 60, Location = ResponseCacheLocation.Any, VaryByHeader = "Accept")]
    public async Task<ActionResult<IEnumerable<EstablecimientoEntity>>> List(CancellationToken ct)
    {
        var establecimientos = await _db.Establecimientos
            .Include(e => e.Fotos)
            .Include(e => e.Menus)
            .Include(e => e.Mesas)
            .AsNoTracking()
            .ToListAsync(ct);

        NormalizeEstablecimientosPhotoUrls(establecimientos);
        return Ok(establecimientos);
    }

    [AllowAnonymous]
    [HttpGet("ranking")]
    [ResponseCache(Duration = 120, Location = ResponseCacheLocation.Any, VaryByHeader = "Accept")]
    public async Task<ActionResult<IEnumerable<GastronomiaRankingDto>>> ListRanking(CancellationToken ct)
    {
        var ranked = await BuildRankingAsync(ct);
        var response = ranked.Select(x => new GastronomiaRankingDto(
            x.est.Id,
            x.est.Nombre,
            x.est.Ubicacion,
            x.est.Descripcion,
            x.est.FotoPrincipal,
            x.clase,
            x.confidence,
            x.fuente,
            x.est.Reviews.Any(r => r.Estado != "Rechazada") ? x.est.Reviews.Where(r => r.Estado != "Rechazada").Average(r => r.Puntuacion) : 0,
            x.est.Reviews.Count(r => r.Estado != "Rechazada")
        )).ToList();

        return Ok(response);
    }

    [Authorize(Roles = "Oferente")]
    [HttpGet("analytics")]
    public async Task<ActionResult<GastronomiaAnalyticsDto>> GetAnalytics(CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_current.UserId))
            return Unauthorized();

        var establecimientoIds = _db.Establecimientos
            .AsNoTracking()
            .Where(e => e.OferenteId == _current.UserId)
            .Select(e => e.Id);

        var reviewsQuery = _db.Reviews
            .AsNoTracking()
            .Where(r => establecimientoIds.Contains(r.EstablecimientoId) && r.Estado != "Rechazada");

        var totalReviews = await reviewsQuery.CountAsync(ct);
        var ratingPromedio = totalReviews > 0
            ? await reviewsQuery.AverageAsync(r => (double)r.Puntuacion, ct)
            : 0;

        var distributionRaw = await reviewsQuery
            .GroupBy(r => r.Puntuacion)
            .Select(g => new { puntuacion = g.Key, total = g.Count() })
            .ToListAsync(ct);

        var distribution = Enumerable.Range(1, 5)
            .Select(p => new RatingDistributionDto(
                $"{p} estrella{(p == 1 ? string.Empty : "s")}",
                distributionRaw.FirstOrDefault(x => x.puntuacion == p)?.total ?? 0
            ))
            .ToList();

        var byEstablecimiento = await _db.Establecimientos
            .Include(e => e.Reviews)
            .AsNoTracking()
            .Where(e => e.OferenteId == _current.UserId && e.Reviews.Any(r => r.Estado != "Rechazada"))
            .Select(e => new EstablecimientoReviewStatsDto(
                e.Id,
                e.Nombre,
                e.Reviews.Where(r => r.Estado != "Rechazada").Average(r => (double)r.Puntuacion),
                e.Reviews.Count(r => r.Estado != "Rechazada")
            ))
            .ToListAsync(ct);

        var top5 = byEstablecimiento
            .OrderByDescending(x => x.Promedio)
            .ThenByDescending(x => x.TotalReviews)
            .Take(5)
            .ToList();

        var bottom5 = byEstablecimiento
            .OrderBy(x => x.Promedio)
            .ThenByDescending(x => x.TotalReviews)
            .Take(5)
            .ToList();

        var fromDate = DateTime.UtcNow.AddMonths(-5);
        var trendRaw = await reviewsQuery
            .Where(r => r.Fecha >= fromDate)
            .GroupBy(r => new { r.Fecha.Year, r.Fecha.Month })
            .Select(g => new
            {
                g.Key.Year,
                g.Key.Month,
                total = g.Count()
            })
            .ToListAsync(ct);

        var trend = trendRaw
            .OrderBy(x => x.Year)
            .ThenBy(x => x.Month)
            .Select(x => new ReviewsTrendPointDto($"{x.Year}-{x.Month:D2}", x.total))
            .ToList();

        return Ok(new GastronomiaAnalyticsDto(
            totalReviews,
            ratingPromedio,
            distribution,
            top5,
            bottom5,
            trend
        ));
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("admin/analytics")]
    public async Task<ActionResult<AdminGastronomiaAnalyticsDto>> GetAdminAnalytics(CancellationToken ct)
    {
        var totalEstablecimientos = await _db.Establecimientos.CountAsync(ct);
        var totalReservas = await _db.ReservasGastronomia.CountAsync(ct);
        var totalResenas = await _db.Reviews.CountAsync(r => r.Estado != ReviewEstadoRechazada, ct);
        var reportesPendientes = await _db.Reviews.CountAsync(r => r.Estado == ReviewEstadoReportada || r.Estado == ReviewEstadoEliminacionSolicitada, ct);
        var solicitudesPendientes = await _db.SolicitudesOferente.CountAsync(s => s.Estatus == "Pendiente" && s.TipoSolicitado == TipoOferente.Gastronomia, ct);

        var promedioCalificacion = totalResenas > 0
            ? await _db.Reviews.Where(r => r.Estado != ReviewEstadoRechazada).AverageAsync(r => (double)r.Puntuacion, ct)
            : 0;

        var reservasPorMesRaw = await _db.ReservasGastronomia
            .AsNoTracking()
            .Where(r => r.Fecha >= DateTime.UtcNow.AddMonths(-5))
            .GroupBy(r => new { r.Fecha.Year, r.Fecha.Month })
            .Select(g => new { g.Key.Year, g.Key.Month, Total = g.Count() })
            .OrderBy(g => g.Year)
            .ThenBy(g => g.Month)
            .ToListAsync(ct);

        var reservasPorMes = reservasPorMesRaw
            .Select(item => new AnalyticsBucketDto($"{item.Year}-{item.Month:D2}", item.Total))
            .ToList();

        var tipos = await _db.Establecimientos
            .AsNoTracking()
            .GroupBy(e => string.IsNullOrWhiteSpace(e.TipoEstablecimiento) ? "Sin categoría" : e.TipoEstablecimiento!)
            .Select(g => new AnalyticsBucketDto(g.Key, g.Count()))
            .OrderByDescending(item => item.Valor)
            .ToListAsync(ct);

        var reservaCounts = await _db.ReservasGastronomia
            .AsNoTracking()
            .GroupBy(r => r.EstablecimientoId)
            .Select(g => new { EstablecimientoId = g.Key, Total = g.Count() })
            .ToDictionaryAsync(item => item.EstablecimientoId, item => item.Total, ct);

        var reviewAverages = await _db.Reviews
            .AsNoTracking()
            .Where(r => r.Estado != ReviewEstadoRechazada)
            .GroupBy(r => r.EstablecimientoId)
            .Select(g => new { EstablecimientoId = g.Key, Promedio = g.Average(r => (double)r.Puntuacion) })
            .ToDictionaryAsync(item => item.EstablecimientoId, item => item.Promedio, ct);

        var topReservados = (await _db.Establecimientos
                .AsNoTracking()
                .Select(e => new
                {
                    e.Id,
                    e.Nombre,
                    Tipo = string.IsNullOrWhiteSpace(e.TipoEstablecimiento) ? "Sin categoría" : e.TipoEstablecimiento!
                })
                .ToListAsync(ct))
            .Select(e => new AdminTopEstablecimientoDto(
                e.Id,
                e.Nombre,
                e.Tipo,
                reservaCounts.TryGetValue(e.Id, out var totalReservas) ? totalReservas : 0,
                reviewAverages.TryGetValue(e.Id, out var promedio) ? promedio : 0
            ))
            .Where(item => item.TotalReservas > 0 || item.Promedio > 0)
            .OrderByDescending(item => item.TotalReservas)
            .ThenByDescending(item => item.Promedio)
            .Take(5)
            .ToList();

        List<(EstablecimientoEntity est, int clase, double confidence, string fuente)> ranking;
        try
        {
            ranking = await BuildRankingAsync(ct);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error building gastronomy admin ranking: {ex}");
            ranking = new();
        }

        var neurona = new NeuronaMetricsDto(
            ranking.Count,
            ranking.Count(item => item.fuente == "ml"),
            ranking.Count(item => item.fuente != "ml"),
            ranking.Count(item => item.clase == 2),
            ranking.Count(item => item.clase == 1),
            ranking.Count(item => item.clase == 0),
            ranking.Count == 0 ? 0 : ranking.Average(item => item.confidence)
        );

        return Ok(new AdminGastronomiaAnalyticsDto(
            totalEstablecimientos,
            totalReservas,
            totalResenas,
            promedioCalificacion,
            solicitudesPendientes,
            reportesPendientes,
            reservasPorMes,
            tipos,
            topReservados,
            neurona
        ));
    }

    private async Task<List<(EstablecimientoEntity est, int clase, double confidence, string fuente)>> BuildRankingAsync(CancellationToken ct)
    {
        var establecimientos = await _db.Establecimientos
            .Include(e => e.Fotos)
            .Include(e => e.Menus)
            .Include(e => e.Mesas)
            .Include(e => e.Reviews)
            .AsNoTracking()
            .ToListAsync(ct);

        var mlInput = establecimientos.Select(est =>
        {
            var reviewsAprobadas = est.Reviews.Where(r => r.Estado != "Rechazada").ToList();
            var avgPuntuacion = reviewsAprobadas.Count > 0 ? reviewsAprobadas.Average(r => r.Puntuacion) : 3.0;
            var lastComentario = reviewsAprobadas.Count > 0
                ? reviewsAprobadas.OrderByDescending(r => r.Fecha).First().Comentario
                : "sin reseñas";
            return new { puntuacion = avgPuntuacion, comentario = lastComentario };
        }).ToList();

        var fallback = establecimientos
            .Select(est =>
            {
                var reviewsAprobadas = est.Reviews.Where(r => r.Estado != "Rechazada").ToList();
                var avg = reviewsAprobadas.Count > 0 ? reviewsAprobadas.Average(r => r.Puntuacion) : 0;
                var clase = avg >= 4.0 ? 2 : (avg >= 2.5 ? 1 : 0);
                return (est, clase, confidence: avg / 5.0, fuente: "fallback");
            })
            .OrderByDescending(x => x.clase)
            .ThenByDescending(x => x.confidence)
            .ToList();

        try
        {
            using var http = new System.Net.Http.HttpClient();
            http.Timeout = TimeSpan.FromSeconds(5);
            var content = new System.Net.Http.StringContent(
                System.Text.Json.JsonSerializer.Serialize(mlInput),
                System.Text.Encoding.UTF8, "application/json");
            var response = await http.PostAsync($"{NeuronaBaseUrl}/score-batch", content, ct);
            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync(ct);
                using var doc = System.Text.Json.JsonDocument.Parse(json);
                var scores = doc.RootElement.EnumerateArray()
                    .Select(el => (
                        clase: el.GetProperty("clase").GetInt32(),
                        confidence: el.GetProperty("confidence").GetDouble()
                    )).ToList();

                if (scores.Count == establecimientos.Count)
                {
                    return establecimientos
                    .Zip(scores, (e, s) => (est: e, s.clase, s.confidence, fuente: "ml"))
                    .OrderByDescending(x => x.clase)
                    .ThenByDescending(x => x.confidence)
                    .ToList();
                }
            }
        }
        catch
        {
            // Flask no disponible, usar fallback local
        }

        return fallback;
    }

    [Authorize(Roles = "Oferente")]
    [HttpGet("mios")]
    public async Task<ActionResult<IEnumerable<EstablecimientoEntity>>> GetMisEstablecimientos(CancellationToken ct)
    {
        var establecimientos = await _db.Establecimientos
            .Where(e => e.OferenteId == _current.UserId)
            .Include(e => e.Fotos)
            .Include(e => e.Menus)
            .ThenInclude(m => m.Items)
            .Include(e => e.Mesas)
            .AsNoTracking()
            .ToListAsync(ct);

        NormalizeEstablecimientosPhotoUrls(establecimientos);

        return Ok(establecimientos);
    }

    [AllowAnonymous]
    [HttpGet("{id:int}")]
    public async Task<ActionResult<EstablecimientoEntity>> GetById(int id, CancellationToken ct)
    {
        var e = await _db.Establecimientos
            .Include(x => x.Fotos)
            .Include(x => x.Menus)
            .ThenInclude(m => m.Items)
            .Include(x => x.Mesas)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (e is not null)
        {
            NormalizeEstablecimientosPhotoUrls(new List<EstablecimientoEntity> { e });
        }

        return e is null ? NotFound() : Ok(e);
    }

    [Authorize(Roles = "Oferente")]
    [HttpPost]
    public async Task<ActionResult<int>> Crear([FromBody] CrearEstablecimientoCommand cmd, CancellationToken ct)
    {
        var id = await _crear.Handle(cmd, ct);
        return CreatedAtAction(nameof(GetById), new { id }, id);
    }

    [Authorize(Roles = "Oferente")]
    [HttpPost("{id:int}/menus")]
    public async Task<ActionResult<int>> CrearMenu(int id, [FromBody] CrearMenuCommand cmd, CancellationToken ct)
    {
        cmd.EstablecimientoId = id;
        var mid = await _crearMenu.Handle(cmd, ct);
        return CreatedAtAction(nameof(GetById), new { id }, mid);
    }

    [AllowAnonymous]
    [HttpGet("{id:int}/menus")]
    public async Task<ActionResult> ListMenus(int id, CancellationToken ct)
    {
        var menus = await _db.Menus
            .Where(m => m.EstablecimientoId == id)
            .Include(m => m.Items)
            .AsNoTracking()
            .ToListAsync(ct);
        return Ok(menus);
    }

    [Authorize(Roles = "Oferente")]
    [HttpPost("{id:int}/menus/{menuId:int}/items")]
    public async Task<ActionResult<int>> AgregarItem(int id, int menuId, [FromBody] AgregarMenuItemCommand cmd, CancellationToken ct)
    {
        cmd.MenuId = menuId;
        var itemId = await _agregarItem.Handle(cmd, ct);
        return CreatedAtAction(nameof(ListMenus), new { id }, itemId);
    }

    [Authorize(Roles = "Oferente")]
    [HttpPost("{id:int}/mesas")]
    public async Task<ActionResult<int>> CrearMesa(int id, [FromBody] CrearMesaCommand cmd, CancellationToken ct)
    {
        cmd.EstablecimientoId = id;
        var mesaId = await _crearMesa.Handle(cmd, ct);
        return CreatedAtAction(nameof(GetById), new { id }, mesaId);
    }

    [Authorize(Roles = "Oferente")]
    [HttpPut("{id:int}/mesas/{mesaId:int}/disponible")]
    public async Task<IActionResult> SetDisponibilidad(int id, int mesaId, [FromBody] bool disponible, CancellationToken ct)
    {
        var mesa = await _db.Mesas
            .Include(m => m.Establecimiento)
            .FirstOrDefaultAsync(m => m.Id == mesaId && m.EstablecimientoId == id, ct);
        if (mesa == null) return NotFound();
        if (mesa.Establecimiento?.OferenteId != _current.UserId) return Forbid();
        mesa.Disponible = disponible;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [Authorize]
    [HttpPost("{id:int}/reservas")]
    public async Task<ActionResult<int>> CrearReserva(int id, [FromBody] CrearReservaGastronomiaCommand cmd, CancellationToken ct)
    {
        cmd.EstablecimientoId = id;
        var reservaId = await _crearReserva.Handle(cmd, ct);
        return CreatedAtAction(nameof(GetById), new { id }, reservaId);
    }

    [Authorize(Roles = "Oferente")]
    [HttpGet("{id:int}/reservas")]
    public async Task<ActionResult> ListReservas(int id, CancellationToken ct)
    {
        var est = await _db.Establecimientos.FirstOrDefaultAsync(e => e.Id == id, ct);
        if (est == null) return NotFound();
        if (est.OferenteId != _current.UserId) return Forbid();

        var reservas = await _db.ReservasGastronomia
            .Where(r => r.EstablecimientoId == id)
            .Include(r => r.Mesa)
            .AsNoTracking()
            .ToListAsync(ct);
        return Ok(reservas);
    }

    [AllowAnonymous]
    [HttpGet("{id:int}/disponibilidad")]
    public async Task<ActionResult> VerificarDisponibilidad(int id, [FromQuery] DateTime fecha, CancellationToken ct)
    {
        var establecimiento = await _db.Establecimientos
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == id, ct);
        if (establecimiento is null)
            return NotFound(new { message = "Establecimiento no encontrado" });

        var slot = GastronomiaHorarioHelper.NormalizeReservationSlot(fecha);
        var dentroHorario = GastronomiaHorarioHelper.IsReservationSlotWithinSchedule(slot, establecimiento.HoraApertura, establecimiento.HoraCierre);
        if (!dentroHorario)
        {
            return Ok(new DisponibilidadGastronomiaDto(
                0,
                new List<Mesa>(),
                GastronomiaHorarioHelper.ToHourMinuteString(establecimiento.HoraApertura),
                GastronomiaHorarioHelper.ToHourMinuteString(establecimiento.HoraCierre)
            ));
        }

        var reservedMesaIds = await _db.ReservasGastronomia
            .AsNoTracking()
            .Where(r => r.EstablecimientoId == id
                && (r.Estado == "Pendiente" || r.Estado == "Confirmada")
                && r.Fecha >= slot
                && r.Fecha < slot.AddHours(1)
                && r.MesaId.HasValue)
            .Select(r => r.MesaId!.Value)
            .ToListAsync(ct);

        var mesas = await _db.Mesas
            .Where(m => m.EstablecimientoId == id && m.Disponible && !reservedMesaIds.Contains(m.Id))
            .AsNoTracking()
            .OrderBy(m => m.Capacidad)
            .ThenBy(m => m.Numero)
            .ToListAsync(ct);
        return Ok(new DisponibilidadGastronomiaDto(
            mesas.Count,
            mesas,
            GastronomiaHorarioHelper.ToHourMinuteString(establecimiento.HoraApertura),
            GastronomiaHorarioHelper.ToHourMinuteString(establecimiento.HoraCierre)
        ));
    }

    [Authorize(Roles = "Oferente")]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateEstablecimientoRequest request, CancellationToken ct)
    {
        var est = await _db.Establecimientos
            .Include(e => e.Fotos)
            .FirstOrDefaultAsync(e => e.Id == id, ct);
        if (est == null) return NotFound(new { message = "Establecimiento no encontrado" });
        if (est.OferenteId != _current.UserId) return Forbid();

        if (!string.IsNullOrWhiteSpace(request.Nombre))
        {
            var nombre = request.Nombre.Trim();
            if (nombre.Length < MinNombreEstablecimiento || nombre.Length > MaxNombreEstablecimiento)
                return BadRequest(new { message = $"El nombre del establecimiento debe tener entre {MinNombreEstablecimiento} y {MaxNombreEstablecimiento} caracteres" });

            est.Nombre = nombre;
        }
        if (!string.IsNullOrWhiteSpace(request.Ubicacion))
            est.Ubicacion = request.Ubicacion;
        if (request.Latitud.HasValue)
            est.Latitud = request.Latitud;
        if (request.Longitud.HasValue)
            est.Longitud = request.Longitud;
        if (request.Direccion != null)
            est.Direccion = request.Direccion;
        if (!string.IsNullOrWhiteSpace(request.TipoEstablecimiento))
            est.TipoEstablecimiento = request.TipoEstablecimiento;
        if (request.HoraApertura != null || request.HoraCierre != null)
        {
            var horaApertura = request.HoraApertura is null
                ? est.HoraApertura
                : GastronomiaHorarioHelper.ParseOrDefault(request.HoraApertura, est.HoraApertura);
            var horaCierre = request.HoraCierre is null
                ? est.HoraCierre
                : GastronomiaHorarioHelper.ParseOrDefault(request.HoraCierre, est.HoraCierre);

            GastronomiaHorarioHelper.ValidateBusinessHours(horaApertura, horaCierre);
            est.HoraApertura = horaApertura;
            est.HoraCierre = horaCierre;
        }
        if (request.Amenidades != null)
            est.Amenidades = request.Amenidades;
        if (request.Descripcion != null)
        {
            var descripcion = request.Descripcion.Trim();
            if (!string.IsNullOrWhiteSpace(descripcion)
                && (descripcion.Length < MinDescripcionEstablecimiento || descripcion.Length > MaxDescripcionEstablecimiento))
            {
                return BadRequest(new { message = $"La descripcion debe tener entre {MinDescripcionEstablecimiento} y {MaxDescripcionEstablecimiento} caracteres" });
            }

            est.Descripcion = descripcion;
        }
        if (!string.IsNullOrWhiteSpace(request.FotoPrincipal))
        {
            var normalizedCover = NormalizeStoredPhotoUrl(request.FotoPrincipal);
            if (!string.IsNullOrWhiteSpace(normalizedCover))
                est.FotoPrincipal = normalizedCover;
        }

        if (request.FotosUrls != null)
        {
            var normalizedUrls = request.FotosUrls
                .Select(NormalizeStoredPhotoUrl)
                .Where(url => !string.IsNullOrWhiteSpace(url))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            // Prevent accidental wipe when frontend sends an empty list while editing unrelated fields.
            if (normalizedUrls.Count > 0)
            {
                _db.FotosEstablecimiento.RemoveRange(est.Fotos);
                est.Fotos = normalizedUrls
                    .Select((url, index) => new FotoEstablecimiento
                    {
                        Url = url,
                        Orden = index + 1
                    })
                    .ToList();

                if (string.IsNullOrWhiteSpace(est.FotoPrincipal)
                    || !normalizedUrls.Any(url => string.Equals(url, est.FotoPrincipal, StringComparison.OrdinalIgnoreCase)))
                {
                    est.FotoPrincipal = normalizedUrls[0];
                }
            }
        }

        await _db.SaveChangesAsync(ct);
        return Ok(est);
    }

    [AllowAnonymous]
    [HttpGet("{id:int}/fotos")]
    public async Task<ActionResult<IEnumerable<FotoEstablecimiento>>> ListFotos(int id, CancellationToken ct)
    {
        var exists = await _db.Establecimientos.AnyAsync(e => e.Id == id, ct);
        if (!exists) return NotFound();

        var fotos = await _db.FotosEstablecimiento
            .Where(f => f.EstablecimientoId == id)
            .OrderBy(f => f.Orden)
            .AsNoTracking()
            .ToListAsync(ct);

        foreach (var foto in fotos)
        {
            foto.Url = NormalizeStoredPhotoUrl(foto.Url) ?? foto.Url;
        }

        return Ok(fotos);
    }

    [Authorize(Roles = "Oferente")]
    [HttpPost("{id:int}/fotos")]
    [RequestSizeLimit(25_000_000)]
    public async Task<ActionResult<IEnumerable<FotoEstablecimiento>>> UploadFotos(int id, [FromForm] List<IFormFile> files, CancellationToken ct)
    {
        var est = await _db.Establecimientos
            .Include(e => e.Fotos)
            .FirstOrDefaultAsync(e => e.Id == id, ct);
        if (est is null) return NotFound(new { message = "Establecimiento no encontrado" });
        if (est.OferenteId != _current.UserId) return Forbid();
        if (files is null || files.Count == 0) return BadRequest(new { message = "Debes enviar al menos una imagen" });

        var nextOrder = est.Fotos.Count == 0 ? 1 : est.Fotos.Max(f => f.Orden) + 1;
        var created = new List<FotoEstablecimiento>();

        foreach (var file in files.Where(f => f.Length > 0))
        {
            if (!IsImageFile(file))
                return BadRequest(new { message = $"El archivo '{file.FileName}' no es una imagen valida" });

            await using var stream = file.OpenReadStream();
            var relativePath = await _storage.SaveFileAsync(stream, file.FileName, "fotos/gastronomia", ct);
            var foto = new FotoEstablecimiento
            {
                EstablecimientoId = id,
                Url = _storage.GetPublicUrl(relativePath),
                Orden = nextOrder++
            };
            created.Add(foto);
            _db.FotosEstablecimiento.Add(foto);
        }

        if (created.Count == 0) return BadRequest(new { message = "Los archivos enviados están vacíos" });

        if (string.IsNullOrWhiteSpace(est.FotoPrincipal))
        {
            est.FotoPrincipal = created[0].Url;
        }

        await _db.SaveChangesAsync(ct);
        return Ok(created);
    }

    [Authorize(Roles = "Oferente")]
    [HttpDelete("{id:int}/fotos/{fotoId:int}")]
    public async Task<IActionResult> DeleteFoto(int id, int fotoId, CancellationToken ct)
    {
        var est = await _db.Establecimientos
            .Include(e => e.Fotos)
            .FirstOrDefaultAsync(e => e.Id == id, ct);
        if (est is null) return NotFound(new { message = "Establecimiento no encontrado" });
        if (est.OferenteId != _current.UserId) return Forbid();

        var foto = est.Fotos.FirstOrDefault(f => f.Id == fotoId);
        if (foto is null) return NotFound();

        _db.FotosEstablecimiento.Remove(foto);

        var relativePath = foto.Url.Replace("/comprobantes/", string.Empty).Replace('/', Path.DirectorySeparatorChar);
        await _storage.DeleteFileAsync(relativePath, ct);

        if (string.Equals(est.FotoPrincipal, foto.Url, StringComparison.OrdinalIgnoreCase))
        {
            est.FotoPrincipal = est.Fotos
                .Where(f => f.Id != fotoId)
                .OrderBy(f => f.Orden)
                .Select(f => f.Url)
                .FirstOrDefault();
        }

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [Authorize(Roles = "Oferente")]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var est = await _db.Establecimientos.FirstOrDefaultAsync(e => e.Id == id, ct);
        if (est == null) return NotFound(new { message = "Establecimiento no encontrado" });
        if (est.OferenteId != _current.UserId) return Forbid();

        _db.Establecimientos.Remove(est);
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "Establecimiento eliminado correctamente" });
    }

    private static bool IsImageFile(IFormFile file)
    {
        if (file is null || string.IsNullOrWhiteSpace(file.ContentType))
            return false;

        return file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase);
    }

    private static string BuildModerationReason(string prefix, string? detail)
    {
        var baseText = string.IsNullOrWhiteSpace(detail)
            ? prefix
            : $"{prefix}: {detail.Trim()}";

        return Truncate(baseText, MaxModerationReasonLength);
    }

    private static string AppendModerationReason(string? currentReason, string additionalReason)
    {
        var next = string.IsNullOrWhiteSpace(currentReason)
            ? additionalReason.Trim()
            : $"{currentReason.Trim()} | {additionalReason.Trim()}";

        return Truncate(next, MaxModerationReasonLength);
    }

    private static string Truncate(string value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length <= maxLength)
            return value;

        return value[..maxLength];
    }

    private static string? NormalizeStoredPhotoUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
            return null;

        var value = url.Trim();

        if (Uri.TryCreate(value, UriKind.Absolute, out var absoluteUri))
        {
            value = absoluteUri.AbsolutePath;
        }

        var comprobantesPrefix = "/comprobantes/";
        var storagePrefix = "/api/Storage/public/";

        var idxComprobantes = value.IndexOf(comprobantesPrefix, StringComparison.OrdinalIgnoreCase);
        if (idxComprobantes >= 0)
        {
            var relativeFromComprobantes = value[(idxComprobantes + comprobantesPrefix.Length)..].TrimStart('/');
            return string.IsNullOrWhiteSpace(relativeFromComprobantes)
                ? null
                : $"/comprobantes/{relativeFromComprobantes}";
        }

        var idxStorage = value.IndexOf(storagePrefix, StringComparison.OrdinalIgnoreCase);
        if (idxStorage >= 0)
        {
            var relativeFromStorage = value[(idxStorage + storagePrefix.Length)..].TrimStart('/');
            return string.IsNullOrWhiteSpace(relativeFromStorage)
                ? null
                : $"/comprobantes/{relativeFromStorage}";
        }

        if (value.StartsWith("api/Storage/public/", StringComparison.OrdinalIgnoreCase))
        {
            var relative = value["api/Storage/public/".Length..].TrimStart('/');
            return string.IsNullOrWhiteSpace(relative)
                ? null
                : $"/comprobantes/{relative}";
        }

        var cleanedRelative = value.TrimStart('/');
        return string.IsNullOrWhiteSpace(cleanedRelative)
            ? null
            : $"/comprobantes/{cleanedRelative}";
    }

    private static void NormalizeEstablecimientosPhotoUrls(IEnumerable<EstablecimientoEntity> establecimientos)
    {
        foreach (var establecimiento in establecimientos)
        {
            establecimiento.FotoPrincipal = NormalizeStoredPhotoUrl(establecimiento.FotoPrincipal) ?? establecimiento.FotoPrincipal;

            if (establecimiento.Fotos is null)
                continue;

            foreach (var foto in establecimiento.Fotos)
            {
                foto.Url = NormalizeStoredPhotoUrl(foto.Url) ?? foto.Url;
            }
        }
    }
}

public record UpdateEstablecimientoRequest(
    string? Nombre,
    string? Ubicacion,
    double? Latitud,
    double? Longitud,
    string? Direccion,
    string? TipoEstablecimiento,
    string? HoraApertura,
    string? HoraCierre,
    List<string>? Amenidades,
    string? Descripcion,
    string? FotoPrincipal,
    List<string>? FotosUrls
);

public record GastronomiaRankingDto(
    int Id,
    string Nombre,
    string Ubicacion,
    string? Descripcion,
    string? FotoPrincipal,
    int AiClase,
    double AiConfidence,
    string AiFuente,
    double RatingPromedio,
    int TotalReviews
);

public record RatingDistributionDto(
    string Etiqueta,
    int Valor
);

public record AnalyticsBucketDto(
    string Etiqueta,
    int Valor
);

public record EstablecimientoReviewStatsDto(
    int EstablecimientoId,
    string Nombre,
    double Promedio,
    int TotalReviews
);

public record ReviewsTrendPointDto(
    string Etiqueta,
    int Valor
);

public record GastronomiaAnalyticsDto(
    int TotalResenas,
    double Promedio,
    List<RatingDistributionDto> DistribucionEstrellas,
    List<EstablecimientoReviewStatsDto> Top5,
    List<EstablecimientoReviewStatsDto> Bottom5,
    List<ReviewsTrendPointDto> TendenciaMensual
);

public record DisponibilidadGastronomiaDto(
    int MesasDisponibles,
    List<Mesa> Mesas,
    string HoraApertura,
    string HoraCierre
);

public record AdminTopEstablecimientoDto(
    int Id,
    string Nombre,
    string Tipo,
    int TotalReservas,
    double Promedio
);

public record NeuronaMetricsDto(
    int TotalEvaluados,
    int ClasificacionesMl,
    int ClasificacionesFallback,
    int ClaseAlta,
    int ClaseMedia,
    int ClaseBaja,
    double ConfianzaPromedio
);

public record AdminGastronomiaAnalyticsDto(
    int TotalEstablecimientos,
    int TotalReservas,
    int TotalResenas,
    double PromedioCalificacion,
    int SolicitudesPendientes,
    int ReportesPendientes,
    List<AnalyticsBucketDto> ReservasPorMes,
    List<AnalyticsBucketDto> EstablecimientosPorTipo,
    List<AdminTopEstablecimientoDto> TopEstablecimientos,
    NeuronaMetricsDto Neurona
);

public record ReportarReviewDto(
    string? Motivo
);

public record ResolverReporteReviewDto(
    bool EsValido,
    string? ComentarioAdmin
);
