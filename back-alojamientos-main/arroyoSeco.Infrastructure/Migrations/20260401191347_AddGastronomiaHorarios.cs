using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace arroyoSeco.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddGastronomiaHorarios : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<TimeSpan>(
                name: "HoraApertura",
                table: "Establecimientos",
                type: "time without time zone",
                nullable: false,
                defaultValue: new TimeSpan(0, 12, 0, 0, 0));

            migrationBuilder.AddColumn<TimeSpan>(
                name: "HoraCierre",
                table: "Establecimientos",
                type: "time without time zone",
                nullable: false,
                defaultValue: new TimeSpan(0, 22, 0, 0, 0));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HoraApertura",
                table: "Establecimientos");

            migrationBuilder.DropColumn(
                name: "HoraCierre",
                table: "Establecimientos");
        }
    }
}
