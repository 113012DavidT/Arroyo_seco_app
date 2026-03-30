using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace arroyoSeco.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AgregarTipoYAmenidadesEstablecimiento : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AmenidadesCsv",
                table: "Establecimientos",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TipoEstablecimiento",
                table: "Establecimientos",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AmenidadesCsv",
                table: "Establecimientos");

            migrationBuilder.DropColumn(
                name: "TipoEstablecimiento",
                table: "Establecimientos");
        }
    }
}
