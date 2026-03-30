using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using UsuarioOferente = arroyoSeco.Domain.Entities.Usuarios.Oferente;

namespace arroyoSeco.Domain.Entities.Alojamientos;

public class Alojamiento
{
    public int Id { get; set; }
    public string OferenteId { get; set; } = null!;
    public UsuarioOferente? Oferente { get; set; }

    public string Nombre { get; set; } = null!;
    public string Ubicacion { get; set; } = null!;
    public double? Latitud { get; set; }
    public double? Longitud { get; set; }
    public string? Direccion { get; set; }
    public int MaxHuespedes { get; set; }
    public int Habitaciones { get; set; }
    public int Banos { get; set; }
    public decimal PrecioPorNoche { get; set; }
    public string? AmenidadesCsv { get; set; }
    public string? FotoPrincipal { get; set; }

    [NotMapped]
    public List<string> Amenidades
    {
        get => string.IsNullOrWhiteSpace(AmenidadesCsv)
            ? new List<string>()
            : AmenidadesCsv
                .Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(value => value.Trim())
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        set => AmenidadesCsv = value is null
            ? null
            : string.Join(',', value
                .Where(item => !string.IsNullOrWhiteSpace(item))
                .Select(item => item.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase));
    }

    public List<FotoAlojamiento> Fotos { get; set; } = new();
    public List<Reserva> Reservas { get; set; } = new();
}