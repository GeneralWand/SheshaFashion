import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Cart, CartItem } from '../models/cart.model';
import { Store, StoreProduct, ProductVariant } from '../models/store.model';
import { SupabaseService } from './supabase';
import { AuthService } from './auth';
import { normalizeImageUrls } from '../utils/media';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private cartSubject = new BehaviorSubject<Cart | null>(null);
  public cart$ = this.cartSubject.asObservable();
  private cartItemCount = new BehaviorSubject<number>(0);
  private currentStoreSubject = new BehaviorSubject<Store | null>(null);
  public currentStore$ = this.currentStoreSubject.asObservable();

  constructor(
    private supabaseService: SupabaseService,
    private authService: AuthService
  ) {
    this.authService.currentProfile$.subscribe(profile => {
      if (profile) {
        this.loadCartFromDB();
      } else {
        this.loadCartFromLocal();
      }
    });
  }

  private mapStoreOpeningHours(openingHours: any): any[] {
    if (!openingHours || typeof openingHours !== 'object') return [];

    return Object.entries(openingHours).map(([dayKey, value]: [string, any]) => ({
      day: dayKey ? dayKey.charAt(0).toUpperCase() + dayKey.slice(1) : dayKey,
      open: value?.open ?? '',
      close: value?.close ?? '',
      is_closed: !!value?.closed
    }));
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
      // address is jsonb in DB
      address: raw.address
    } as Store;
  }

  private mapProductToStoreProduct(raw: any): StoreProduct {
    return {
      product_id: String(raw.product_id),
      store_id: String(raw.store_id),
      name: raw.name,
      description: raw.description,
      price: Number(raw.price),
      discount_price: raw.discount_price != null ? Number(raw.discount_price) : undefined,
      images: normalizeImageUrls(raw.images),
      category: raw.category_id != null ? String(raw.category_id) : '',
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

  private toCartItemDB(item: CartItem) {
    const variantId = item.variant_id
      ? String(item.variant_id)
      : item.variant && (item.variant as any).id
        ? String((item.variant as any).id)
        : undefined;

    return {
      id: String(item.id),
      product_id: String(item.product_id),
      quantity: item.quantity,
      variant_id: variantId ?? null,
      variant: item.variant ?? null,
      price: item.price,
      note: item.note ?? null
    };
  }

  private getVariantId(variant?: any): string | undefined {
    if (!variant) return undefined;
    // Your modal passes ProductVariant which uses `id` in schema models.
    if (variant.id != null) return String(variant.id);
    if (variant.variant_id != null) return String(variant.variant_id);
    return undefined;
  }

  private async persistCartToDB(cart: Cart): Promise<void> {
    const cartIdNum = Number(cart.id);
    if (!Number.isFinite(cartIdNum)) return;

    const itemsJson = (cart.items || []).map((item) => this.toCartItemDB(item));
    const deliveryFee = cart.store?.delivery_fee || 0;

    const { error } = await this.supabaseService.getSupabase()
      .from('carts')
      .update({
        store_id: cart.store_id != null ? Number(cart.store_id) : null,
        items: itemsJson,
        subtotal: cart.subtotal,
        delivery_fee: deliveryFee,
        total: cart.total,
        updated_date: new Date()
      })
      .eq('cart_id', cartIdNum);

    if (error) throw error;
  }

  async loadCartFromDB() {
    const userId = this.authService.getCurrentUserId();
    if (!userId) return;

    const { data, error } = await this.supabaseService.getSupabase()
      .from('carts')
      .select('*, store:stores(*)')
      .eq('user_id', userId)
      .single();

    // Only auto-create a cart when there is genuinely no row.
    // For network/DNS errors, do not trigger extra failing requests.
    if (!data && !error) {
      await this.createCart();
      return;
    }
    if (error) {
      const errMsg = String((error as any)?.message || '').toLowerCase();
      const noRow =
        (error as any)?.code === 'PGRST116' ||
        errMsg.includes('no rows') ||
        errMsg.includes('json object requested');
      if (noRow) {
        await this.createCart();
      } else {
        throw error;
      }
      return;
    }

    const itemsRaw = Array.isArray(data.items) ? data.items : [];
    const productIds = [...new Set(itemsRaw.map((i: any) => String(i.product_id)).filter(Boolean))];

    const { data: productsRaw, error: productsError } = productIds.length
      ? await this.supabaseService.getSupabase()
        .from('products')
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
          variants,
          created_date,
          updated_date
        `)
        .in('product_id', productIds)
      : { data: [], error: null };

    if (productsError) throw productsError;

    const productMap = new Map(
      (productsRaw || []).map((p: any) => [String(p.product_id), this.mapProductToStoreProduct(p)])
    );

    const cart: Cart = {
      id: String(data.cart_id),
      user_id: String(data.user_id),
      store_id: data.store_id != null ? String(data.store_id) : null,
      store: data.store ? this.mapStore(data.store) : undefined,
      items: itemsRaw.map((item: any) => {
        const productId = String(item.product_id);
        return {
          id: String(item.id ?? item.item_id ?? `${productId}:${item.variant_id ?? ''}`),
          cart_id: String(data.cart_id),
          product_id: productId,
          product: productMap.get(productId) as StoreProduct,
          quantity: Number(item.quantity ?? 0),
          variant_id: item.variant_id != null ? String(item.variant_id) : undefined,
          variant: item.variant != null ? (item.variant as ProductVariant) : undefined,
          price: Number(item.price ?? 0),
          note: item.note ?? undefined
        } as CartItem;
      }),
      subtotal: Number(data.subtotal ?? 0),
      delivery_fee: Number(data.delivery_fee ?? 0),
      total: Number(data.total ?? 0),
      created_date: data.created_date ? new Date(data.created_date) : new Date(),
      updated_date: data.updated_date ? new Date(data.updated_date) : new Date()
    };

    this.cartSubject.next(cart);
    this.currentStoreSubject.next(cart.store || null);
    this.updateCartItemCount();
  }

  async createCart() {
    const userId = this.authService.getCurrentUserId();
    if (!userId) return;

    const { data, error } = await this.supabaseService.getSupabase()
      .from('carts')
      .insert({
        user_id: userId,
        store_id: null,
        items: [],
        subtotal: 0,
        delivery_fee: 0,
        total: 0
      })
      .select()
      .single();

    if (!error && data) {
      const cart: Cart = {
        id: data.cart_id,                    // Changed from data.id
        user_id: data.user_id,
        store_id: null,
        store: undefined,
        items: [],
        subtotal: data.subtotal,
        delivery_fee: data.delivery_fee,
        total: data.total,
        created_date: data.created_date,     // Changed from created_at
        updated_date: data.updated_date      // Changed from updated_at
      };
      this.cartSubject.next(cart);
    }
  }

  loadCartFromLocal() {
    const localCart = localStorage.getItem('cart');
    if (localCart) {
      const cart = JSON.parse(localCart);
      this.cartSubject.next(cart);
      this.currentStoreSubject.next(cart.store || null);
      this.updateCartItemCount();
    } else {
      this.cartSubject.next({
        id: 'local',
        user_id: 'local',
        store_id: null,
        store: undefined,
        items: [],
        subtotal: 0,
        delivery_fee: 0,
        total: 0,
        created_date: new Date(),
        updated_date: new Date()
      });
    }
  }

  async addToCart(product: StoreProduct, quantity: number = 1, variant?: any, note?: string): Promise<{ success: boolean; message?: string; cart?: Cart }> {
    const currentCart = this.cartSubject.value;
    
    if (!currentCart) {
      return { success: false, message: 'Cart not found' };
    }

    // Check if trying to add from different store
    const targetStoreId = String(product.store_id);
    if (currentCart.store_id && String(currentCart.store_id) !== targetStoreId) {
      return { 
        success: false, 
        message: `Your cart already contains items from ${currentCart.store?.name}. Would you like to clear your cart and add items from this store?`,
        cart: currentCart
      };
    }

    const userId = this.authService.getCurrentUserId();
    const price = Number(product.discount_price ?? product.price);
    const variantId = this.getVariantId(variant);

    // Variant-less items should match each other.
    const existingItem = currentCart.items.find((i) => {
      const sameProduct = String(i.product_id) === String(product.product_id);
      const sameVariant = i.variant_id
        ? String(i.variant_id) === String(variantId ?? '')
        : (variantId == null);
      return sameProduct && sameVariant;
    });

    // First item: set store (needed for delivery fee + cart grouping)
    if (!currentCart.store_id) {
      const store = await this.getStoreById(targetStoreId);
      currentCart.store = store;
      currentCart.store_id = store.store_id;
      this.currentStoreSubject.next(store);
    }

    if (existingItem) {
      existingItem.quantity += quantity;
      existingItem.price = price;
      if (variantId != null) existingItem.variant_id = variantId;
      existingItem.variant = variant ?? existingItem.variant;
      if (note != null) existingItem.note = note;
    } else {
      const itemId = `${String(product.product_id)}:${variantId ?? 'novariant'}`;
      currentCart.items.push({
        id: itemId,
        cart_id: String(currentCart.id),
        product_id: String(product.product_id),
        product,
        quantity,
        variant_id: variantId ?? undefined,
        variant: variant ? (variant as ProductVariant) : undefined,
        price,
        note: note ?? undefined
      });
    }

    this.updateCartTotalsLocal(currentCart);

    if (userId) {
      await this.persistCartToDB(currentCart);
      this.cartSubject.next({ ...currentCart });
    } else {
      localStorage.setItem('cart', JSON.stringify(currentCart));
      this.cartSubject.next({ ...currentCart });
    }

    this.updateCartItemCount();
    return { success: true, cart: this.cartSubject.value! };
  }

  async getStoreById(storeId: string): Promise<Store> {
    const { data, error } = await this.supabaseService.getSupabase()
      .from('stores')
      .select('*')
      .eq('store_id', storeId)
      .single();

    if (error) throw error;
    return this.mapStore(data);
  }

  async clearCartAndAddFromNewStore(product: StoreProduct, quantity: number = 1, variant?: any, note?: string): Promise<boolean> {
    await this.clearCart();
    const result = await this.addToCart(product, quantity, variant, note);
    return result.success;
  }

  async updateCartStore(cartId: string, storeId: string) {
    const { error } = await this.supabaseService.getSupabase()
      .from('carts')
      .update({ store_id: storeId, updated_date: new Date() })  // Changed from updated_at
      .eq('cart_id', cartId);                                   // Changed from 'id'

    if (error) throw error;
  }

  async updateCartItem(itemId: string, quantity: number): Promise<Cart> {
    const currentCart = this.cartSubject.value;
    if (!currentCart) throw new Error('Cart not found');

    const item = currentCart.items.find(i => i.id === itemId);
    if (!item) return this.cartSubject.value!;

    item.quantity = quantity;
    if (quantity <= 0) {
      currentCart.items = currentCart.items.filter(i => i.id !== itemId);
    }

    if (currentCart.items.length === 0) {
      currentCart.store_id = null;
      currentCart.store = undefined;
    }

    this.updateCartTotalsLocal(currentCart);

    const userId = this.authService.getCurrentUserId();
    if (userId) {
      await this.persistCartToDB(currentCart);
      this.cartSubject.next({ ...currentCart });
    } else {
      localStorage.setItem('cart', JSON.stringify(currentCart));
      this.cartSubject.next({ ...currentCart });
    }

    this.currentStoreSubject.next(currentCart.store || null);
    this.updateCartItemCount();
    return this.cartSubject.value!;
  }

  async removeFromCart(itemId: string): Promise<Cart> {
    const currentCart = this.cartSubject.value;
    if (!currentCart) throw new Error('Cart not found');

    currentCart.items = currentCart.items.filter(i => i.id !== itemId);

    if (currentCart.items.length === 0) {
      currentCart.store_id = null;
      currentCart.store = undefined;
    }

    this.updateCartTotalsLocal(currentCart);

    const userId = this.authService.getCurrentUserId();
    if (userId) {
      await this.persistCartToDB(currentCart);
      this.cartSubject.next({ ...currentCart });
    } else {
      localStorage.setItem('cart', JSON.stringify(currentCart));
      this.cartSubject.next({ ...currentCart });
    }

    this.currentStoreSubject.next(currentCart.store || null);
    this.updateCartItemCount();
    return this.cartSubject.value!;
  }

  async clearCart(): Promise<void> {
    const userId = this.authService.getCurrentUserId();
    const currentCart = this.cartSubject.value;
    
    if (!currentCart) return;

    currentCart.items = [];
    currentCart.store_id = null;
    currentCart.store = undefined;
    this.updateCartTotalsLocal(currentCart);

    if (userId) {
      await this.persistCartToDB(currentCart);
      this.cartSubject.next({ ...currentCart });
    } else {
      localStorage.setItem('cart', JSON.stringify(currentCart));
      this.cartSubject.next({ ...currentCart });
    }

    this.updateCartItemCount();
    this.currentStoreSubject.next(currentCart.store || null);
  }

  private async updateCartTotals(cartId: string) {
    const cartIdNum = Number(cartId);
    if (!Number.isFinite(cartIdNum)) return;

    const { data: cart, error } = await this.supabaseService.getSupabase()
      .from('carts')
      .select('items, store:stores(delivery_fee)')
      .eq('cart_id', cartIdNum)
      .single();

    if (error) throw error;

    const itemsRaw = Array.isArray(cart?.items) ? cart.items : [];
    const subtotal =
      itemsRaw.reduce((sum: number, item: any) => sum + (Number(item.price ?? 0) * Number(item.quantity ?? 0)), 0);

    const deliveryFee = (cart?.store as any)?.delivery_fee || 0;
    const total = subtotal + deliveryFee;

    await this.supabaseService.getSupabase()
      .from('carts')
      .update({
        subtotal,
        delivery_fee: deliveryFee,
        total,
        updated_date: new Date()
      })
      .eq('cart_id', cartIdNum);
  }

  private updateCartTotalsLocal(cart: Cart) {
    cart.subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    cart.delivery_fee = cart.store?.delivery_fee || 0;
    cart.total = cart.subtotal + cart.delivery_fee;
    cart.updated_date = new Date();  // Changed from updated_at
  }

  private updateCartItemCount() {
    const cart = this.cartSubject.value;
    const count = cart?.items.reduce((total, item) => total + item.quantity, 0) || 0;
    this.cartItemCount.next(count);
  }

  getCartItemCount() {
    return this.cartItemCount.asObservable();
  }

  getCurrentStore() {
    return this.currentStoreSubject.asObservable();
  }

  getCartTotal(): number {
    return this.cartSubject.value?.total || 0;
  }

  getCartStore(): Store | null {
    return this.cartSubject.value?.store || null;
  }

  hasItems(): boolean {
    return (this.cartSubject.value?.items.length || 0) > 0;
  }
}