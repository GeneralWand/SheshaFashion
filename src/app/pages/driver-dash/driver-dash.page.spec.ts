import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { DriverDashPage } from './driver-dash.page';

describe('DriverDashPage', () => {
  let component: DriverDashPage;
  let fixture: ComponentFixture<DriverDashPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DriverDashPage],
      imports: [IonicModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(DriverDashPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
