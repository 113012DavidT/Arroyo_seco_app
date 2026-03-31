namespace arroyoSeco.Domain.Entities.Notificaciones;

public class PushSubscription
{
    public int Id { get; set; }
    public string UsuarioId { get; set; } = null!;
    public string Endpoint { get; set; } = null!;
    public string P256DH { get; set; } = null!;
    public string Auth { get; set; } = null!;
    public string? UserAgent { get; set; }
    public bool Activa { get; set; } = true;
    public DateTime FechaRegistroUtc { get; set; } = DateTime.UtcNow;
}
