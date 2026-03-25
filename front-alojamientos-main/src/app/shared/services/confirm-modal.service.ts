import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ConfirmModalData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean; // Si es true, el botón será rojo
}

@Injectable({ providedIn: 'root' })
export class ConfirmModalService {
  private modalSubject = new BehaviorSubject<ConfirmModalData | null>(null);
  public modal$ = this.modalSubject.asObservable();

  private resultSubject = new BehaviorSubject<boolean | null>(null);
  public result$ = this.resultSubject.asObservable();

  confirm(data: ConfirmModalData): Promise<boolean> {
    return new Promise((resolve) => {
      this.modalSubject.next(data);
      
      const subscription = this.result$.subscribe(result => {
        if (result !== null) {
          this.modalSubject.next(null);
          subscription.unsubscribe();
          resolve(result);
          this.resultSubject.next(null);
        }
      });
    });
  }

  resolve(result: boolean) {
    this.resultSubject.next(result);
  }

  close() {
    this.modalSubject.next(null);
    this.resultSubject.next(false);
  }
}
