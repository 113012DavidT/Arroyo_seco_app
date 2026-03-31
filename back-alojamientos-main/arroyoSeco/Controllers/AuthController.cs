using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.Security.Claims;
using System.Text;
using System.Net;
using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;
using arroyoSeco.Application.Common.Interfaces;
using arroyoSeco.Domain.Entities.Usuarios;
using arroyoSeco.Infrastructure.Auth;
using Fido2NetLib;
using Fido2NetLib.Objects;

namespace arroyoSeco.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private const int PrimerBloqueoIntentos = 5;
    private const int SegundosBloqueoBase = 30;

    private static readonly EmailAddressAttribute EmailValidator = new();
    private static readonly Regex NombreRegex = new(@"^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s.'-]{2,80}$", RegexOptions.Compiled);
    private static readonly Regex TelefonoRegex = new(@"^\d{10}$", RegexOptions.Compiled);
    private static readonly Regex DireccionRegex = new(@"^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.,#-]{5,200}$", RegexOptions.Compiled);

    private static readonly HashSet<string> SexosPermitidos = new(StringComparer.OrdinalIgnoreCase)
    {
        "Masculino",
        "Femenino",
        "Otro",
        "Prefiero no decir"
    };

    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly IJwtTokenGenerator _token;
    private readonly IAppDbContext _db;
    private readonly AuthDbContext _authDb;
    private readonly IConfiguration _configuration;
    private readonly IMemoryCache _cache;
    private readonly IEmailService _email;

    private static string RegisterCacheKey(string userId) => $"webauthn:register:{userId}";
    private static string LoginCacheKey(string email) => $"webauthn:login:{email.ToLowerInvariant()}";

    public AuthController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        IJwtTokenGenerator token,
        IAppDbContext db,
        AuthDbContext authDb,
        IConfiguration configuration,
        IMemoryCache cache,
        IEmailService email)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _token = token;
        _db = db;
        _authDb = authDb;
        _configuration = configuration;
        _cache = cache;
        _email = email;
    }

    public record RegisterDto(string Email, string Password, string Direccion, string Sexo, string? Role, int? TipoOferente);
    public record LoginDto(string Email, string Password);
    public record CambiarPasswordDto(string PasswordActual, string PasswordNueva);
    public record UpdatePerfilDto(string? Nombre, string? Email, string? Telefono, string? Direccion, string? Sexo);
    public record ForgotPasswordDto(string Email);
    public record ResetPasswordDto(string Email, string Token, string NewPassword);

    public record PasskeyRegisterOptionsDto(string? DeviceName);
    public record PasskeyRegisterVerifyDto(string? DeviceName, PasskeyCredentialDto Credential);
    public record PasskeyLoginOptionsDto(string Email);
    public record PasskeyLoginVerifyDto(string Email, PasskeyAssertionCredentialDto Credential);

    public record PasskeyCredentialDto(string Id, string RawId, string Type, PasskeyAttestationResponseDto Response);
    public record PasskeyAttestationResponseDto(string ClientDataJSON, string AttestationObject);

    public record PasskeyAssertionCredentialDto(string Id, string RawId, string Type, PasskeyAssertionResponseDto Response);
    public record PasskeyAssertionResponseDto(string ClientDataJSON, string AuthenticatorData, string Signature, string? UserHandle);

    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterDto dto)
    {
        if (!TryValidateRegisterDto(dto, out var registerValidationError))
            return BadRequest(new { message = registerValidationError });

        var user = new ApplicationUser
        {
            UserName = dto.Email.Trim(),
            Email = dto.Email.Trim(),
            EmailConfirmed = true,
            LockoutEnabled = true,
            Direccion = dto.Direccion.Trim(),
            Sexo = dto.Sexo.Trim()
        };
        var result = await _userManager.CreateAsync(user, dto.Password);
        if (!result.Succeeded) return BadRequest(result.Errors);

        var role = "Cliente";
        await _userManager.AddToRoleAsync(user, role);

        if (role == "Oferente")
        {
            var tipoOferente = dto.TipoOferente.HasValue
                ? (Domain.Entities.Enums.TipoOferente)dto.TipoOferente.Value
                : Domain.Entities.Enums.TipoOferente.Ambos;

            var oferente = new Oferente
            {
                Id = user.Id,
                Nombre = dto.Email.Split('@')[0],
                NumeroAlojamientos = 0,
                Tipo = tipoOferente
            };
            _db.Oferentes.Add(oferente);
            await _db.SaveChangesAsync();
        }

        var roles = await _userManager.GetRolesAsync(user);
        var jwt = _token.Generate(user.Id, user.Email!, roles);
        return Ok(new { token = jwt });
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        var email = dto.Email?.Trim();
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(dto.Password))
            return Unauthorized(new { message = "Credenciales invalidas" });

        var user = await _userManager.FindByEmailAsync(email);
        if (user is null)
            return Unauthorized(new { message = "Credenciales invalidas" });

        if (!user.LockoutEnabled)
        {
            user.LockoutEnabled = true;
            await _userManager.UpdateAsync(user);
        }

        if (await _userManager.IsLockedOutAsync(user))
            return BuildLockedOutResponse(user.LockoutEnd);

        var isPasswordValid = await _userManager.CheckPasswordAsync(user, dto.Password);
        if (!isPasswordValid)
        {
            await _userManager.AccessFailedAsync(user);
            var failedCount = await _userManager.GetAccessFailedCountAsync(user);
            if (failedCount >= PrimerBloqueoIntentos)
            {
                var lockLevel = 1 + ((failedCount - PrimerBloqueoIntentos) / PrimerBloqueoIntentos);
                var lockSeconds = SegundosBloqueoBase * lockLevel;
                var lockoutEnd = DateTimeOffset.UtcNow.AddSeconds(lockSeconds);
                await _userManager.SetLockoutEndDateAsync(user, lockoutEnd);
                return BuildLockedOutResponse(lockoutEnd);
            }

            var restantes = PrimerBloqueoIntentos - failedCount;
            return Unauthorized(new { message = $"Credenciales invalidas. Te quedan {restantes} intentos antes del bloqueo." });
        }

        await _userManager.ResetAccessFailedCountAsync(user);
        await _userManager.SetLockoutEndDateAsync(user, null);

        return await BuildLoginResponseAsync(user);
    }

    [AllowAnonymous]
    [HttpPost("passkey/login/options")]
    public async Task<IActionResult> PasskeyLoginOptions([FromBody] PasskeyLoginOptionsDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Email))
            return BadRequest(new { message = "Email requerido" });

        var user = await _userManager.FindByEmailAsync(dto.Email.Trim());
        if (user is null)
            return Unauthorized();

        var credentials = await _authDb.WebAuthnCredentials
            .AsNoTracking()
            .Where(c => c.UserId == user.Id && !c.IsRevoked)
            .ToListAsync();

        if (credentials.Count == 0)
            return BadRequest(new { message = "Este usuario no tiene biometria registrada" });

        var allowedCredentials = credentials
            .Select(c => new PublicKeyCredentialDescriptor(Base64UrlDecode(c.CredentialId)))
            .ToList();

        var fido2 = BuildFido2();
        var options = fido2.GetAssertionOptions(
            allowedCredentials,
            UserVerificationRequirement.Preferred
        );

        _cache.Set(LoginCacheKey(dto.Email), options, TimeSpan.FromMinutes(5));
        return Ok(options);
    }

    [AllowAnonymous]
    [HttpPost("passkey/login/verify")]
    public async Task<IActionResult> PasskeyLoginVerify([FromBody] PasskeyLoginVerifyDto dto)
    {
        if (dto.Credential is null || string.IsNullOrWhiteSpace(dto.Email))
            return BadRequest(new { message = "Datos invalidos" });

        var user = await _userManager.FindByEmailAsync(dto.Email.Trim());
        if (user is null)
            return Unauthorized();

        if (!_cache.TryGetValue(LoginCacheKey(dto.Email), out AssertionOptions? options) || options is null)
            return BadRequest(new { message = "La solicitud biometrica expiro. Intenta de nuevo" });

        var storedCredential = await _authDb.WebAuthnCredentials
            .FirstOrDefaultAsync(c => c.UserId == user.Id && !c.IsRevoked && c.CredentialId == dto.Credential.Id);

        if (storedCredential is null)
            return Unauthorized();

        var fido2 = BuildFido2();
        var clientResponse = new AuthenticatorAssertionRawResponse
        {
            Id = dto.Credential.Id,
            RawId = Base64UrlDecode(dto.Credential.RawId),
            Type = PublicKeyCredentialType.PublicKey,
            Response = new AuthenticatorAssertionRawResponse.AssertionResponse
            {
                ClientDataJson = Base64UrlDecode(dto.Credential.Response.ClientDataJSON),
                AuthenticatorData = Base64UrlDecode(dto.Credential.Response.AuthenticatorData),
                Signature = Base64UrlDecode(dto.Credential.Response.Signature),
                UserHandle = string.IsNullOrWhiteSpace(dto.Credential.Response.UserHandle)
                    ? null
                    : Base64UrlDecode(dto.Credential.Response.UserHandle)
            }
        };

        var credentialPublicKey = Base64UrlDecode(storedCredential.PublicKey);

        var assertion = await fido2.MakeAssertionAsync(new MakeAssertionParams
        {
            AssertionResponse = clientResponse,
            OriginalOptions = options,
            StoredPublicKey = credentialPublicKey,
            StoredSignatureCounter = (uint)Math.Max(0, storedCredential.SignatureCounter),
            IsUserHandleOwnerOfCredentialIdCallback = async (args, cancellationToken) =>
            {
                var owner = await _authDb.WebAuthnCredentials
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.CredentialId == Base64UrlEncode(args.CredentialId), cancellationToken);
                return owner is not null && owner.UserId == user.Id && !owner.IsRevoked;
            }
        });

        storedCredential.SignatureCounter = assertion.SignCount;
        storedCredential.LastUsedAt = DateTime.UtcNow;
        await _authDb.SaveChangesAsync();
        _cache.Remove(LoginCacheKey(dto.Email));

        return await BuildLoginResponseAsync(user);
    }

    [Authorize]
    [HttpPost("passkey/register/options")]
    public async Task<IActionResult> PasskeyRegisterOptions([FromBody] PasskeyRegisterOptionsDto? dto)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null)
            return Unauthorized();

        var existingCredentials = await _authDb.WebAuthnCredentials
            .AsNoTracking()
            .Where(c => c.UserId == user.Id && !c.IsRevoked)
            .Select(c => new PublicKeyCredentialDescriptor(Base64UrlDecode(c.CredentialId)))
            .ToListAsync();

        var fido2 = BuildFido2();
        var fidoUser = new Fido2User
        {
            Id = Encoding.UTF8.GetBytes(user.Id),
            Name = user.Email ?? user.UserName ?? user.Id,
            DisplayName = user.Email ?? user.UserName ?? "Usuario"
        };

        var authSelection = new AuthenticatorSelection
        {
            UserVerification = UserVerificationRequirement.Preferred,
            ResidentKey = ResidentKeyRequirement.Preferred
        };

        var options = fido2.RequestNewCredential(new RequestNewCredentialParams
        {
            User = fidoUser,
            ExcludeCredentials = existingCredentials,
            AuthenticatorSelection = authSelection,
            AttestationPreference = AttestationConveyancePreference.None
        });

        _cache.Set(RegisterCacheKey(user.Id), options, TimeSpan.FromMinutes(5));

        return Ok(options);
    }

    [Authorize]
    [HttpPost("passkey/register/verify")]
    public async Task<IActionResult> PasskeyRegisterVerify([FromBody] PasskeyRegisterVerifyDto dto)
    {
        if (dto.Credential is null)
            return BadRequest(new { message = "Datos de credencial invalidos" });

        var user = await _userManager.GetUserAsync(User);
        if (user is null)
            return Unauthorized();

        if (!_cache.TryGetValue(RegisterCacheKey(user.Id), out CredentialCreateOptions? options) || options is null)
            return BadRequest(new { message = "La solicitud biometrica expiro. Intenta de nuevo" });

        var fido2 = BuildFido2();

        var attestationResponse = new AuthenticatorAttestationRawResponse
        {
            Id = dto.Credential.Id,
            RawId = Base64UrlDecode(dto.Credential.RawId),
            Type = PublicKeyCredentialType.PublicKey,
            Response = new AuthenticatorAttestationRawResponse.AttestationResponse
            {
                ClientDataJson = Base64UrlDecode(dto.Credential.Response.ClientDataJSON),
                AttestationObject = Base64UrlDecode(dto.Credential.Response.AttestationObject)
            }
        };

        var result = await fido2.MakeNewCredentialAsync(new MakeNewCredentialParams
        {
            AttestationResponse = attestationResponse,
            OriginalOptions = options,
            IsCredentialIdUniqueToUserCallback = async (args, cancellationToken) =>
            {
                var credentialId = Base64UrlEncode(args.CredentialId);
                return !await _authDb.WebAuthnCredentials.AnyAsync(c => c.CredentialId == credentialId, cancellationToken);
            }
        });

        var deviceName = string.IsNullOrWhiteSpace(dto.DeviceName) ? "Dispositivo biometrico" : dto.DeviceName.Trim();

        var credential = new WebAuthnCredential
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            CredentialId = Base64UrlEncode(result.Id),
            PublicKey = Base64UrlEncode(result.PublicKey),
            SignatureCounter = result.SignCount,
            DeviceName = deviceName.Length > 120 ? deviceName[..120] : deviceName,
            CreatedAt = DateTime.UtcNow,
            LastUsedAt = DateTime.UtcNow,
            IsRevoked = false
        };

        _authDb.WebAuthnCredentials.Add(credential);
        await _authDb.SaveChangesAsync();

        _cache.Remove(RegisterCacheKey(user.Id));

        return Ok(new
        {
            message = "Biometria registrada correctamente",
            credentialId = credential.Id,
            deviceName = credential.DeviceName
        });
    }

    [Authorize]
    [HttpGet("passkey/credentials")]
    public async Task<IActionResult> GetPasskeyCredentials()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null)
            return Unauthorized();

        var creds = await _authDb.WebAuthnCredentials
            .AsNoTracking()
            .Where(c => c.UserId == user.Id)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new
            {
                c.Id,
                c.DeviceName,
                c.CreatedAt,
                c.LastUsedAt,
                c.IsRevoked
            })
            .ToListAsync();

        return Ok(creds);
    }

    [Authorize]
    [HttpDelete("passkey/credentials/{id:guid}")]
    public async Task<IActionResult> RevokePasskey(Guid id)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null)
            return Unauthorized();

        var cred = await _authDb.WebAuthnCredentials.FirstOrDefaultAsync(c => c.Id == id && c.UserId == user.Id);
        if (cred is null)
            return NotFound();

        cred.IsRevoked = true;
        await _authDb.SaveChangesAsync();

        return Ok(new { message = "Credencial biometrica revocada" });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();
        var roles = await _userManager.GetRolesAsync(user);
        int? tipoOferente = null;
        if (roles.Contains("Oferente"))
        {
            var oferente = await _db.Oferentes
                .AsNoTracking()
                .FirstOrDefaultAsync(o => o.Id == user.Id);
            if (oferente != null)
                tipoOferente = (int)oferente.Tipo;
        }

        return Ok(new
        {
            id = user.Id,
            nombre = user.UserName,
            email = user.Email,
            telefono = user.PhoneNumber,
            direccion = user.Direccion,
            sexo = user.Sexo,
            perfilCompleto = user.PerfilBasicoCompleto,
            tipoOferente,
            roles
        });
    }

    [AllowAnonymous]
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto)
    {
        // Respuesta neutral para no filtrar si el correo existe o no.
        var generic = Ok(new { message = "Si el correo existe, enviaremos instrucciones para recuperar tu contraseña" });

        if (string.IsNullOrWhiteSpace(dto.Email))
            return generic;

        var email = dto.Email.Trim();
        var user = await _userManager.FindByEmailAsync(email);
        if (user is null)
            return generic;

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        var baseUrl = _configuration["App:FrontendBaseUrl"];
        if (string.IsNullOrWhiteSpace(baseUrl))
            baseUrl = $"{Request.Scheme}://{Request.Host}";

        var resetUrl = $"{baseUrl!.TrimEnd('/')}/login?mode=reset&email={WebUtility.UrlEncode(user.Email)}&token={WebUtility.UrlEncode(token)}";

        var html = $@"
<div style='font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:20px'>
  <h2 style='color:#111827'>Recuperación de contraseña</h2>
  <p>Recibimos una solicitud para restablecer tu contraseña.</p>
  <p>Haz clic en el siguiente botón para continuar:</p>
  <p>
    <a href='{resetUrl}' style='display:inline-block;background:#E31B23;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600'>Restablecer contraseña</a>
  </p>
  <p style='color:#6b7280'>Si no solicitaste este cambio, puedes ignorar este correo.</p>
  <hr style='border:none;border-top:1px solid #e5e7eb;margin:20px 0' />
  <p style='font-size:12px;color:#9ca3af'>Arroyo Seco</p>
</div>";

        var sent = await _email.SendEmailAsync(user.Email!, "Recuperación de contraseña", html);
        if (!sent)
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = "No se pudo enviar el correo de recuperación" });

        return generic;
    }

    [AllowAnonymous]
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Token) || string.IsNullOrWhiteSpace(dto.NewPassword))
            return BadRequest(new { message = "Email, token y nueva contraseña son obligatorios" });

        var user = await _userManager.FindByEmailAsync(dto.Email.Trim());
        if (user is null)
            return BadRequest(new { message = "Solicitud inválida" });

        var decodedToken = WebUtility.UrlDecode(dto.Token.Trim());
        var result = await _userManager.ResetPasswordAsync(user, decodedToken, dto.NewPassword);
        if (!result.Succeeded)
            return BadRequest(new { message = "No se pudo restablecer la contraseña", errors = result.Errors });

        if (user.RequiereCambioPassword)
        {
            user.RequiereCambioPassword = false;
            await _userManager.UpdateAsync(user);
        }

        return Ok(new { message = "Contraseña actualizada correctamente" });
    }

    [Authorize]
    [HttpPut("perfil")]
    public async Task<IActionResult> UpdatePerfil([FromBody] UpdatePerfilDto dto)
    {
        if (!TryValidateUpdatePerfilDto(dto, out var perfilValidationError))
            return BadRequest(new { message = perfilValidationError });

        if (!string.IsNullOrWhiteSpace(dto.Sexo) && !SexosPermitidos.Contains(dto.Sexo.Trim()))
            return BadRequest(new { message = "Sexo invalido. Opciones: Masculino, Femenino, Otro, Prefiero no decir" });

        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();

        if (!string.IsNullOrWhiteSpace(dto.Nombre))
            user.UserName = dto.Nombre.Trim();

        if (!string.IsNullOrWhiteSpace(dto.Telefono))
            user.PhoneNumber = dto.Telefono.Trim();

        if (!string.IsNullOrWhiteSpace(dto.Direccion))
            user.Direccion = dto.Direccion.Trim();

        if (!string.IsNullOrWhiteSpace(dto.Sexo))
            user.Sexo = dto.Sexo.Trim();

        if (!string.IsNullOrWhiteSpace(dto.Email) && !string.Equals(user.Email, dto.Email.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            var exists = await _userManager.FindByEmailAsync(dto.Email.Trim());
            if (exists is not null && exists.Id != user.Id)
                return BadRequest(new { message = "El correo ya está en uso" });

            user.Email = dto.Email.Trim();
            user.NormalizedEmail = _userManager.NormalizeEmail(user.Email);
        }

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
            return BadRequest(result.Errors);

        return Ok(new
        {
            message = "Perfil actualizado",
            nombre = user.UserName,
            email = user.Email,
            telefono = user.PhoneNumber,
            direccion = user.Direccion,
            sexo = user.Sexo,
            perfilCompleto = user.PerfilBasicoCompleto
        });
    }

    [Authorize]
    [HttpPost("cambiar-password")]
    public async Task<IActionResult> CambiarPassword([FromBody] CambiarPasswordDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound();

        var result = await _userManager.ChangePasswordAsync(user, dto.PasswordActual, dto.PasswordNueva);
        if (!result.Succeeded)
            return BadRequest(new { message = "Contraseña actual incorrecta o la nueva contraseña no cumple con los requisitos", errors = result.Errors });

        if (user.RequiereCambioPassword)
        {
            user.RequiereCambioPassword = false;
            await _userManager.UpdateAsync(user);
        }

        return Ok(new { message = "Contraseña actualizada exitosamente" });
    }

    private async Task<IActionResult> BuildLoginResponseAsync(ApplicationUser user)
    {
        var roles = await _userManager.GetRolesAsync(user);
        int? tipoOferente = null;
        if (roles.Contains("Oferente"))
        {
            var oferente = await _db.Oferentes
                .AsNoTracking()
                .FirstOrDefaultAsync(o => o.Id == user.Id);
            if (oferente != null)
                tipoOferente = (int)oferente.Tipo;
        }

        var jwt = _token.Generate(user.Id, user.Email!, roles, user.RequiereCambioPassword);

        if (!user.PerfilBasicoCompleto)
        {
            return StatusCode(StatusCodes.Status428PreconditionRequired, new
            {
                message = "Completa tu perfil para continuar",
                requiereCompletarPerfil = true,
                perfilCompleto = false,
                token = jwt,
                tipoOferente
            });
        }

        if (!user.FechaPrimerLogin.HasValue)
        {
            user.FechaPrimerLogin = DateTime.UtcNow;
            await _userManager.UpdateAsync(user);
        }

        return Ok(new
        {
            token = jwt,
            tipoOferente,
            perfilCompleto = true
        });
    }

    private Fido2 BuildFido2()
    {
        var rpId = _configuration["WebAuthn:RelyingPartyId"];
        var rpName = _configuration["WebAuthn:RelyingPartyName"];
        var origin = _configuration["WebAuthn:Origin"];

        rpId ??= HttpContext.Request.Host.Host;
        rpName ??= "Arroyo Seco";
        origin ??= $"{HttpContext.Request.Scheme}://{HttpContext.Request.Host}";

        var cfg = new Fido2Configuration
        {
            ServerDomain = rpId,
            ServerName = rpName,
            Origins = new HashSet<string> { origin }
        };

        return new Fido2(cfg);
    }

    private static byte[] Base64UrlDecode(string value)
    {
        var padding = 4 - (value.Length % 4);
        if (padding is > 0 and < 4)
            value = value + new string('=', padding);

        value = value.Replace('-', '+').Replace('_', '/');
        return Convert.FromBase64String(value);
    }

    private static string Base64UrlEncode(byte[] bytes)
    {
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static bool TryValidateRegisterDto(RegisterDto dto, out string error)
    {
        if (string.IsNullOrWhiteSpace(dto.Email) || !EmailValidator.IsValid(dto.Email.Trim()) || dto.Email.Trim().Length > 120)
        {
            error = "Correo invalido";
            return false;
        }

        if (string.IsNullOrWhiteSpace(dto.Direccion))
        {
            error = "Direccion y sexo son obligatorios";
            return false;
        }

        var direccion = dto.Direccion.Trim();
        if (!DireccionRegex.IsMatch(direccion))
        {
            error = "Direccion invalida. Usa entre 5 y 200 caracteres permitidos";
            return false;
        }

        if (string.IsNullOrWhiteSpace(dto.Sexo) || !SexosPermitidos.Contains(dto.Sexo.Trim()))
        {
            error = "Sexo invalido. Opciones: Masculino, Femenino, Otro, Prefiero no decir";
            return false;
        }

        error = string.Empty;
        return true;
    }

    private static bool TryValidateUpdatePerfilDto(UpdatePerfilDto dto, out string error)
    {
        if (!string.IsNullOrWhiteSpace(dto.Nombre))
        {
            var nombre = dto.Nombre.Trim();
            if (!NombreRegex.IsMatch(nombre))
            {
                error = "Nombre invalido. Solo letras, espacios y signos permitidos";
                return false;
            }
        }

        if (!string.IsNullOrWhiteSpace(dto.Email))
        {
            var email = dto.Email.Trim();
            if (!EmailValidator.IsValid(email) || email.Length > 120)
            {
                error = "Correo invalido";
                return false;
            }
        }

        if (!string.IsNullOrWhiteSpace(dto.Telefono))
        {
            var telefono = dto.Telefono.Trim();
            if (!TelefonoRegex.IsMatch(telefono))
            {
                error = "Telefono invalido. Debe tener exactamente 10 digitos numericos";
                return false;
            }
        }

        if (!string.IsNullOrWhiteSpace(dto.Direccion))
        {
            var direccion = dto.Direccion.Trim();
            if (!DireccionRegex.IsMatch(direccion))
            {
                error = "Direccion invalida. Usa entre 5 y 200 caracteres permitidos";
                return false;
            }
        }

        error = string.Empty;
        return true;
    }

    private IActionResult BuildLockedOutResponse(DateTimeOffset? lockoutEnd)
    {
        var remainingSeconds = 30;
        if (lockoutEnd.HasValue)
        {
            remainingSeconds = (int)Math.Ceiling((lockoutEnd.Value - DateTimeOffset.UtcNow).TotalSeconds);
            if (remainingSeconds < 1)
                remainingSeconds = 1;
        }

        return StatusCode(StatusCodes.Status423Locked, new
        {
            message = $"Cuenta bloqueada temporalmente. Intenta de nuevo en {remainingSeconds} segundos.",
            remainingSeconds
        });
    }
}
