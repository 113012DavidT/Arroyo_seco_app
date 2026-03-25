import { Component } from '@angular/core';
import { NgFor } from '@angular/common';

interface FooterSection {
  title: string;
  items: string[];
}

@Component({
  selector: 'app-oferente-footer',
  standalone: true,
  imports: [NgFor],
  templateUrl: './oferente-footer.component.html',
  styleUrl: './oferente-footer.component.scss'
})
export class OferenteFooterComponent {
  readonly sections: FooterSection[] = [
    {
      title: 'Contacto',
      items: [
        'Teléfono: (442) 774 77 16',
        'Ubicación: Plaza principal s/n, Col. Centro, Arroyo Seco, Querétaro',
        'Correo: contacto@arroyoseco.gob.mx',
        'Horario: Lunes a Viernes 8:00 a 17:00 hrs'
      ]
    },
    {
      title: 'Soporte',
      items: ['Centro de ayuda', 'Preguntas frecuentes']
    },
    {
      title: 'Legal',
      items: ['Términos y condiciones', 'Aviso de privacidad']
    }
  ];
}
