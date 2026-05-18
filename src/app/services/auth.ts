import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase';
import { UserCredentials, UserRegistration, Profile, AppUserRole } from '../models/user.model';
import { isUsersEmailUniqueViolation } from '../utils/postgres-errors';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly sessionStorageKey = 'app_user_profile';
  private currentProfileSubject = new BehaviorSubject<Profile | null>(null);
  public currentProfile$: Observable<Profile | null> = this.currentProfileSubject.asObservable();

  constructor(private supabaseService: SupabaseService) {
    this.loadStoredSession();
  }

  private loadStoredSession(): void {
    try {
      const raw = localStorage.getItem(this.sessionStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.id && parsed?.email) {
        this.currentProfileSubject.next({
          ...parsed,
          created_at: parsed.created_at ? new Date(parsed.created_at) : new Date(),
          updated_at: parsed.updated_at ? new Date(parsed.updated_at) : new Date()
        });
      }
    } catch {
      localStorage.removeItem(this.sessionStorageKey);
    }
  }

  private setSession(profile: Profile | null): void {
    this.currentProfileSubject.next(profile);
    if (!profile) {
      localStorage.removeItem(this.sessionStorageKey);
      return;
    }
    localStorage.setItem(this.sessionStorageKey, JSON.stringify(profile));
  }

  private mapDbUserToProfile(data: any): Profile {
    const fullName = (data?.full_name ?? '').trim();
    const [firstName, ...rest] = fullName.split(' ');
    const rawRole = data?.role;
    const role: AppUserRole | undefined =
      rawRole === 'vendor' || rawRole === 'customer' || rawRole === 'driver' || rawRole === 'admin'
        ? rawRole
        : undefined;
    return {
      id: String(data.user_id),
      email: data.email,
      first_name: firstName || '',
      last_name: rest.join(' '),
      phone: data.phone ?? null,
      avatar_url: data.avatar_url ?? null,
      role,
      status: data.status,
      created_at: data.created_date ? new Date(data.created_date) : new Date(),
      updated_at: data.updated_date ? new Date(data.updated_date) : new Date()
    };
  }

  async login(credentials: UserCredentials): Promise<Profile> {
    const { data, error } = await this.supabaseService.getSupabase()
      .from('users')
      .select('*')
      .eq('email', credentials.email.trim().toLowerCase())
      .eq('password', credentials.password)
      .single();

    if (error || !data) {
      throw new Error('Invalid login credentials');
    }

    if (data.status && data.status !== 'active') {
      throw new Error('This account is not active');
    }

    const profile = this.mapDbUserToProfile(data);
    this.setSession(profile);
    return profile;
  }

  async register(userData: UserRegistration): Promise<Profile> {
    const fullName = `${userData.firstName} ${userData.lastName}`.trim();

    const row: {
      email: string;
      password: string;
      full_name: string;
      phone: string;
      role?: AppUserRole;
    } = {
      email: userData.email.trim().toLowerCase(),
      password: userData.password,
      full_name: fullName,
      phone: userData.phone,
    };
    if (userData.role != null && String(userData.role).trim() !== '') {
      row.role = userData.role;
    }

    const { data, error } = await this.supabaseService.getSupabase().from('users').insert(row).select('*').single();

    if (error || !data) {
      if (error && isUsersEmailUniqueViolation(error)) {
        throw new Error('User already registered');
      }
      throw error ?? new Error('Registration failed');
    }

    const profile = this.mapDbUserToProfile(data);
    this.setSession(profile);
    return profile;
  }

  async loginWithGoogle(): Promise<any> {
    throw new Error('Google login is not configured for database-based auth');
  }

  async logout(): Promise<void> {
    this.setSession(null);
  }

  async resetPassword(email: string): Promise<void> {
    const { error } = await this.supabaseService.getSupabase()
      .from('users')
      .update({ updated_date: new Date() })
      .eq('email', email.trim().toLowerCase());
    if (error) throw error;
  }

  async getUserProfile(userId: string): Promise<Profile | null> {
    try {
      const { data, error } = await this.supabaseService.getSupabase()
        .from('users')
        .select('*')
        .eq('user_id', Number(userId))
        .single();

      if (error || !data) return null;
      return this.mapDbUserToProfile(data);
    } catch (error) {
      return null;
    }
  }

  async updateProfile(updates: Partial<Profile>): Promise<Profile> {
    const profile = this.currentProfileSubject.value;
    if (!profile) throw new Error('No user logged in');

    const fullName = `${updates.first_name ?? profile.first_name} ${updates.last_name ?? profile.last_name}`.trim();

    const { data, error } = await this.supabaseService.getSupabase()
      .from('users')
      .update({
        full_name: fullName,
        phone: updates.phone ?? profile.phone ?? null,
        avatar_url: updates.avatar_url ?? profile.avatar_url ?? null,
        updated_date: new Date()
      })
      .eq('user_id', Number(profile.id))
      .select('*')
      .single();

    if (error || !data) throw error ?? new Error('Failed to update profile');
    const updated = this.mapDbUserToProfile(data);
    this.setSession(updated);
    return updated;
  }

  getCurrentUser() {
    return this.currentProfileSubject.value;
  }

  getCurrentUserId(): string | null {
    return this.currentProfileSubject.value?.id || null;
  }

  /** Updates `users.role` and refreshes session when it is the logged-in profile. */
  async updateUserRole(userId: string, role: NonNullable<Profile['role']>): Promise<void> {
    const uid = Number(userId);
    if (!Number.isFinite(uid)) {
      throw new Error('Invalid user id');
    }
    const { data, error } = await this.supabaseService
      .getSupabase()
      .from('users')
      .update({ role, updated_date: new Date() })
      .eq('user_id', uid)
      .select('*')
      .single();

    if (error || !data) throw error ?? new Error('Could not update user role');

    const session = this.currentProfileSubject.value;
    if (session?.id === String(uid)) {
      this.setSession(this.mapDbUserToProfile(data));
    }
  }

  /**
   * After driver/vendor registration: tries to save `role` in `users`.
   * If the column is missing or RLS blocks the update, still updates the local session so the app works.
   */
  async persistRegistrationRole(userId: string, role: NonNullable<Profile['role']>): Promise<void> {
    try {
      await this.updateUserRole(userId, role);
    } catch (err) {
      // Typical causes: missing `users.role` column, or RLS blocking UPDATE without Supabase Auth.
      console.warn('[auth] persistRegistrationRole: using session-only role until DB permits update', err);
      const session = this.currentProfileSubject.value;
      const id = String(userId).trim();
      if (session?.id === id) {
        this.setSession({ ...session, role, updated_at: new Date() });
      }
    }
  }

  isAuthenticated(): boolean {
    return !!this.currentProfileSubject.value;
  }
}