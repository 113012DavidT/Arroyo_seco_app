import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormRegistroAlojamientoComponent } from './form-registro-alojamiento.component';

describe('FormRegistroAlojamientoComponent', () => {
  let component: FormRegistroAlojamientoComponent;
  let fixture: ComponentFixture<FormRegistroAlojamientoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormRegistroAlojamientoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FormRegistroAlojamientoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
