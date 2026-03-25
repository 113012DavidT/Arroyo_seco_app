import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardOferenteComponent } from './dashboard-oferente.component';

describe('DashboardOferenteComponent', () => {
  let component: DashboardOferenteComponent;
  let fixture: ComponentFixture<DashboardOferenteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardOferenteComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardOferenteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
