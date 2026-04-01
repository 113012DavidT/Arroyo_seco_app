using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using arroyoSeco.Application.Common.Interfaces;
using arroyoSeco.Application.Common.Helpers;
using arroyoSeco.Application.Common.Validation;
using arroyoSeco.Domain.Entities.Gastronomia;

namespace arroyoSeco.Application.Features.Gastronomia.Commands.Crear;

public class CrearEstablecimientoCommand
{
    public string Nombre { get; set; } = null!;
    public string Ubicacion { get; set; } = null!;
    public double? Latitud { get; set; }
    public double? Longitud { get; set; }
    public string? Direccion { get; set; }
    public string? TipoEstablecimiento { get; set; }
    public List<string> Amenidades { get; set; } = new();
    public string? Descripcion { get; set; }
    public string? FotoPrincipal { get; set; }
    public List<string> FotosUrls { get; set; } = new();
    public string? HoraApertura { get; set; }
    public string? HoraCierre { get; set; }
}

public class CrearEstablecimientoCommandHandler
{
    private const int MinNombreEstablecimiento = 3;
    private const int MaxNombreEstablecimiento = 120;
    private const int MinDescripcionEstablecimiento = 15;
    private const int MaxDescripcionEstablecimiento = 1000;

    private readonly IAppDbContext _context;
    private readonly ICurrentUserService _current;

    public CrearEstablecimientoCommandHandler(IAppDbContext context, ICurrentUserService current)
    {
        _context = context;
        _current = current;
    }

    public async Task<int> Handle(CrearEstablecimientoCommand request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Nombre))
            throw new ArgumentException("Nombre requerido");
        var nombre = request.Nombre.Trim();
        if (nombre.Length < MinNombreEstablecimiento || nombre.Length > MaxNombreEstablecimiento)
            throw new ArgumentException($"Nombre invalido. Debe tener entre {MinNombreEstablecimiento} y {MaxNombreEstablecimiento} caracteres");

        if (string.IsNullOrWhiteSpace(request.Ubicacion))
            throw new ArgumentException("Ubicación requerida");

        var descripcion = request.Descripcion?.Trim();
        if (!string.IsNullOrWhiteSpace(descripcion)
            && (descripcion.Length < MinDescripcionEstablecimiento || descripcion.Length > MaxDescripcionEstablecimiento))
        {
            throw new ArgumentException($"Descripcion invalida. Debe tener entre {MinDescripcionEstablecimiento} y {MaxDescripcionEstablecimiento} caracteres");
        }

        var hasMainImage = !string.IsNullOrWhiteSpace(request.FotoPrincipal);
        var hasGalleryImage = request.FotosUrls.Any(url => !string.IsNullOrWhiteSpace(url));
        if (!hasMainImage && !hasGalleryImage)
            throw new ArgumentException("Debes agregar al menos una imagen del establecimiento");

        var owner = await _context.Oferentes
            .FirstOrDefaultAsync(o => o.Id == _current.UserId, ct);
        if (owner == null)
            throw new InvalidOperationException("Oferente no encontrado para el usuario actual");

        var horaApertura = GastronomiaHorarioHelper.ParseOrDefault(request.HoraApertura, GastronomiaHorarioHelper.DefaultOpeningTime);
        var horaCierre = GastronomiaHorarioHelper.ParseOrDefault(request.HoraCierre, GastronomiaHorarioHelper.DefaultClosingTime);
        GastronomiaHorarioHelper.ValidateBusinessHours(horaApertura, horaCierre);

        var e = new Establecimiento
        {
            OferenteId = owner.Id,
            Nombre = nombre,
            Ubicacion = request.Ubicacion.Trim(),
            Latitud = request.Latitud,
            Longitud = request.Longitud,
            Direccion = request.Direccion?.Trim(),
            TipoEstablecimiento = request.TipoEstablecimiento?.Trim(),
            Amenidades = request.Amenidades,
            Descripcion = descripcion,
            FotoPrincipal = request.FotoPrincipal,
            HoraApertura = horaApertura,
            HoraCierre = horaCierre,
            Fotos = request.FotosUrls
                .Where(url => !string.IsNullOrWhiteSpace(url))
                .Select((url, index) => new FotoEstablecimiento
                {
                    Url = url.Trim(),
                    Orden = index + 1
                })
                .ToList()
        };

        _context.Establecimientos.Add(e);
        await _context.SaveChangesAsync(ct);
        return e.Id;
    }
}
