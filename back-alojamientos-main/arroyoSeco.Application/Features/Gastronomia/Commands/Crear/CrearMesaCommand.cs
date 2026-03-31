using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using arroyoSeco.Application.Common.Interfaces;
using arroyoSeco.Domain.Entities.Gastronomia;

namespace arroyoSeco.Application.Features.Gastronomia.Commands.Crear;

public class CrearMesaCommand
{
    public int EstablecimientoId { get; set; }
    public int Numero { get; set; }
    public int Capacidad { get; set; }
}

public class CrearMesaCommandHandler
{
    public const int MaxCapacidadMesa = 8;

    private readonly IAppDbContext _context;
    private readonly ICurrentUserService _current;

    public CrearMesaCommandHandler(IAppDbContext context, ICurrentUserService current)
    {
        _context = context;
        _current = current;
    }

    public async Task<int> Handle(CrearMesaCommand request, CancellationToken ct = default)
    {
        if (request.Capacidad <= 0)
            throw new ArgumentException("Capacidad invalida. Debe ser mayor a 0");

        if (request.Capacidad > MaxCapacidadMesa)
            throw new ArgumentException($"Capacidad invalida. El maximo permitido por mesa es de {MaxCapacidadMesa} personas");

        var est = await _context.Establecimientos.FirstOrDefaultAsync(e => e.Id == request.EstablecimientoId, ct);
        if (est == null) throw new InvalidOperationException("Establecimiento no encontrado");
        if (est.OferenteId != _current.UserId) throw new InvalidOperationException("Acceso denegado");

        var m = new Mesa { EstablecimientoId = est.Id, Numero = request.Numero, Capacidad = request.Capacidad, Disponible = true };
        _context.Mesas.Add(m);
        await _context.SaveChangesAsync(ct);
        return m.Id;
    }
}
