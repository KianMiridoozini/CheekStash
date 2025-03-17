import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CheekListComponent } from './cheek-list.component';

describe('CheekListComponent', () => {
  let component: CheekListComponent;
  let fixture: ComponentFixture<CheekListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheekListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CheekListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
