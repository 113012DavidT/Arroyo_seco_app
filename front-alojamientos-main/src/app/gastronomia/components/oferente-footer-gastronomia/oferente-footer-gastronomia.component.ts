import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-oferente-footer-gastronomia',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './oferente-footer-gastronomia.component.html',
  styleUrls: ['./oferente-footer-gastronomia.component.scss']
})
export class OferenteFooterGastronomiaComponent { 
  year = new Date().getFullYear(); 
}
