import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

    // Listen for auth changes
    this.supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        this.currentUserSubject.next(session.user);
        localStorage.setItem('user', JSON.stringify(session.user));
      } else {
        this.currentUserSubject.next(null);
        localStorage.removeItem('user');
      }
    });

    // Load stored user
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      this.currentUserSubject.next(JSON.parse(storedUser));
    }
  }

  getSupabase(): SupabaseClient {
    return this.supabase;
  }

  // Authentication Methods
  async signUp(email: string, password: string, userData: any) {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData
      }
    });
    if (error) throw error;
    
    // Create user profile
    if (data.user) {
      // Best-effort: if public profile insert fails, allow auth signup to succeed.
      try {
        await this.createUserProfile(data.user.id, userData, email, password);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('User profile insert failed (non-fatal):', e);
      }
    }
    
    return data;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  }

  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }

  async resetPassword(email: string) {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  // User Profile Methods
  async createUserProfile(userId: string, userData: any, email: string, password: string) {
    const firstName = userData?.first_name ?? userData?.firstName ?? '';
    const lastName = userData?.last_name ?? userData?.lastName ?? '';
    const fullName = `${firstName} ${lastName}`.trim();

    const { error } = await this.supabase
      .from('users')
      .insert([
        {
          user_id: userId,
          email,
          password,
          full_name: fullName,
          phone: userData?.phone ?? null,
          avatar_url: userData?.avatar_url ?? null,
          created_date: new Date(),
          updated_date: new Date()
        }
      ]);
    
    if (error) throw error;
  }

  async getUserProfile(userId: string) {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error) throw error;

    const fullName = (data?.full_name ?? '').trim();
    const [firstName, ...rest] = fullName.split(' ');
    const lastName = rest.join(' ');

    return {
      id: String(data.user_id),
      email: data.email,
      first_name: firstName || '',
      last_name: lastName || '',
      phone: data.phone,
      avatar_url: data.avatar_url,
      created_at: data.created_date ? new Date(data.created_date) : new Date(),
      updated_at: data.updated_date ? new Date(data.updated_date) : new Date()
    };
  }

  async updateUserProfile(userId: string, updates: any) {
    // Build an update that matches the `users` schema.
    const firstName = updates?.first_name ?? updates?.firstName;
    const lastName = updates?.last_name ?? updates?.lastName;
    const fullName =
      firstName != null || lastName != null
        ? `${firstName ?? ''} ${lastName ?? ''}`.trim()
        : undefined;

    const updatePayload: any = {
      phone: updates?.phone ?? undefined,
      avatar_url: updates?.avatar_url ?? undefined,
      updated_date: new Date()
    };

    if (fullName) updatePayload.full_name = fullName;

    const { data, error } = await this.supabase
      .from('users')
      .update(updatePayload)
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error) throw error;

    const updatedFullName = (data?.full_name ?? '').trim();
    const [updatedFirstName, ...rest] = updatedFullName.split(' ');
    const updatedLastName = rest.join(' ');

    return {
      id: String(data.user_id),
      email: data.email,
      first_name: updatedFirstName || '',
      last_name: updatedLastName || '',
      phone: data.phone,
      avatar_url: data.avatar_url,
      created_at: data.created_date ? new Date(data.created_date) : new Date(),
      updated_at: data.updated_date ? new Date(data.updated_date) : new Date()
    };
  }

  // Storage Methods — bucket must exist; policies must allow INSERT for authenticated vendors.
  async uploadImage(file: File, path: string): Promise<string> {
    const bucket = 'products';
    const { error } = await this.supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type?.startsWith('image/') ? file.type : 'image/jpeg',
    });

    if (error) {
      console.error('Supabase storage upload error:', error);
      throw new Error(error.message || 'Storage upload failed');
    }

    const { data } = this.supabase.storage.from(bucket).getPublicUrl(path);
    const publicUrl = data?.publicUrl;
    if (!publicUrl) {
      throw new Error('Could not resolve public URL for uploaded file');
    }
    return publicUrl;
  }

  // Realtime Subscriptions
  subscribeToTable(table: string, callback: (payload: any) => void) {
    return this.supabase
      .channel(`${table}-changes`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: table },
        (payload) => callback(payload)
      )
      .subscribe();
  }

  unsubscribeFromChannel(channel: string) {
    this.supabase.removeChannel(this.supabase.channel(channel));
  }
}