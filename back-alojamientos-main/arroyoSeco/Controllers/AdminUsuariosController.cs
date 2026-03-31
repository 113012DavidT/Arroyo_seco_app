using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.Net;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using arroyoSeco.Application.Common.Interfaces;
using arroyoSeco.Domain.Entities.Usuarios;

namespace arroyoSeco.Controllers;

[ApiController]
[Route("api/admin/usuarios")]
[Authorize(Roles = "Admin")]
public class AdminUsuariosController : ControllerBase
{
    private static readonly EmailAddressAttribute EmailValidator = new();
    private static readonly Regex NombreRegex = new(@"^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s.'-]{3,80}$", RegexOptions.Compiled);
    private static readonly Regex TelefonoRegex = new(@"^\d{10}$", RegexOptions.Compiled);

    private readonly IAppDbContext _db;
    private readonly IEmailService _email;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<IdentityRole> _roleManager;
    private readonly IMemoryCache _cache;

    private static string CreateAdminCodeCacheKey(string adminId) => $"admin:create-admin:{adminId}";

    private sealed record AdminCreateVerificationState(
        string Nombre,
        string Email,
        string Telefono,
        string Codigo,
        DateTimeOffset ExpiresAt);

    public record ActualizarUsuarioSistemaDto(string? Nombre, string? Email, string? Telefono);
    public record SolicitarCodigoAltaAdminDto(string Nombre, string Email, string Telefono);
    public record ConfirmarAltaAdminDto(string Nombre, string Email, string Telefono, string Codigo);

    public AdminUsuariosController(
        IAppDbContext db,
        IEmailService email,
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole> roleManager,
        IMemoryCache cache)
    {
        _db = db;
        _email = email;
        _userManager = userManager;
        _roleManager = roleManager;
        _cache = cache;
    }

    [HttpGet]
    public async Task<IActionResult> ListUsuarios(CancellationToken ct)
    {
        var users = await _userManager.Users
            .AsNoTracking()
            .OrderBy(u => u.Email)
            .ToListAsync(ct);

        var response = new List<object>(users.Count);
        foreach (var user in users)
        {
            var roles = await _userManager.GetRolesAsync(user);
            var isLocked = await _userManager.IsLockedOutAsync(user);

            response.Add(new
            {
                id = user.Id,
                nombre = user.UserName ?? string.Empty,
                email = user.Email ?? string.Empty,
                telefono = user.PhoneNumber,
                roles,
                lockoutEnabled = user.LockoutEnabled,
                lockoutEnd = user.LockoutEnd,
                accessFailedCount = user.AccessFailedCount,
                isLocked
            });
        }

        return Ok(response);
    }

    [HttpPost("admins/solicitar-codigo")]
    public async Task<IActionResult> SolicitarCodigoAltaAdmin([FromBody] SolicitarCodigoAltaAdminDto dto, CancellationToken ct)
    {
        var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(adminId))
            return Unauthorized();

        var validationError = await ValidateAdminPayloadAsync(dto.Nombre, dto.Email, dto.Telefono, ct);
        if (validationError is not null)
            return BadRequest(new { message = validationError });

        var currentAdmin = await _userManager.FindByIdAsync(adminId);
        if (currentAdmin is null || string.IsNullOrWhiteSpace(currentAdmin.Email) || !EmailValidator.IsValid(currentAdmin.Email))
            return BadRequest(new { message = "Tu cuenta de administrador no tiene un correo valido para recibir el codigo de seguridad" });

        var codigo = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
        var expiresAt = DateTimeOffset.UtcNow.AddMinutes(10);

        _cache.Set(
            CreateAdminCodeCacheKey(adminId),
            new AdminCreateVerificationState(dto.Nombre.Trim(), dto.Email.Trim(), dto.Telefono.Trim(), codigo, expiresAt),
            expiresAt);

        var body = $@"
<!DOCTYPE html>
<html>
<body style='font-family: Arial, sans-serif; color: #1f2937;'>
    <div style='max-width: 600px; margin: 0 auto; padding: 24px;'>
        <h2 style='margin-bottom: 16px;'>Codigo de seguridad para alta de administrador</h2>
        <p>Solicitaste crear un nuevo administrador en Arroyo Seco.</p>
        <p><strong>Nuevo admin:</strong> {WebUtility.HtmlEncode(dto.Email.Trim())}</p>
        <div style='margin: 24px 0; padding: 16px; background: #f3f4f6; border-radius: 8px; font-size: 28px; letter-spacing: 4px; text-align: center;'>
            {codigo}
        </div>
        <p>Este codigo vence en 10 minutos. Si no realizaste esta accion, ignora este correo.</p>
    </div>
</body>
</html>";

        var sent = await _email.SendEmailAsync(currentAdmin.Email, "Codigo de seguridad para crear administrador", body, ct);
        if (!sent)
        {
            _cache.Remove(CreateAdminCodeCacheKey(adminId));
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = "No se pudo enviar el codigo de seguridad al correo del administrador" });
        }

        return Ok(new { message = $"Se envio un codigo de seguridad al correo {currentAdmin.Email}" });
    }

    [HttpPost("admins/confirmar")]
    public async Task<IActionResult> ConfirmarAltaAdmin([FromBody] ConfirmarAltaAdminDto dto, CancellationToken ct)
    {
        var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(adminId))
            return Unauthorized();

        var validationError = await ValidateAdminPayloadAsync(dto.Nombre, dto.Email, dto.Telefono, ct);
        if (validationError is not null)
            return BadRequest(new { message = validationError });

        if (string.IsNullOrWhiteSpace(dto.Codigo) || !Regex.IsMatch(dto.Codigo.Trim(), @"^\d{6}$"))
            return BadRequest(new { message = "Codigo de seguridad invalido" });

        if (!_cache.TryGetValue(CreateAdminCodeCacheKey(adminId), out AdminCreateVerificationState? verification) || verification is null)
            return BadRequest(new { message = "El codigo de seguridad vencio o no existe. Solicita uno nuevo" });

        if (verification.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            _cache.Remove(CreateAdminCodeCacheKey(adminId));
            return BadRequest(new { message = "El codigo de seguridad ya vencio. Solicita uno nuevo" });
        }

        if (!string.Equals(verification.Codigo, dto.Codigo.Trim(), StringComparison.Ordinal) ||
            !string.Equals(verification.Email, dto.Email.Trim(), StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(verification.Nombre, dto.Nombre.Trim(), StringComparison.Ordinal) ||
            !string.Equals(verification.Telefono, dto.Telefono.Trim(), StringComparison.Ordinal))
        {
            return BadRequest(new { message = "El codigo no coincide con los datos capturados. Solicita uno nuevo" });
        }

        var email = dto.Email.Trim();
        if (await _userManager.FindByEmailAsync(email) is not null)
            return Conflict(new { message = "Ya existe un usuario con ese correo" });

        if (!await _roleManager.RoleExistsAsync("Admin"))
            await _roleManager.CreateAsync(new IdentityRole("Admin"));

        var generatedPassword = GenerateTemporaryPassword();
        var userName = await BuildUniqueUserNameAsync(dto.Nombre.Trim(), ct);
        var user = new ApplicationUser
        {
            UserName = userName,
            Email = email,
            EmailConfirmed = true,
            PhoneNumber = dto.Telefono.Trim(),
            LockoutEnabled = true,
            RequiereCambioPassword = true
        };

        var createResult = await _userManager.CreateAsync(user, generatedPassword);
        if (!createResult.Succeeded)
            return BadRequest(new { message = "No se pudo crear el administrador", errors = createResult.Errors });

        var roleResult = await _userManager.AddToRoleAsync(user, "Admin");
        if (!roleResult.Succeeded)
        {
            await _userManager.DeleteAsync(user);
            return BadRequest(new { message = "No se pudo asignar el rol de administrador", errors = roleResult.Errors });
        }

        var welcomeBody = $@"
<!DOCTYPE html>
<html>
<body style='font-family: Arial, sans-serif; color: #1f2937;'>
    <div style='max-width: 600px; margin: 0 auto; padding: 24px;'>
        <h2 style='margin-bottom: 16px;'>Tu cuenta de administrador ha sido creada</h2>
        <p>Hola {WebUtility.HtmlEncode(dto.Nombre.Trim())},</p>
        <p>Un administrador de Arroyo Seco te dio de alta como <strong>Administrador</strong>.</p>
        <div style='margin: 24px 0; padding: 16px; background: #f3f4f6; border-radius: 8px;'>
            <p style='margin: 0 0 8px;'><strong>Correo:</strong> {WebUtility.HtmlEncode(email)}</p>
            <p style='margin: 0;'><strong>Contrasena temporal:</strong> {generatedPassword}</p>
        </div>
        <p>Debes cambiar tu contrasena al iniciar sesion por primera vez.</p>
    </div>
</body>
</html>";

        var sent = await _email.SendEmailAsync(email, "Tu cuenta de administrador ha sido creada", welcomeBody, ct);
        if (!sent)
        {
            await _userManager.DeleteAsync(user);
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = "No se pudo enviar el correo con las credenciales del nuevo administrador" });
        }

        _cache.Remove(CreateAdminCodeCacheKey(adminId));

        return CreatedAtAction(nameof(ListUsuarios), new { id = user.Id }, new
        {
            user.Id,
            user.Email,
            nombre = user.UserName,
            telefono = user.PhoneNumber
        });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateUsuario(string id, [FromBody] ActualizarUsuarioSistemaDto dto, CancellationToken ct)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user is null)
            return NotFound(new { message = "Usuario no encontrado" });

        if (!string.IsNullOrWhiteSpace(dto.Nombre))
        {
            var nombre = dto.Nombre.Trim();
            if (!NombreRegex.IsMatch(nombre))
                return BadRequest(new { message = "Nombre invalido. Debe tener entre 3 y 80 caracteres" });

            if (!string.Equals(user.UserName, nombre, StringComparison.Ordinal))
                user.UserName = await BuildUniqueUserNameAsync(nombre, ct, user.Id);
        }

        if (!string.IsNullOrWhiteSpace(dto.Email))
        {
            var email = dto.Email.Trim();
            if (!EmailValidator.IsValid(email) || email.Length > 120)
                return BadRequest(new { message = "Correo invalido" });

            var exists = await _userManager.FindByEmailAsync(email);
            if (exists is not null && exists.Id != user.Id)
                return BadRequest(new { message = "El correo ya esta en uso" });

            user.Email = email;
            user.NormalizedEmail = _userManager.NormalizeEmail(email);
        }

        if (dto.Telefono != null)
        {
            var telefono = dto.Telefono.Trim();
            if (!TelefonoRegex.IsMatch(telefono))
                return BadRequest(new { message = "Telefono invalido. Debe tener exactamente 10 digitos numericos" });
            user.PhoneNumber = telefono;
        }

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
            return BadRequest(new { message = "No se pudo actualizar el usuario", errors = result.Errors });

        return Ok(new { message = "Usuario actualizado" });
    }

    [HttpPost("{id}/desbloquear")]
    public async Task<IActionResult> DesbloquearUsuario(string id)
    {
        var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(adminId))
            return Unauthorized();

        if (string.Equals(adminId, id, StringComparison.Ordinal))
            return BadRequest(new { message = "Otro admin debe desbloquear tu cuenta" });

        var user = await _userManager.FindByIdAsync(id);
        if (user is null)
            return NotFound(new { message = "Usuario no encontrado" });

        var unlockResult = await _userManager.SetLockoutEndDateAsync(user, null);
        if (!unlockResult.Succeeded)
            return BadRequest(new { message = "No se pudo desbloquear la cuenta", errors = unlockResult.Errors });

        await _userManager.ResetAccessFailedCountAsync(user);
        return Ok(new { message = "Cuenta desbloqueada correctamente" });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUsuario(string id, CancellationToken ct)
    {
        var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(adminId))
            return Unauthorized();

        if (string.Equals(adminId, id, StringComparison.Ordinal))
            return BadRequest(new { message = "No puedes eliminar tu propia cuenta" });

        var user = await _userManager.FindByIdAsync(id);
        if (user is null)
            return NotFound(new { message = "Usuario no encontrado" });

        var roles = await _userManager.GetRolesAsync(user);
        if (roles.Contains("Admin"))
        {
            var adminCount = (await _userManager.GetUsersInRoleAsync("Admin")).Count;
            if (adminCount <= 1)
                return BadRequest(new { message = "No se puede eliminar el ultimo administrador" });
        }

        var oferente = await _db.Oferentes.FirstOrDefaultAsync(o => o.Id == id, ct);
        if (oferente is not null)
            _db.Oferentes.Remove(oferente);

        var deleteResult = await _userManager.DeleteAsync(user);
        if (!deleteResult.Succeeded)
            return BadRequest(new { message = "No se pudo eliminar el usuario", errors = deleteResult.Errors });

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private async Task<string?> ValidateAdminPayloadAsync(string? nombre, string? email, string? telefono, CancellationToken ct)
    {
        var normalizedName = nombre?.Trim();
        var normalizedEmail = email?.Trim();
        var normalizedTelefono = telefono?.Trim();

        if (string.IsNullOrWhiteSpace(normalizedName) || !NombreRegex.IsMatch(normalizedName))
            return "Nombre invalido. Debe tener entre 3 y 80 caracteres";

        if (string.IsNullOrWhiteSpace(normalizedEmail) || !EmailValidator.IsValid(normalizedEmail) || normalizedEmail.Length > 120)
            return "Correo invalido";

        if (string.IsNullOrWhiteSpace(normalizedTelefono) || !TelefonoRegex.IsMatch(normalizedTelefono))
            return "Telefono invalido. Debe tener exactamente 10 digitos numericos";

        var existing = await _userManager.FindByEmailAsync(normalizedEmail);
        if (existing is not null)
            return "Ya existe un usuario con ese correo";

        return null;
    }

    private async Task<string> BuildUniqueUserNameAsync(string baseName, CancellationToken ct, string? currentUserId = null)
    {
        var candidate = baseName.Trim();
        if (string.IsNullOrWhiteSpace(candidate))
            candidate = "Administrador";

        var suffix = 1;
        while (true)
        {
            var existing = await _userManager.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.NormalizedUserName == _userManager.NormalizeName(candidate), ct);

            if (existing is null || existing.Id == currentUserId)
                return candidate;

            suffix++;
            candidate = $"{baseName.Trim()} {suffix}";
        }
    }

    private static string GenerateTemporaryPassword()
    {
        const string upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const string lower = "abcdefghijkmnopqrstuvwxyz";
        const string digits = "23456789";
        const string symbols = "!@#$%*?";
        var chars = new[]
        {
            upper[RandomNumberGenerator.GetInt32(upper.Length)],
            lower[RandomNumberGenerator.GetInt32(lower.Length)],
            digits[RandomNumberGenerator.GetInt32(digits.Length)],
            symbols[RandomNumberGenerator.GetInt32(symbols.Length)]
        }.ToList();

        var all = upper + lower + digits + symbols;
        while (chars.Count < 12)
            chars.Add(all[RandomNumberGenerator.GetInt32(all.Length)]);

        return new string(chars.OrderBy(_ => RandomNumberGenerator.GetInt32(int.MaxValue)).ToArray());
    }
}