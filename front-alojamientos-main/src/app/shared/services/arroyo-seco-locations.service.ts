import { Injectable } from '@angular/core';

export interface CpColonias {
  cp: string;
  colonias: string[];
}

@Injectable({ providedIn: 'root' })
export class ArroyoSecoLocationsService {
  // Catálogo local para guiar captura exacta en Arroyo Seco.
  private readonly data: CpColonias[] = [
    {
      cp: '76400',
      colonias: ['Centro', 'San Juan Buenaventura', 'La Rivera', 'La Lagunita']
    },
    {
      cp: '76401',
      colonias: ['Concá', 'Tilaco', 'Santa María de Cocos', 'Arroyo Hondo']
    },
    {
      cp: '76402',
      colonias: ['Ayutla', 'La Escondida', 'Mesa de Palo Blanco', 'El Quirino']
    },
    {
      cp: '76403',
      colonias: ['Rio del Carrizal', 'Rio del Sabino', 'El Refugio', 'El Aguacate']
    }
  ];

  getCodigosPostales(): string[] {
    return this.data.map((x) => x.cp);
  }

  getColoniasByCp(cp: string): string[] {
    return this.data.find((x) => x.cp === cp)?.colonias || [];
  }

  searchColonias(term: string): string[] {
    const needle = (term || '').trim().toLowerCase();
    if (!needle) return [];

    return this.data
      .flatMap((row) => row.colonias.map((colonia) => ({ cp: row.cp, colonia })))
      .filter((item) => item.colonia.toLowerCase().includes(needle))
      .slice(0, 8)
      .map((item) => `${item.colonia} (${item.cp})`);
  }
}
