namespace arroyoSeco.Domain.Entities.Gastronomia;

public class FotoEstablecimiento
{
    public int Id { get; set; }
    public int EstablecimientoId { get; set; }
    public Establecimiento Establecimiento { get; set; } = null!;
    public string Url { get; set; } = null!;
    public int Orden { get; set; }
}
