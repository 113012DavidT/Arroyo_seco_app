import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { ClienteNavbarComponent } from '../cliente-navbar/cliente-navbar.component';
import { ClienteFooterComponent } from '../cliente-footer/cliente-footer.component';
import { MobileBottomNavComponent } from '../../../shared/components/mobile-bottom-nav/mobile-bottom-nav.component';

@Component({
  selector: 'app-cliente-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, ClienteNavbarComponent, ClienteFooterComponent, MobileBottomNavComponent],
  templateUrl: './cliente-layout.component.html',
  styleUrls: ['./cliente-layout.component.scss']
})
export class ClienteLayoutComponent implements OnInit {
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
