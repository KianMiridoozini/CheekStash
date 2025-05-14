import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CheekSearchComponent } from './cheek-search.component';

describe('CheekSearchComponent', () => {
  let component: CheekSearchComponent;
  let fixture: ComponentFixture<CheekSearchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheekSearchComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CheekSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
