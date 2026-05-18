import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule, LoadingController, NavController, ToastController } from '@ionic/angular';
import { DriverRegPage } from './driver-reg.page';
import { AuthService } from '../../services/auth';
import { SupabaseService } from '../../services/supabase';

describe('DriverRegPage', () => {
  let component: DriverRegPage;
  let fixture: ComponentFixture<DriverRegPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DriverRegPage],
      imports: [IonicModule.forRoot(), ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: { isAuthenticated: () => false, getCurrentUser: () => null } },
        {
          provide: SupabaseService,
          useValue: {
            getSupabase: () => ({
              storage: {
                from: () => ({
                  upload: async () => ({ error: null }),
                  getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/doc' } }),
                }),
              },
              from: () => ({ insert: async () => ({ error: null }) }),
            }),
            uploadImage: async () => 'https://example.com/license.jpg',
          },
        },
        { provide: NavController, useValue: { navigateRoot: jasmine.createSpy('navigateRoot') } },
        {
          provide: ToastController,
          useValue: { create: jasmine.createSpy('create').and.resolveTo({ present: async () => undefined }) },
        },
        {
          provide: LoadingController,
          useValue: { create: jasmine.createSpy('create').and.resolveTo({ present: async () => undefined, dismiss: async () => undefined }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DriverRegPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
