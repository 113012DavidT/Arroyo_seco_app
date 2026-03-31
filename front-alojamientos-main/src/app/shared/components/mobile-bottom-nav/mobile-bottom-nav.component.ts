import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

interface BottomItem { path: string; label: string; icon: string; }

@Component({
  selector: 'app-mobile-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './mobile-bottom-nav.component.html',
  styleUrls: ['./mobile-bottom-nav.component.scss']
})
export class MobileBottomNavComponent {
  constructor(private router: Router, private auth: AuthService) {}

  private readonly iconPaths: Record<string, string> = {
    home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
    assignment: 'M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
    notifications: 'M12 22c1.1 0 1.99-.9 1.99-2H10c0 1.1.9 2 2 2zm6-6V11c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
    event: 'M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5c0-1.1-.9-2-2-2zm0 16H5V10h14v9zm0-11H5V5h14v3z',
    settings: 'M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.14 7.14 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.31.6.22l2.39-.96c.51.4 1.05.71 1.63.94l.36 2.54c.05.24.25.42.49.42h3.8c.24 0 .44-.18.49-.42l.36-2.54c.58-.23 1.12-.54 1.63-.94l2.39.96c.22.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5z',
    person: 'M12 12c2.76 0 5-2.24 5-5S14.76 2 12 2 7 4.24 7 7s2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5z',
    restaurant: 'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z'
  };

  isLoggedIn = computed(() => !!this.auth.getToken());

  iconPath(icon: string): string {
    return this.iconPaths[icon] || this.iconPaths['home'];
  }

  private isGastronomiaContext(url: string): boolean {
    return /gastronomia/.test(url);
  }

  items = computed<BottomItem[]>(() => {
    if (!this.isLoggedIn()) return [];
    const roles = this.auth.getRoles().map(r => r.toLowerCase());
    const url = this.router.url;
    const gastro = this.isGastronomiaContext(url);

    const isAdmin = roles.some(r => r.includes('admin'));
    const isOferente = roles.some(r => r.includes('oferente'));
    const isCliente = roles.some(r => r.includes('cliente')) || (!isAdmin && !isOferente);

    if (isAdmin) {
      if (gastro) {
        return [
          { path: '/admin/gastronomia/dashboard', label: 'Inicio', icon: 'home' },
          { path: '/admin/gastronomia/usuarios', label: 'Usuarios', icon: 'person' },
          { path: '/admin/gastronomia/solicitudes', label: 'Solicitudes', icon: 'assignment' },
          { path: '/admin/gastronomia/notificaciones', label: 'Notif.', icon: 'notifications' }
        ];
      }
      return [
        { path: '/admin/dashboard', label: 'Inicio', icon: 'home' },
        { path: '/admin/usuarios', label: 'Usuarios', icon: 'person' },
        { path: '/admin/solicitudes', label: 'Solicitudes', icon: 'assignment' },
        { path: '/admin/notificaciones', label: 'Notif.', icon: 'notifications' }
      ];
    }

    if (isOferente) {
      if (gastro) {
        return [
          { path: '/oferente/gastronomia/dashboard', label: 'Inicio', icon: 'home' },
          { path: '/oferente/gastronomia/reservas', label: 'Reservas', icon: 'event' },
          { path: '/oferente/gastronomia/configuracion', label: 'Config.', icon: 'settings' }
        ];
      }
      return [
        { path: '/oferente/dashboard', label: 'Inicio', icon: 'home' },
        { path: '/oferente/reservas', label: 'Reservas', icon: 'event' },
        { path: '/oferente/configuracion', label: 'Config.', icon: 'settings' }
      ];
    }

    if (isCliente) {
      if (gastro) {
        return [
          { path: '/cliente/gastronomia', label: 'Inicio', icon: 'restaurant' },
          { path: '/cliente/gastronomia/reservas', label: 'Reservas', icon: 'event' },
          { path: '/cliente/gastronomia/perfil', label: 'Perfil', icon: 'person' }
        ];
      }
      return [
        { path: '/cliente/alojamientos', label: 'Inicio', icon: 'home' },
        { path: '/cliente/reservas', label: 'Reservas', icon: 'event' },
        { path: '/cliente/perfil', label: 'Perfil', icon: 'person' }
      ];
    }
    return [];
  });
}
