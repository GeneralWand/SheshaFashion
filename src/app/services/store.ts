import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase';
import { Store, StoreProduct, OpeningHours } from '../models/store.model';
import { normalizeImageUrls } from '../utils/media';

@Injectable({
  providedIn: 'root'
})
export class StoreService {
  constructor(private supabaseService: SupabaseService) {}

  private mapStoreOpeningHours(openingHours: any): OpeningHours[] {
    if (!openingHours || typeof openingHours !== 'object') return [];

    return Object.entries(openingHours).map(([dayKey, value]: [string, any]) => {
      const day =
        dayKey && dayKey.length > 0
          ? dayKey.charAt(0).toUpperCase() + dayKey.slice(1)
          : dayKey;

      return {
        day,
        open: value?.open ?? '',
        close: value?.close ?? '',
        is_closed: !!value?.closed
      } as OpeningHours;
    });
  }

  private mapStore(raw: any): Store {
    return {
      ...raw,
      store_id: String(raw.store_id),
      vendor_id: String(raw.vendor_id),
      logo_url: raw.logo_url ?? raw.logo ?? '',
      cover_image_url: raw.cover_image_url ?? raw.cover_image ?? '',
      is_open: raw.status === 'open',
      opening_hours: this.mapStoreOpeningHours(raw.opening_hours),
      // Address is jsonb in DB; keep as-is and let UI read it where needed.
      address: raw.address
    } as Store;
  }

  private mapProduct(raw: any): StoreProduct {
    return {
      product_id: String(raw.product_id),
      store_id: String(raw.store_id),
      name: raw.name,
      description: raw.description,
      price: Number(raw.price),
      discount_price: raw.discount_price != null ? Number(raw.discount_price) : undefined,
      images: normalizeImageUrls(raw.images),
      // UI uses category as a string.
      category: raw.category != null ? String(raw.category) : raw.category_name ? String(raw.category_name) : '',
      category_id: raw.category_id != null ? String(raw.category_id) : undefined,
      size: raw.size != null ? String(raw.size) : null,
      color: raw.color != null ? String(raw.color) : null,
      is_available: raw.status === 'available',
      is_featured: !!raw.is_featured,
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      variants: Array.isArray(raw.variants) ? raw.variants : [],
      status: raw.status,
      created_date: raw.created_date ? new Date(raw.created_date) : new Date(),
      updated_date: raw.updated_date ? new Date(raw.updated_date) : new Date()
    } as StoreProduct;
  }

  async getStores(params?: any): Promise<Store[]> {
    let query = this.supabaseService.getSupabase()
      .from('stores')
      .select(`
        *,
        vendor:vendors(*)
      `)
      .eq('status', 'open');

    if (params?.search) {
      query = query.ilike('name', `%${params.search}%`);
    }
    if (params?.category) {
      // stores.category is a USER-DEFINED type in schema; leave as provided.
      query = query.eq('category', params.category);
    }
    if (params?.featured) {
      query = query.eq('is_featured', true);
    }
    if (params?.latitude && params?.longitude) {
      // Order by distance (simplified)
      query = query.order('name');
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((s: any) => this.mapStore(s));
  }

  async getStoreById(id: string): Promise<Store> {
    const { data, error } = await this.supabaseService.getSupabase()
      .from('stores')
      .select(`
        *,
        vendor:vendors(*)
      `)
      .eq('store_id', id)
      .single();

    if (error) throw error;
    return this.mapStore(data);
  }

  /** All stores for a vendor (ordered oldest → newest). */
  async getStoresByVendorId(vendorId: string): Promise<Store[]> {
    const { data, error } = await this.supabaseService.getSupabase()
      .from('stores')
      .select(`
        *,
        vendor:vendors(*)
      `)
      .eq('vendor_id', vendorId)
      .order('created_date', { ascending: true });

    if (error) throw error;
    return (data || []).map((s: any) => this.mapStore(s));
  }

  /** First store for a vendor (legacy helper when only one row is expected). */
  async getStoreByVendorId(vendorId: string): Promise<Store | null> {
    const list = await this.getStoresByVendorId(vendorId);
    return list.length ? list[0] : null;
  }

  async getStoreProducts(storeId: string, params?: any): Promise<StoreProduct[]> {
    let query = this.supabaseService.getSupabase().from('products')
      .select(`
        product_id,
        store_id,
        name,
        description,
        price,
        discount_price,
        images,
        status,
        is_featured,
        tags,
        category_id,
        size,
        color,
        variants,
        created_date,
        updated_date
      `)
      .eq('store_id', storeId);

    if (params?.search) query = query.ilike('name', `%${params.search}%`);
    if (params?.featured) query = query.eq('is_featured', true);

    const { data: productsRaw, error } = await query;
    if (error) throw error;

    const products = productsRaw || [];

    // Map category_id -> category name (UI uses category labels).
    const categoryIds = [...new Set(products.map((p: any) => p.category_id).filter(Boolean))];
    const { data: categoriesRaw, error: categoriesError } = categoryIds.length
      ? await this.supabaseService.getSupabase()
        .from('categories')
        .select('category_id, name')
        .in('category_id', categoryIds)
      : { data: [], error: null };

    if (categoriesError) throw categoriesError;

    const categoryMap = new Map((categoriesRaw || []).map((c: any) => [String(c.category_id), c.name]));

    return products.map((p: any) => {
      const categoryName = p.category_id ? categoryMap.get(String(p.category_id)) : '';
      const mapped = this.mapProduct({ ...p, category_name: categoryName });
      // Allow optional filtering by category (expects category name).
      if (params?.category && mapped.category !== params.category) return null;
      return mapped;
    }).filter((x: StoreProduct | null): x is StoreProduct => !!x);
  }

  async getStoreCategories(storeId: string): Promise<string[]> {
    const { data: productsRaw, error: productsError } = await this.supabaseService.getSupabase()
      .from('products')
      .select('category_id')
      .eq('store_id', storeId)
      .not('category_id', 'is', null);

    if (productsError) throw productsError;

    const categoryIds = [...new Set((productsRaw || []).map((p: any) => p.category_id).filter(Boolean))];
    if (!categoryIds.length) return [];

    const { data: categoriesRaw, error: categoriesError } = await this.supabaseService.getSupabase()
      .from('categories')
      .select('category_id, name')
      .in('category_id', categoryIds);

    if (categoriesError) throw categoriesError;

    return (categoriesRaw || []).map((c: any) => c.name).filter(Boolean);
  }

  async searchStores(query: string, lat?: number, lng?: number): Promise<Store[]> {
    let supabaseQuery = this.supabaseService.getSupabase()
      .from('stores')
      .select('*')
      .ilike('name', `%${query}%`)
      .eq('status', 'open');

    if (lat && lng) {
      // You can implement distance calculation here
      // This is a simplified version
      supabaseQuery = supabaseQuery.order('name');
    }

    const { data, error } = await supabaseQuery;
    if (error) throw error;
    return (data || []).map((s: any) => this.mapStore(s));
  }

  async getFeaturedStores(limit: number = 10): Promise<Store[]> {
    const { data, error } = await this.supabaseService.getSupabase()
      .from('stores')
      .select('*')
      .eq('is_featured', true)
      .eq('status', 'open')
      .limit(limit);

    if (error) throw error;
    return (data || []).map((s: any) => this.mapStore(s));
  }

  async isStoreOpen(storeId: string): Promise<boolean> {
    const { data, error } = await this.supabaseService.getSupabase()
      .from('stores')
      .select('opening_hours, status')
      .eq('store_id', storeId)
      .single();

    if (error) throw error;
    if (!data || data.status !== 'open') return false;

    const now = new Date();
    const currentDayKey = now
      .toLocaleDateString('en-US', { weekday: 'long' })
      .toLowerCase(); // "Thursday" -> "thursday"
    const currentTime = now.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });

    const hoursObj = data.opening_hours as any;
    const today = hoursObj?.[currentDayKey];
    if (!today) return false;
    if (today.closed) return false;

    const openTime = String(today.open || '');
    const closeTime = String(today.close || '');
    if (!openTime || !closeTime) return false;

    return currentTime >= openTime && currentTime <= closeTime;
  }
}