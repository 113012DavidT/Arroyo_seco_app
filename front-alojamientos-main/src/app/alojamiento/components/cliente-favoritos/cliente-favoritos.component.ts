import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FavoritesService } from '../../../shared/services/favorites.service';
import { ToastService } from '../../../shared/services/toast.service';

@Component({
  selector: 'app-cliente-favoritos',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './cliente-favoritos.component.html',
  styleUrls: ['./cliente-favoritos.component.scss']
})
export class ClienteFavoritosComponent {
  favoritos = computed(() => this.favs.getAll());

  constructor(private favs: FavoritesService, private toast: ToastService) {}

  remove(id: number) {
    this.favs.remove(id);
    this.toast.info('Eliminado de favoritos');
  }

  clearAll() {
    if (this.favoritos().length === 0) return;
    this.favs.clear();
    this.toast.warning('Lista de favoritos vaciada');
  }
}
