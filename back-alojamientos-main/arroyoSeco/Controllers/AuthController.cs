using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.Security.Claims;
using System.Text;
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

    private static string RegisterCacheKey(string userId) => $"webauthn:register:{userId}";
    private static string LoginCacheKey(string email) => $"webauthn:login:{email.ToLowerInvariant()}";

    public AuthController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        IJwtTokenGenerator token,
        IAppDbContext db,
        AuthDbContext authDb,
        IConfiguration configuration,
        IMemoryCache cache)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _token = token;
        _db = db;
        _authDb = authDb;
        _configuration = configuration;
        _cache = cache;
    }

    public record RegisterDto(string Email, string Password, string Direccion, string Sexo, string? Role, int? TipoOferente);
    public record LoginDto(string Email, string Password);
    public record CambiarPasswordDto(string PasswordActual, string PasswordNueva);
    public record UpdatePerfilDto(string Direccion, string Sexo);

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
        if (string.IsNullOrWhiteSpace(dto.Direccion) || string.IsNullOrWhiteSpace(dto.Sexo))
            return BadRequest(new { message = "Direccion y sexo son obligatorios" });
        if (!SexosPermitidos.Contains(dto.Sexo.Trim()))
            return BadRequest(new { message = "Sexo invalido. Opciones: Masculino, Femenino, Otro, Prefiero no decir" });

        var user = new ApplicationUser
        {
            UserName = dto.Email,
            Email = dto.Email,
            EmailConfirmed = true,
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
        var user = await _userManager.FindByEmailAsync(dto.Email);
        if (user is null) return Unauthorized();

        var result = await _signInManager.CheckPasswordSignInAsync(user, dto.Password, lockoutOnFailure: false);
        if (!result.Succeeded) return Unauthorized();

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
            email = user.Email,
            direccion = user.Direccion,
            sexo = user.Sexo,
            perfilCompleto = user.PerfilBasicoCompleto,
            tipoOferente,
            roles
        });
    }

    [Authorize]
    [HttpPut("perfil")]
    public async Task<IActionResult> UpdatePerfil([FromBody] UpdatePerfilDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Direccion) || string.IsNullOrWhiteSpace(dto.Sexo))
            return BadRequest(new { message = "Direccion y sexo son obligatorios" });
        if (!SexosPermitidos.Contains(dto.Sexo.Trim()))
            return BadRequest(new { message = "Sexo invalido. Opciones: Masculino, Femenino, Otro, Prefiero no decir" });

        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();

        user.Direccion = dto.Direccion.Trim();
        user.Sexo = dto.Sexo.Trim();

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
            return BadRequest(result.Errors);

        return Ok(new
        {
            message = "Perfil actualizado",
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
}
