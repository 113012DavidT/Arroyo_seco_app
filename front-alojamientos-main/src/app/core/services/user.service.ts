import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

export interface ClienteDto {
  id?: string;
  nombre?: string;
  nombreCompleto?: string;
  email?: string;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private api = inject(ApiService);

  getCliente(id: string): Observable<ClienteDto> {
    return this.api.get<ClienteDto>(`/Clientes/${id}`);
  }
}
