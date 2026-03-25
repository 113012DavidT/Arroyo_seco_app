import { Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, ActivatedRoute, NavigationEnd } from '@angular/router';
import { filter, startWith } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminNavbarComponent } from '../admin-navbar/admin-navbar.component';
import { AdminFooterComponent } from '../admin-footer/admin-footer.component';
import { MobileBottomNavComponent } from '../../../shared/components/mobile-bottom-nav/mobile-bottom-nav.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, AdminNavbarComponent, AdminFooterComponent, MobileBottomNavComponent],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss'
})
export class AdminLayoutComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  heroTitle = '';
  heroSubtitle = '';
  private readonly gradientBackground = 'linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45))';

  heroImage: string | null = null;
  heroBackground = this.gradientBackground;

  constructor() {
    this.router.events
      .pipe(
  filter((event: unknown): event is NavigationEnd => event instanceof NavigationEnd),
        startWith(null),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.updateHero());

    this.updateHero();
  }

  private updateHero(): void {
  const deepest = this.getDeepestChild(this.route);
  const data = deepest?.snapshot?.data ?? {};

    this.heroTitle = data['heroTitle'] ?? 'Gestión administrativa';
    this.heroSubtitle = data['heroSubtitle'] ?? '';
    this.heroImage = data['heroImage'] ?? null;
    this.heroBackground = this.heroImage
      ? `${this.gradientBackground}, url('${this.heroImage}')`
      : this.gradientBackground;
  }

  private getDeepestChild(route: ActivatedRoute | null): ActivatedRoute | null {
    let current = route;
    while (current?.firstChild) {
      current = current.firstChild;
    }
    return current;
  }
}
