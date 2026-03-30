using arroyoSeco.Domain.Entities.Usuarios;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace arroyoSeco.Infrastructure.Auth;

// DbContext para ASP.NET Core Identity (usuarios/roles)
public class AuthDbContext : IdentityDbContext<ApplicationUser, IdentityRole, string>
{
    public AuthDbContext(DbContextOptions<AuthDbContext> options) : base(options) { }

    public DbSet<WebAuthnCredential> WebAuthnCredentials => Set<WebAuthnCredential>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<WebAuthnCredential>(b =>
        {
            b.ToTable("WebAuthnCredentials");
            b.HasKey(x => x.Id);

            b.Property(x => x.UserId)
                .IsRequired();

            b.Property(x => x.CredentialId)
                .IsRequired()
                .HasMaxLength(1024);

            b.Property(x => x.PublicKey)
                .IsRequired();

            b.Property(x => x.DeviceName)
                .IsRequired()
                .HasMaxLength(120);

            b.Property(x => x.CreatedAt)
                .IsRequired();

            b.HasIndex(x => x.CredentialId)
                .IsUnique();

            b.HasIndex(x => x.UserId);

            b.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}