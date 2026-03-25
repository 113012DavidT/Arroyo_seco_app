import { TestBed } from '@angular/core/testing';

import { GastronomiaService } from './gastronomia.service';

describe('GastronomiaService', () => {
  let service: GastronomiaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GastronomiaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
