import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetalleAlojamientoComponent } from './detalle-alojamiento.component';

describe('DetalleAlojamientoComponent', () => {
  let component: DetalleAlojamientoComponent;
  let fixture: ComponentFixture<DetalleAlojamientoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetalleAlojamientoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DetalleAlojamientoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
