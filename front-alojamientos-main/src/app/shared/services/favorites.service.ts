import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface FavoriteAlojamiento {
  id: number;
  nombre: string;
  ubicacion: string;
  precioNoche: number;
  rating: number;
  imagen: string;
}

const STORAGE_KEY = 'cliente_favoritos_v1';

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private favoritesSubject = new BehaviorSubject<FavoriteAlojamiento[]>(this.loadInitial());
  favorites$ = this.favoritesSubject.asObservable();
  count$ = this.favoritesSubject.asObservable();

  private loadInitial(): FavoriteAlojamiento[] {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (!raw) return [];
      return JSON.parse(raw) as FavoriteAlojamiento[];
    } catch {
      return [];
    }
  }

  private persist() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.favoritesSubject.value));
      }
    } catch {}
  }

  getAll(): FavoriteAlojamiento[] {
    return this.favoritesSubject.value;
  }

  isFavorite(id: number): boolean {
    return this.favoritesSubject.value.some(f => f.id === id);
  }

  add(alojamiento: FavoriteAlojamiento) {
    if (this.isFavorite(alojamiento.id)) return;
    const updated = [...this.favoritesSubject.value, alojamiento];
    this.favoritesSubject.next(updated);
    this.persist();
  }

  remove(id: number) {
    const updated = this.favoritesSubject.value.filter(f => f.id !== id);
    this.favoritesSubject.next(updated);
    this.persist();
  }

  toggle(alojamiento: FavoriteAlojamiento) {
    if (this.isFavorite(alojamiento.id)) {
      this.remove(alojamiento.id);
    } else {
      this.add(alojamiento);
    }
  }

  clear() {
    this.favoritesSubject.next([]);
    this.persist();
  }
}
