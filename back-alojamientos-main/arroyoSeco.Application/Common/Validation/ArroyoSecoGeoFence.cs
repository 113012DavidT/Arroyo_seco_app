using System;
using System.Collections.Generic;

namespace arroyoSeco.Application.Common.Validation;

public static class ArroyoSecoGeoFence
{
    // Polygon approximation of Arroyo Seco municipal limits for stricter validation.
    // Coordinate order: clockwise (lat, lng).
    private static readonly (double Lat, double Lng)[] Polygon =
    {
        (21.8080, -100.0480),
        (21.8120, -99.9940),
        (21.8030, -99.9360),
        (21.7810, -99.8770),
        (21.7520, -99.8220),
        (21.7280, -99.7770),
        (21.7010, -99.7330),
        (21.6710, -99.6910),
        (21.6390, -99.6610),
        (21.6070, -99.6440),
        (21.5790, -99.6380),
        (21.5480, -99.6460),
        (21.5210, -99.6670),
        (21.4950, -99.7030),
        (21.4730, -99.7480),
        (21.4560, -99.8010),
        (21.4470, -99.8610),
        (21.4510, -99.9140),
        (21.4680, -99.9650),
        (21.4940, -100.0060),
        (21.5310, -100.0360),
        (21.5690, -100.0530),
        (21.6160, -100.0600),
        (21.6630, -100.0570),
        (21.7050, -100.0460),
        (21.7430, -100.0340),
        (21.7760, -100.0280),
        (21.8080, -100.0480)
    };

    private static readonly (double North, double South, double East, double West) Bounds = BuildBounds(Polygon);

    public static bool Contains(double lat, double lng)
    {
        // Quick reject using bounding box first.
        if (lat < Bounds.South || lat > Bounds.North || lng < Bounds.West || lng > Bounds.East)
            return false;

        return IsPointInPolygon(lat, lng, Polygon);
    }

    public static (double North, double South, double East, double West) GetBounds() => Bounds;

    public static IReadOnlyList<(double Lat, double Lng)> GetPolygon() => Polygon;

    private static bool IsPointInPolygon(double lat, double lng, (double Lat, double Lng)[] polygon)
    {
        var inside = false;
        var j = polygon.Length - 1;

        for (var i = 0; i < polygon.Length; i++)
        {
            var xi = polygon[i].Lng;
            var yi = polygon[i].Lat;
            var xj = polygon[j].Lng;
            var yj = polygon[j].Lat;

            var intersects = ((yi > lat) != (yj > lat))
                             && (lng < (xj - xi) * (lat - yi) / ((yj - yi) + double.Epsilon) + xi);
            if (intersects)
                inside = !inside;

            j = i;
        }

        return inside;
    }

    private static (double North, double South, double East, double West) BuildBounds((double Lat, double Lng)[] polygon)
    {
        var north = double.MinValue;
        var south = double.MaxValue;
        var east = double.MinValue;
        var west = double.MaxValue;

        foreach (var point in polygon)
        {
            if (point.Lat > north) north = point.Lat;
            if (point.Lat < south) south = point.Lat;
            if (point.Lng > east) east = point.Lng;
            if (point.Lng < west) west = point.Lng;
        }

        return (north, south, east, west);
    }
}
