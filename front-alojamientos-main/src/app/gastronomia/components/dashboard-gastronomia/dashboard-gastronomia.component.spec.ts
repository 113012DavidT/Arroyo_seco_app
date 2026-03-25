import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardGastronomiaComponent } from './dashboard-gastronomia.component';

describe('DashboardGastronomiaComponent', () => {
  let component: DashboardGastronomiaComponent;
  let fixture: ComponentFixture<DashboardGastronomiaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardGastronomiaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardGastronomiaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
