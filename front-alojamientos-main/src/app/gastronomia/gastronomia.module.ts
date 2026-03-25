import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GastronomiaRoutingModule } from './gastronomia-routing.module';

// Los componentes son standalone, no necesitan declararse aquí
// Este módulo sirve principalmente para lazy loading si se requiere

@NgModule({
  imports: [
    CommonModule,
    GastronomiaRoutingModule
  ]
})
export class GastronomiaModule { }
