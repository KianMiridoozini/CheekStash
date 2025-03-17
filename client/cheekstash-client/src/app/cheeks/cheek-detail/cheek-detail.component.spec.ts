import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CheekDetailComponent } from './cheek-detail.component';

describe('CheekDetailComponent', () => {
  let component: CheekDetailComponent;
  let fixture: ComponentFixture<CheekDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheekDetailComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CheekDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
