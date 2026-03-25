import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmModalService, ConfirmModalData } from '../../services/confirm-modal.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-modal.component.html',
  styleUrl: './confirm-modal.component.scss'
})
export class ConfirmModalComponent implements OnInit {
  private modalService = inject(ConfirmModalService);
  modal$: Observable<ConfirmModalData | null> = null!;

  ngOnInit(): void {
    this.modal$ = this.modalService.modal$;
  }

  confirm() {
    this.modalService.resolve(true);
  }

  cancel() {
    this.modalService.resolve(false);
  }
}
