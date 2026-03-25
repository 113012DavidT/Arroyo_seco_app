import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

interface ModuleType {
  title: string;
  description: string;
  route: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-oferente-home-selector',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './oferente-home-selector.component.html',
  styleUrl: './oferente-home-selector.component.scss'
})
export class OferenteHomeSelectorComponent implements OnInit {
  hideSelector = false;

  constructor(
    private router: Router,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    const tipo = this.auth.getTipoNegocio();

    if (tipo === 1) {
      this.hideSelector = true;
      this.router.navigate(['/oferente/dashboard']);
      return;
    }

    if (tipo === 2) {
      this.hideSelector = true;
      this.router.navigate(['/oferente/gastronomia/dashboard']);
      return;
    }
  }

  readonly modules: ModuleType[] = [
    {
      title: 'Alojamiento',
      description: 'Gestiona tus hospedajes y reservas',
      route: '/oferente/dashboard',
      icon: 'alojamiento',
      color: '#E31B23'
    },
    {
      title: 'Gastronomía',
      description: 'Gestiona tus restaurantes y reservas',
      route: '/oferente/gastronomia/dashboard',
      icon: 'gastronomia',
      color: '#E31B23'
    }
  ];
}
