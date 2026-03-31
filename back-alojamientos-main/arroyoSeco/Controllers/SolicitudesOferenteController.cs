using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;
using arroyoSeco.Application.Common.Interfaces;
using arroyoSeco.Domain.Entities.Solicitudes;
using arroyoSeco.Domain.Entities.Usuarios;

namespace arroyoSeco.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SolicitudesOferenteController : ControllerBase
{
    private static readonly EmailAddressAttribute EmailValidator = new();
    private static readonly Regex NombreRegex = new(@"^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s.'-]{2,80}$", RegexOptions.Compiled);
    private static readonly Regex TelefonoRegex = new(@"^\d{10}$", RegexOptions.Compiled);
    private static readonly Regex TextoLibreRegex = new(@"^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.,#()\-]{2,120}$", RegexOptions.Compiled);

    private readonly IAppDbContext _db;
    private readonly INotificationService _noti;
    private readonly UserManager<ApplicationUser> _userManager;
    
    public SolicitudesOferenteController(
        IAppDbContext db,
        INotificationService noti,
        UserManager<ApplicationUser> userManager)
    {
        _db = db;
        _noti = noti;
        _userManager = userManager;
    }

    // GET /api/solicitudesoferente?estatus=Pendiente
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? estatus, CancellationToken ct)
    {
        var q = _db.SolicitudesOferente.AsQueryable();
        if (!string.IsNullOrWhiteSpace(estatus)) q = q.Where(s => s.Estatus == estatus);
        return Ok(await q.AsNoTracking().ToListAsync(ct));
    }

    // POST /api/solicitudesoferente
    [HttpPost]
    public async Task<IActionResult> Crear([FromBody] SolicitudOferente s, CancellationToken ct)
    {
        if (!TryValidateSolicitud(s, out var validationError))
            return BadRequest(new { message = validationError });

        s.Id = 0;
        s.NombreSolicitante = s.NombreSolicitante.Trim();
        s.NombreNegocio = s.NombreNegocio.Trim();
        s.Correo = s.Correo.Trim();
        s.Telefono = s.Telefono.Trim();
        s.Mensaje = string.IsNullOrWhiteSpace(s.Mensaje) ? null : s.Mensaje.Trim();
        s.FechaSolicitud = DateTime.UtcNow;
        _db.SolicitudesOferente.Add(s);
        await _db.SaveChangesAsync(ct);
        
        // Notificar a todos los admins
        var admins = await _userManager.GetUsersInRoleAsync("Admin");
        foreach (var admin in admins)
        {
            await _noti.PushAsync(
                admin.Id,
                "Nueva solicitud de oferente",
                $"Solicitud de {s.NombreSolicitante} ({s.NombreNegocio}) - {s.TipoSolicitado}",
                "SolicitudOferente",
                $"/admin/solicitudes/{s.Id}",
                ct);
        }
        
        return CreatedAtAction(nameof(GetById), new { id = s.Id }, s.Id);
    }

    // GET /api/solicitudesoferente/{id}
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var s = await _db.SolicitudesOferente.FindAsync(new object[] { id }, ct);
        return s is null ? NotFound() : Ok(s);
    }
    
    // GET /api/solicitudesoferente/pendientes/count
    [HttpGet("pendientes/count")]
    public async Task<IActionResult> CountPendientes(CancellationToken ct)
    {
        var count = await _db.SolicitudesOferente
            .Where(s => s.Estatus == "Pendiente")
            .CountAsync(ct);
        return Ok(new { count });
    }

    private static bool TryValidateSolicitud(SolicitudOferente s, out string error)
    {
        if (string.IsNullOrWhiteSpace(s.NombreSolicitante) || !NombreRegex.IsMatch(s.NombreSolicitante.Trim()))
        {
            error = "Nombre invalido. Solo letras y espacios permitidos";
            return false;
        }

        if (string.IsNullOrWhiteSpace(s.Telefono) || !TelefonoRegex.IsMatch(s.Telefono.Trim()))
        {
            error = "Telefono invalido. Debe tener exactamente 10 digitos numericos";
            return false;
        }

        if (string.IsNullOrWhiteSpace(s.Correo) || !EmailValidator.IsValid(s.Correo.Trim()) || s.Correo.Trim().Length > 120)
        {
            error = "Correo invalido";
            return false;
        }

        if (string.IsNullOrWhiteSpace(s.NombreNegocio) || !TextoLibreRegex.IsMatch(s.NombreNegocio.Trim()))
        {
            error = "Nombre de negocio invalido";
            return false;
        }

        if (!string.IsNullOrWhiteSpace(s.Mensaje) && s.Mensaje.Trim().Length > 500)
        {
            error = "La descripcion del negocio no puede exceder 500 caracteres";
            return false;
        }

        error = string.Empty;
        return true;
    }
}