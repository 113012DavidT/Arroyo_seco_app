using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;

namespace arroyoSeco.Application.Common.Validation;

public static class ProfanityFilter
{
    private static readonly HashSet<string> BannedWords = new(StringComparer.OrdinalIgnoreCase)
    {
        // Spanish
        "puta", "puto", "putos", "putas", "pendejo", "pendeja", "pendejos", "pendejas",
        "cabron", "cabrona", "cabrones", "cabronas", "chingar", "chingada", "chingado",
        "chingados", "chingadas", "mierda", "pinche", "culero", "culera", "culeros", "culeras",
        "estupido", "estupida", "imbecil", "idiota", "verga", "joder", "maldito", "maldita",

        // English
        "fuck", "fucking", "fucked", "shit", "bitch", "bastard", "asshole", "dick",
        "motherfucker", "slut", "whore", "damn", "crap"
    };

    public static bool ContainsProfanity(string? text, out string detectedWord)
    {
        detectedWord = string.Empty;
        if (string.IsNullOrWhiteSpace(text))
            return false;

        var normalized = Normalize(text);
        var tokens = Regex.Split(normalized, "[^a-z]+")
            .Where(token => !string.IsNullOrWhiteSpace(token));

        foreach (var token in tokens)
        {
            if (!BannedWords.Contains(token))
                continue;

            detectedWord = token;
            return true;
        }

        return false;
    }

    private static string Normalize(string value)
    {
        var lower = value.Trim().ToLowerInvariant();
        var formD = lower.Normalize(NormalizationForm.FormD);

        var sb = new StringBuilder(formD.Length);
        foreach (var c in formD)
        {
            var category = CharUnicodeInfo.GetUnicodeCategory(c);
            if (category == UnicodeCategory.NonSpacingMark)
                continue;

            sb.Append(c);
        }

        return sb.ToString().Normalize(NormalizationForm.FormC);
    }
}
