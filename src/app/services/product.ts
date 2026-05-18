import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase';
import { Product, ProductVariant } from '../models/product.model';
import { Category } from '../models/category.model';
import { normalizeImageUrls } from '../utils/media';


@Injectable({
  providedIn: 'root'
})
export class ProductService {
  constructor(private supabaseService: SupabaseService) {}

  private mapProductRow(row: any): any {
    if (!row) return row;
    return { ...row, images: normalizeImageUrls(row.images) };
  }

  async getProducts(params?: any): Promise<Product[]> {
    let query = this.supabaseService.getSupabase()
      .from('products')
      .select(`
        *,
        category:categories(*)
      `);

    if (params?.category) {
      query = query.eq('category_id', params.category);
    }
    if (params?.featured) {
      query = query.eq('is_featured', true);
    }
    if (params?.search) {
      query = query.ilike('name', `%${params.search}%`);
    }
    if (params?.minPrice) {
      query = query.gte('price', params.minPrice);
    }
    if (params?.maxPrice) {
      query = query.lte('price', params.maxPrice);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row: any) => this.mapProductRow(row));
  }

  async getProductById(id: string): Promise<Product> {
    const { data, error } = await this.supabaseService.getSupabase()
      .from('products')
      .select(`
        *,
        category:categories(*)
      `)
      .eq('product_id', id)
      .single();

    if (error) throw error;
    return this.mapProductRow(data);
  }

  async getFeaturedProducts(): Promise<Product[]> {
    const { data, error } = await this.supabaseService.getSupabase()
      .from('products')
      .select(`
        *,
        category:categories(*)
      `)
      .eq('is_featured', true)
      .limit(10);

    if (error) throw error;
    return (data || []).map((row: any) => this.mapProductRow(row));
  }

  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    const { data, error } = await this.supabaseService.getSupabase()
      .from('products')
      .select(`
        *,
        category:categories(*)
      `)
      .eq('category_id', categoryId);

    if (error) throw error;
    return (data || []).map((row: any) => this.mapProductRow(row));
  }

  async getCategories(): Promise<Category[]> {
    const { data, error } = await this.supabaseService.getSupabase()
      .from('categories')
      .select(`
        category_id,
        name,
        description,
        image_url,
        icon,
        parent_id,
        display_order,
        is_active
      `)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return (data || []).map((c: any) => ({
      id: String(c.category_id),
      name: c.name,
      description: c.description ?? '',
      image: c.image_url ?? '',
      icon: c.icon ?? '',
      parentId: c.parent_id != null ? String(c.parent_id) : undefined,
      isActive: !!c.is_active,
      order: Number(c.display_order ?? 0)
    })) as Category[];
  }

  async searchProducts(query: string): Promise<Product[]> {
    const { data, error } = await this.supabaseService.getSupabase()
      .from('products')
      .select(`
        *,
        category:categories(*)
      `)
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`);

    if (error) throw error;
    return (data || []).map((row: any) => this.mapProductRow(row));
  }

  async filterProducts(filters: any): Promise<Product[]> {
    let query = this.supabaseService.getSupabase()
      .from('products')
      .select(`
        *,
        category:categories(*)
      `);

    if (filters.categories && filters.categories.length) {
      query = query.in('category_id', filters.categories);
    }
    if (filters.brands && filters.brands.length) {
      query = query.in('brand', filters.brands);
    }
    if (filters.minPrice) {
      query = query.gte('price', filters.minPrice);
    }
    if (filters.maxPrice) {
      query = query.lte('price', filters.maxPrice);
    }
    if (filters.sizes && filters.sizes.length) {
      query = query.contains('variants.size', filters.sizes);
    }
    if (filters.colors && filters.colors.length) {
      query = query.contains('variants.color', filters.colors);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row: any) => this.mapProductRow(row));
  }

  async getProductVariants(productId: string): Promise<ProductVariant[]> {
    const { data, error } = await this.supabaseService.getSupabase()
      .from('products')
      .select('variants')
      .eq('product_id', productId)
      .single();

    if (error) throw error;
    return Array.isArray(data?.variants) ? data.variants : [];
  }

  async checkStock(productId: string, size: string, color: string): Promise<number> {
    const variants = await this.getProductVariants(productId);
    const match = variants.find(v => (v as any).size === size && (v as any).color === color);
    return Number((match as any)?.stock ?? 0);
  }
}