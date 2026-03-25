import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { ClienteNavbarGastronomiaComponent } from '../cliente-navbar-gastronomia/cliente-navbar-gastronomia.component';
import { ClienteFooterGastronomiaComponent } from '../cliente-footer-gastronomia/cliente-footer-gastronomia.component';

@Component({
  selector: 'app-cliente-layout-gastronomia',
  standalone: true,
  imports: [CommonModule, RouterOutlet, ClienteNavbarGastronomiaComponent, ClienteFooterGastronomiaComponent],
  templateUrl: './cliente-layout-gastronomia.component.html',
  styleUrls: ['./cliente-layout-gastronomia.component.scss']
})
export class ClienteLayoutGastronomiaComponent implements OnInit {
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
