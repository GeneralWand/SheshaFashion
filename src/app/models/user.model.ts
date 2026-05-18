export type AppUserRole = 'vendor' | 'customer' | 'driver' | 'admin';

export interface Profile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  role?: AppUserRole;
  status?: 'active' | 'inactive' | 'suspended' | string;
  created_at: Date;
  updated_at: Date;
}
  
  export interface UserRegistration {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
    /** When present, stored on `users.role` during signup. */
    role?: AppUserRole;
  }
  
  export interface UserCredentials {
    email: string;
    password: string;
  }