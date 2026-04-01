using System;
using System.Globalization;

namespace arroyoSeco.Application.Common.Helpers;

public static class GastronomiaHorarioHelper
{
    private static readonly Lazy<TimeZoneInfo> BusinessTimeZone = new(ResolveBusinessTimeZone);

    public static readonly TimeSpan DefaultOpeningTime = new(12, 0, 0);
    public static readonly TimeSpan DefaultClosingTime = new(22, 0, 0);

    public static TimeSpan ParseOrDefault(string? value, TimeSpan fallback)
    {
        if (string.IsNullOrWhiteSpace(value))
            return fallback;

        if (TimeSpan.TryParseExact(value.Trim(), new[] { @"hh\:mm", @"hh\:mm\:ss", "c" }, CultureInfo.InvariantCulture, out var parsed))
            return parsed;

        throw new ArgumentException("El horario debe usar el formato HH:mm");
    }

    public static void ValidateBusinessHours(TimeSpan openingTime, TimeSpan closingTime)
    {
        if (closingTime <= openingTime)
            throw new ArgumentException("La hora de cierre debe ser posterior a la hora de apertura");

        if (closingTime - openingTime < TimeSpan.FromHours(1))
            throw new ArgumentException("El establecimiento debe tener al menos una hora disponible para reservas");
    }

    public static DateTime NormalizeReservationSlot(DateTime value)
    {
        var normalized = new DateTime(value.Year, value.Month, value.Day, value.Hour, 0, 0, value.Kind);
        return normalized;
    }

    public static bool IsReservationSlotWithinSchedule(DateTime slot, TimeSpan openingTime, TimeSpan closingTime)
    {
        var slotTime = ToBusinessLocalTime(slot).TimeOfDay;
        return slotTime >= openingTime && slotTime.Add(TimeSpan.FromHours(1)) <= closingTime;
    }

    public static string ToHourMinuteString(TimeSpan value) => value.ToString(@"hh\:mm", CultureInfo.InvariantCulture);

    public static string FormatBusinessDateTime(DateTime value) => ToBusinessLocalTime(value).ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture);

    private static DateTime ToBusinessLocalTime(DateTime value)
    {
        if (value.Kind == DateTimeKind.Unspecified)
            return value;

        if (value.Kind == DateTimeKind.Utc)
            return TimeZoneInfo.ConvertTimeFromUtc(value, BusinessTimeZone.Value);

        return TimeZoneInfo.ConvertTime(value, BusinessTimeZone.Value);
    }

    private static TimeZoneInfo ResolveBusinessTimeZone()
    {
        foreach (var timeZoneId in new[] { "America/Mexico_City", "Central Standard Time (Mexico)", "Central Standard Time" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
            }
            catch (TimeZoneNotFoundException)
            {
            }
            catch (InvalidTimeZoneException)
            {
            }
        }

        return TimeZoneInfo.Local;
    }
}