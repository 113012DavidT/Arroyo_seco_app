import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListaAlojamientosComponent } from './lista-alojamientos.component';

describe('ListaAlojamientosComponent', () => {
  let component: ListaAlojamientosComponent;
  let fixture: ComponentFixture<ListaAlojamientosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListaAlojamientosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListaAlojamientosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
