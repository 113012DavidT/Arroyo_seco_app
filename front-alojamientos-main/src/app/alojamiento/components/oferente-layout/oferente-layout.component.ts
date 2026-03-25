import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter, map } from 'rxjs/operators';
import { OferenteNavbarComponent } from '../oferente-navbar/oferente-navbar.component';
import { OferenteFooterComponent } from '../oferente-footer/oferente-footer.component';
import { MobileBottomNavComponent } from '../../../shared/components/mobile-bottom-nav/mobile-bottom-nav.component';

interface HeroData {
  heroTitle?: string;
  heroSubtitle?: string;
  heroImage?: string;
}

@Component({
  selector: 'app-oferente-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, OferenteNavbarComponent, OferenteFooterComponent, MobileBottomNavComponent],
  templateUrl: './oferente-layout.component.html',
  styleUrl: './oferente-layout.component.scss'
})
export class OferenteLayoutComponent implements OnInit {
  heroTitle = '';
  heroSubtitle = '';
  heroStyle = '';

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.updateHero();
    
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        map(() => this.activatedRoute)
      )
      .subscribe(() => {
        this.updateHero();
      });
  }

  private updateHero(): void {
    let route = this.activatedRoute;
    while (route.firstChild) {
      route = route.firstChild;
    }

    const data = route.snapshot?.data as HeroData;
    this.heroTitle = data?.heroTitle || '';
    this.heroSubtitle = data?.heroSubtitle || '';
    
    if (data?.heroImage) {
      this.heroStyle = `background-image: url('${data.heroImage}')`;
    } else {
      this.heroStyle = 'background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)';
    }
  }
}
