import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListaGastronomiaComponent } from './lista-gastronomia.component';

describe('ListaGastronomiaComponent', () => {
  let component: ListaGastronomiaComponent;
  let fixture: ComponentFixture<ListaGastronomiaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListaGastronomiaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListaGastronomiaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
