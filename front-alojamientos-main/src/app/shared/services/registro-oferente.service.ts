import { inject, Injectable } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { Observable } from 'rxjs';

export interface RegistroOferentePayload {
  id?: number;
  nombreSolicitante: string;
  telefono: string;
  nombreNegocio?: string;
  correo?: string;
  mensaje?: string;
  estatus?: string;
  fechaSolicitud?: string;
  fechaRespuesta?: string;
  adminId?: string;
}

@Injectable({ providedIn: 'root' })
export class RegistroOferenteService {
  private readonly api = inject(ApiService);

  submitSolicitud(payload: RegistroOferentePayload): Observable<any> {
    return this.api.post('/SolicitudesOferente', payload);
  }

  list(): Observable<any[]> {
    return this.api.get<any[]>('/SolicitudesOferente');
  }

  getById(id: number): Observable<any> {
    return this.api.get<any>(`/SolicitudesOferente/${id}`);
  }
}
