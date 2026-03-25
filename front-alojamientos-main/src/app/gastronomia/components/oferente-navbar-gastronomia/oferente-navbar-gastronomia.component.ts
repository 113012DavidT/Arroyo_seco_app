import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-oferente-navbar-gastronomia',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './oferente-navbar-gastronomia.component.html',
  styleUrls: ['./oferente-navbar-gastronomia.component.scss']
})
export class OferenteNavbarGastronomiaComponent {
  menuOpen = false;
  constructor(private auth: AuthService, private router: Router) {}
  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu() {
    this.menuOpen = false;
  }

  logout() {
    this.menuOpen = false;
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
