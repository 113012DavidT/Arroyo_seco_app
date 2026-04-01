using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using arroyoSeco.Application.Common.Helpers;
using arroyoSeco.Application.Common.Interfaces;
using arroyoSeco.Domain.Entities.Gastronomia;

namespace arroyoSeco.Application.Features.Gastronomia.Commands.Crear;

public class CrearReservaGastronomiaCommand
{
    public int EstablecimientoId { get; set; }
    public DateTime Fecha { get; set; }
    public int NumeroPersonas { get; set; }
    public int? MesaId { get; set; }
}

public class CrearReservaGastronomiaCommandHandler
{
    private readonly IAppDbContext _context;
    private readonly ICurrentUserService _current;
    private readonly INotificationService _notifications;

    public CrearReservaGastronomiaCommandHandler(IAppDbContext context, ICurrentUserService current, INotificationService notifications)
    {
        _context = context;
        _current = current;
        _notifications = notifications;
    }

    public async Task<int> Handle(CrearReservaGastronomiaCommand request, CancellationToken ct = default)
    {
        if (request.NumeroPersonas <= 0)
            throw new ArgumentException("Número de personas inválido");

        var slot = GastronomiaHorarioHelper.NormalizeReservationSlot(request.Fecha);
        var now = DateTime.UtcNow;
        if (slot <= now)
            throw new ArgumentException("La reserva debe ser para una fecha y hora futura");

        var est = await _context.Establecimientos.FirstOrDefaultAsync(e => e.Id == request.EstablecimientoId, ct);
        if (est == null) throw new InvalidOperationException("Establecimiento no encontrado");

        GastronomiaHorarioHelper.ValidateBusinessHours(est.HoraApertura, est.HoraCierre);
        if (!GastronomiaHorarioHelper.IsReservationSlotWithinSchedule(slot, est.HoraApertura, est.HoraCierre))
            throw new InvalidOperationException("La reserva debe iniciar dentro del horario del establecimiento y terminar antes del cierre");

        var reservedMesaIds = await _context.ReservasGastronomia
            .AsNoTracking()
            .Where(r => r.EstablecimientoId == est.Id
                && (r.Estado == "Pendiente" || r.Estado == "Confirmada")
                && r.Fecha >= slot
                && r.Fecha < slot.AddHours(1)
                && r.MesaId.HasValue)
            .Select(r => r.MesaId!.Value)
            .ToListAsync(ct);

        Mesa? mesa = null;
        if (request.MesaId.HasValue)
        {
            mesa = await _context.Mesas.FirstOrDefaultAsync(m => m.Id == request.MesaId && m.EstablecimientoId == est.Id, ct);
            if (mesa == null) throw new InvalidOperationException("Mesa no encontrada");
            if (!mesa.Disponible) throw new InvalidOperationException("Mesa no disponible");
            if (reservedMesaIds.Contains(mesa.Id)) throw new InvalidOperationException("La mesa seleccionada ya está reservada en ese horario");
            if (mesa.Capacidad < request.NumeroPersonas)
                throw new InvalidOperationException("La mesa seleccionada no tiene capacidad suficiente");
        }
        else
        {
            var totalMesas = await _context.Mesas
                .AsNoTracking()
                .CountAsync(m => m.EstablecimientoId == est.Id, ct);

            if (totalMesas == 0)
                throw new InvalidOperationException("El establecimiento aún no tiene mesas configuradas");

            var mesasHabilitadas = await _context.Mesas
                .AsNoTracking()
                .CountAsync(m => m.EstablecimientoId == est.Id && m.Disponible, ct);

            if (mesasHabilitadas == 0)
                throw new InvalidOperationException("El establecimiento no tiene mesas habilitadas en este momento");

            mesa = await _context.Mesas
                .Where(m => m.EstablecimientoId == est.Id
                    && m.Disponible
                    && m.Capacidad >= request.NumeroPersonas
                    && !reservedMesaIds.Contains(m.Id))
                .OrderBy(m => m.Capacidad)
                .ThenBy(m => m.Numero)
                .FirstOrDefaultAsync(ct);

            if (mesa == null)
                throw new InvalidOperationException("No hay mesas disponibles para esa reservación");
        }

        var reserva = new ReservaGastronomia
        {
            UsuarioId = _current.UserId,
            EstablecimientoId = est.Id,
            MesaId = mesa?.Id,
            Fecha = slot,
            NumeroPersonas = request.NumeroPersonas,
            Estado = "Pendiente",
            Total = 0
        };

        _context.ReservasGastronomia.Add(reserva);
        await _context.SaveChangesAsync(ct);

        await _notifications.PushAsync(
            est.OferenteId,
            "Nueva Reserva",
            $"Reserva para {request.NumeroPersonas} personas el {GastronomiaHorarioHelper.FormatBusinessDateTime(slot)}",
            "ReservaGastronomia",
            $"/gastronomia/{est.Id}/reservas/{reserva.Id}",
            ct);

        return reserva.Id;
    }
}
