import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { Subscription, filter } from 'rxjs';

@Component({
  selector: 'app-cliente-navbar-gastronomia',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './cliente-navbar-gastronomia.component.html',
  styleUrls: ['./cliente-navbar-gastronomia.component.scss']
})
export class ClienteNavbarGastronomiaComponent implements OnInit, OnDestroy {
  menuOpen = false;
  private routeSub?: Subscription;

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit() {
    this.routeSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.closeMenu());
  }

  ngOnDestroy() {
    this.routeSub?.unsubscribe();
    this.setBodyScrollLock(false);
  }

  @HostListener('window:resize')
  onResize() {
    if (window.innerWidth >= 768 && this.menuOpen) {
      this.closeMenu();
    }
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
    this.setBodyScrollLock(this.menuOpen);
  }

  closeMenu() {
    this.menuOpen = false;
    this.setBodyScrollLock(false);
  }

  logout() {
    this.menuOpen = false;
    this.setBodyScrollLock(false);
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  private setBodyScrollLock(locked: boolean) {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = locked ? 'hidden' : '';
  }
}
