import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { AdminDashPage } from './admin-dash.page';
import { SupabaseService } from '../../services/supabase';

describe('AdminDashPage', () => {
  let component: AdminDashPage;
  let fixture: ComponentFixture<AdminDashPage>;

  beforeEach(async () => {
    const empty = { data: [], error: null as any, count: 0 };
    const supabaseMock = {
      from: () => ({
        select: () => ({
          order: () => Promise.resolve(empty),
          eq: () => Promise.resolve({ ...empty, count: 2 }),
          in: () => Promise.resolve(empty),
        }),
        insert: () => ({
          select: () => ({
            single: async () => ({ data: {}, error: null }),
          }),
        }),
        update: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
        delete: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }),
    };

    await TestBed.configureTestingModule({
      declarations: [AdminDashPage],
      imports: [IonicModule.forRoot()],
      providers: [{ provide: SupabaseService, useValue: { getSupabase: () => supabaseMock } }],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
