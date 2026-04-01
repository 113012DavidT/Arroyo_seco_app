using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using UsuarioOferente = arroyoSeco.Domain.Entities.Usuarios.Oferente;

namespace arroyoSeco.Domain.Entities.Gastronomia;

public class Establecimiento
{
    public int Id { get; set; }
    public string OferenteId { get; set; } = null!;
    public UsuarioOferente? Oferente { get; set; }

    public string Nombre { get; set; } = null!;
    public string Ubicacion { get; set; } = null!;
    public double? Latitud { get; set; }
    public double? Longitud { get; set; }
    public string? Direccion { get; set; }
    public string? TipoEstablecimiento { get; set; }
    public string? AmenidadesCsv { get; set; }
    public string? Descripcion { get; set; }
    public string? FotoPrincipal { get; set; }
    public TimeSpan HoraApertura { get; set; } = new(12, 0, 0);
    public TimeSpan HoraCierre { get; set; } = new(22, 0, 0);

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

    public List<Menu> Menus { get; set; } = new();
    public List<FotoEstablecimiento> Fotos { get; set; } = new();
    public List<Mesa> Mesas { get; set; } = new();
    public List<ReservaGastronomia> Reservas { get; set; } = new();
    public List<Review> Reviews { get; set; } = new();
}
