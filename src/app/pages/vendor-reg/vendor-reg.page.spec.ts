import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule, ActionSheetController, LoadingController, NavController, ToastController } from '@ionic/angular';
import { VendorRegPage } from './vendor-reg.page';
import { AuthService } from '../../services/auth';
import { SupabaseService } from '../../services/supabase';

describe('VendorRegPage', () => {
  let component: VendorRegPage;
  let fixture: ComponentFixture<VendorRegPage>;

  beforeEach(async () => {
    const toastMock = { create: jasmine.createSpy('create').and.resolveTo({ present: async () => undefined }) };
    const loadingMock = { create: jasmine.createSpy('create').and.resolveTo({ present: async () => undefined, dismiss: async () => undefined }) };
    const actionSheetMock = {
      create: jasmine.createSpy('create').and.resolveTo({ present: async () => undefined }),
    };

    await TestBed.configureTestingModule({
      declarations: [VendorRegPage],
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
              from: () => ({
                insert: () => ({
                  select: () => ({
                    single: async () => ({ data: { vendor_id: 1 }, error: null }),
                  }),
                }),
              }),
            }),
            uploadImage: async () => 'https://example.com/logo.png',
          },
        },
        { provide: NavController, useValue: { navigateRoot: jasmine.createSpy('navigateRoot') } },
        { provide: ToastController, useValue: toastMock },
        { provide: LoadingController, useValue: loadingMock },
        { provide: ActionSheetController, useValue: actionSheetMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VendorRegPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
