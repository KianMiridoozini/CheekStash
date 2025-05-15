import { TestBed } from '@angular/core/testing';

import { CheeksService } from './cheeks.service';

describe('CheeksService', () => {
  let service: CheeksService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CheeksService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
