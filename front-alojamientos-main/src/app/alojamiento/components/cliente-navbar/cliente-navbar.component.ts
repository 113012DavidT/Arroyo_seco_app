import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FavoritesService } from '../../../shared/services/favorites.service';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-cliente-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './cliente-navbar.component.html',
  styleUrls: ['./cliente-navbar.component.scss']
})
export class ClienteNavbarComponent {
  count = 0;
  private sub?: any;

  constructor(private favs: FavoritesService, private auth: AuthService, private router: Router) {
    this.sub = this.favs.favorites$.subscribe(list => this.count = list.length);
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  menuOpen = false;
  toggleMenu() { this.menuOpen = !this.menuOpen; }
  closeMenu() { this.menuOpen = false; }
}
