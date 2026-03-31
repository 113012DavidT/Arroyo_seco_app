using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace arroyoSeco.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ModeracionReviewsYGeocerca : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Estado",
                table: "Reviews",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Pendiente");

            migrationBuilder.AddColumn<DateTime>(
                name: "FechaModeracionUtc",
                table: "Reviews",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ModeradaPorId",
                table: "Reviews",
                type: "character varying(450)",
                maxLength: 450,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MotivoRechazo",
                table: "Reviews",
                type: "character varying(250)",
                maxLength: 250,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Reviews_Estado",
                table: "Reviews",
                column: "Estado");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Reviews_Estado",
                table: "Reviews");

            migrationBuilder.DropColumn(
                name: "Estado",
                table: "Reviews");

            migrationBuilder.DropColumn(
                name: "FechaModeracionUtc",
                table: "Reviews");

            migrationBuilder.DropColumn(
                name: "ModeradaPorId",
                table: "Reviews");

            migrationBuilder.DropColumn(
                name: "MotivoRechazo",
                table: "Reviews");
        }
    }
}
