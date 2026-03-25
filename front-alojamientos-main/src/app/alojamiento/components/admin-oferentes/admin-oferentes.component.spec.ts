import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminOferentesComponent } from './admin-oferentes.component';

describe('AdminOferentesComponent', () => {
  let component: AdminOferentesComponent;
  let fixture: ComponentFixture<AdminOferentesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminOferentesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminOferentesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
