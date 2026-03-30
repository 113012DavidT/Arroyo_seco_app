namespace arroyoSeco.Domain.Entities.Usuarios;

public class WebAuthnCredential
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string CredentialId { get; set; } = string.Empty;
    public string PublicKey { get; set; } = string.Empty;
    public long SignatureCounter { get; set; }
    public string DeviceName { get; set; } = "Dispositivo biometrico";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastUsedAt { get; set; }
    public bool IsRevoked { get; set; }
    public ApplicationUser? User { get; set; }
}