import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { OferenteNavbarGastronomiaComponent } from '../oferente-navbar-gastronomia/oferente-navbar-gastronomia.component';
import { OferenteFooterGastronomiaComponent } from '../oferente-footer-gastronomia/oferente-footer-gastronomia.component';

@Component({
  selector: 'app-oferente-layout-gastronomia',
  standalone: true,
  imports: [CommonModule, RouterOutlet, OferenteNavbarGastronomiaComponent, OferenteFooterGastronomiaComponent],
  templateUrl: './oferente-layout-gastronomia.component.html',
  styleUrls: ['./oferente-layout-gastronomia.component.scss']
})
export class OferenteLayoutGastronomiaComponent implements OnInit {
  heroTitle = '';
  heroSubtitle = '';
  heroImage = '';

  constructor(private router: Router, private route: ActivatedRoute) {}

  ngOnInit() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        map(() => this.route.firstChild?.snapshot.data || {})
      )
      .subscribe((data: any) => {
        this.heroTitle = data['heroTitle'] || '';
        this.heroSubtitle = data['heroSubtitle'] || '';
        this.heroImage = data['heroImage'] || '';
      });
  }
}
