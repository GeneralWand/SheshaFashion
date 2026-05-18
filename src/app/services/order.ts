import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase';
import { AuthService } from './auth';

import { CartService } from './cart';
import { Order, OrderStatus } from '../models/order.model';
import { normalizeImageUrls } from '../utils/media';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  constructor(
    private supabaseService: SupabaseService,
    private authService: AuthService,
    private cartService: CartService
  ) {}

  async createOrder(orderData: any): Promise<Order> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');
    

    const cart = this.cartService['cartSubject'].value;
    if (!cart || !cart.items.length) throw new Error('Cart is empty');

    const storeId = cart.store_id ? Number(cart.store_id) : null;
    let vendorId: number | null = null;
    if (storeId) {
      const { data: storeData } = await this.supabaseService.getSupabase()
        .from('stores')
        .select('vendor_id')
        .eq('store_id', storeId)
        .single();
      vendorId = storeData?.vendor_id ?? null;
    }

    const { data: order, error: orderError } = await this.supabaseService.getSupabase()
      .from('orders')
      .insert({
        user_id: Number(userId),
        store_id: storeId,
        vendor_id: vendorId,
        address_id: orderData.addressId,
        subtotal: cart.subtotal,
        delivery_fee: cart.delivery_fee,
        total: cart.total,
        items: cart.items.map(item => ({
          product_id: Number(item.product_id),
          name: item.product?.name ?? null,
          product_name: item.product?.name ?? null,
          variant_id: item.variant_id != null ? Number(item.variant_id) : null,
          quantity: item.quantity,
          price: item.price,
          variant: item.variant ?? null,
          note: item.note ?? null
        })),
        payment_method: orderData.paymentMethod,
        status: 'pending',
        payment_status: 'pending',
        estimated_delivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Clear cart after order creation
    await this.cartService.clearCart();

    await this.appendTrackingEvent(
      String(order.order_id),
      'pending',
      'Order placed — waiting for a driver to accept',
      'System',
    );

    return {
      id: String(order.order_id),
      userId: String(order.user_id),
      items: [],
      status: order.status,
      subtotal: Number(order.subtotal ?? 0),
      deliveryFee: Number(order.delivery_fee ?? 0),
      total: Number(order.total ?? 0),
      address: {} as any,
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      estimatedDelivery: order.estimated_delivery ? new Date(order.estimated_delivery) : new Date(),
      createdAt: order.created_date ? new Date(order.created_date) : new Date(),
      updatedAt: order.updated_date ? new Date(order.updated_date) : new Date(),
    } as Order;
  }

  async getOrders(): Promise<Order[]> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const { data, error } = await this.supabaseService.getSupabase()
      .from('orders')
      .select(`
        *,
        address:addresses(*)
      `)
      .eq('user_id', userId)
      .order('created_date', { ascending: false });

    if (error) throw error;
    const ordersRaw = data || [];

    const productIds = [...new Set(
      [].concat(
        ...ordersRaw.map((o: any) =>
          (Array.isArray(o.items) ? o.items : []).map((it: any) => it.product_id)
        )
      )
    )];

    const { data: productsRaw, error: productsError } = productIds.length
      ? await this.supabaseService.getSupabase()
        .from('products')
        .select(`
          product_id,
          name,
          description,
          price,
          discount_price,
          images,
          status,
          is_featured,
          tags,
          rating,
          review_count,
          category_id,
          created_date,
          updated_date
        `)
        .in('product_id', productIds)
      : { data: [], error: null };

    if (productsError) throw productsError;
    const productMap = new Map((productsRaw || []).map((p: any) => [String(p.product_id), p]));

    const mapAddress = (a: any) => {
      if (!a) return undefined;
      return {
        id: String(a.address_id),
        userId: String(a.user_id),
        label: a.label ?? '',
        fullName: a.full_name ?? '',
        phone: a.phone ?? '',
        addressLine1: a.address_line1 ?? '',
        addressLine2: a.address_line2 ?? undefined,
        city: a.city ?? '',
        state: a.state ?? '',
        zipCode: a.zip_code ?? '',
        country: a.country ?? 'South Africa',
        isDefault: !!a.is_default,
        latitude: a.latitude ?? undefined,
        longitude: a.longitude ?? undefined
      } as any;
    };

    const mapProductForOrder = (productId: string): any => {
      const p = productMap.get(String(productId));
      if (!p) return null;
      return {
        id: String(p.product_id),
        name: p.name,
        description: p.description,
        price: Number(p.price),
        discount_price: p.discount_price != null ? Number(p.discount_price) : undefined,
        images: normalizeImageUrls(p.images),
        category_id: p.category_id != null ? String(p.category_id) : '',
        sub_category_id: undefined,
        brand: '',
        rating: Number(p.rating ?? 0),
        review_count: Number(p.review_count ?? 0),
        in_stock: p.status === 'available',
        is_featured: !!p.is_featured,
        tags: Array.isArray(p.tags) ? p.tags : [],
        created_at: p.created_date ? new Date(p.created_date) : new Date(),
        updated_at: p.updated_date ? new Date(p.updated_date) : new Date()
      } as any;
    };

    return ordersRaw.map((o: any) => ({
      id: String(o.order_id),
      userId: String(o.user_id),
      status: o.status,
      subtotal: Number(o.subtotal),
      deliveryFee: Number(o.delivery_fee),
      total: Number(o.total),
      paymentMethod: o.payment_method,
      paymentStatus: o.payment_status,
      trackingId: undefined,
      estimatedDelivery: o.estimated_delivery ? new Date(o.estimated_delivery) : new Date(),
      createdAt: o.created_date ? new Date(o.created_date) : new Date(),
      updatedAt: o.updated_date ? new Date(o.updated_date) : new Date(),
      address: mapAddress(o.address),
      items: (Array.isArray(o.items) ? o.items : []).map((it: any) => ({
        productId: String(it.product_id),
        product: mapProductForOrder(String(it.product_id)),
        quantity: Number(it.quantity ?? 0),
        size: it.variant?.size,
        color: it.variant?.color,
        price: Number(it.price ?? 0)
      }))
    })) as Order[];
  }

  async getOrderById(id: string): Promise<Order> {
    const orderIdNum = Number(id);
    const { data, error } = await this.supabaseService.getSupabase()
      .from('orders')
      .select(`
        *,
        address:addresses(*),
        tracking:order_tracking(*)
      `)
      .eq('order_id', orderIdNum)
      .single();

    if (error) throw error;
    const orderRaw = data;
    const itemsRaw = Array.isArray(orderRaw?.items) ? orderRaw.items : [];
    const productIds = [...new Set(itemsRaw.map((it: any) => String(it.product_id)).filter(Boolean))];

    const { data: productsRaw, error: productsError } = productIds.length
      ? await this.supabaseService.getSupabase()
        .from('products')
        .select(`
          product_id,
          name,
          description,
          price,
          discount_price,
          images,
          status,
          is_featured,
          tags,
          rating,
          review_count,
          category_id,
          created_date,
          updated_date
        `)
        .in('product_id', productIds)
      : { data: [], error: null };

    if (productsError) throw productsError;
    const productMap = new Map((productsRaw || []).map((p: any) => [String(p.product_id), p]));

    const mapAddress = (a: any) => {
      if (!a) return undefined;
      return {
        id: String(a.address_id),
        userId: String(a.user_id),
        label: a.label ?? '',
        fullName: a.full_name ?? '',
        phone: a.phone ?? '',
        addressLine1: a.address_line1 ?? '',
        addressLine2: a.address_line2 ?? undefined,
        city: a.city ?? '',
        state: a.state ?? '',
        zipCode: a.zip_code ?? '',
        country: a.country ?? 'South Africa',
        isDefault: !!a.is_default,
        latitude: a.latitude ?? undefined,
        longitude: a.longitude ?? undefined
      } as any;
    };

    const mapProductForOrder = (productId: string): any => {
      const p = productMap.get(String(productId));
      if (!p) return null;
      return {
        id: String(p.product_id),
        name: p.name,
        description: p.description,
        price: Number(p.price),
        discount_price: p.discount_price != null ? Number(p.discount_price) : undefined,
        images: normalizeImageUrls(p.images),
        category_id: p.category_id != null ? String(p.category_id) : '',
        sub_category_id: undefined,
        brand: '',
        rating: Number(p.rating ?? 0),
        review_count: Number(p.review_count ?? 0),
        in_stock: p.status === 'available',
        is_featured: !!p.is_featured,
        tags: Array.isArray(p.tags) ? p.tags : [],
        created_at: p.created_date ? new Date(p.created_date) : new Date(),
        updated_at: p.updated_date ? new Date(p.updated_date) : new Date()
      } as any;
    };

    return {
      id: String(orderRaw.order_id),
      userId: String(orderRaw.user_id),
      status: orderRaw.status,
      subtotal: Number(orderRaw.subtotal),
      deliveryFee: Number(orderRaw.delivery_fee),
      total: Number(orderRaw.total),
      paymentMethod: orderRaw.payment_method,
      paymentStatus: orderRaw.payment_status,
      trackingId: undefined,
      estimatedDelivery: orderRaw.estimated_delivery ? new Date(orderRaw.estimated_delivery) : new Date(),
      createdAt: orderRaw.created_date ? new Date(orderRaw.created_date) : new Date(),
      updatedAt: orderRaw.updated_date ? new Date(orderRaw.updated_date) : new Date(),
      address: mapAddress(orderRaw.address),
      items: itemsRaw.map((it: any) => ({
        productId: String(it.product_id),
        product: mapProductForOrder(String(it.product_id)),
        quantity: Number(it.quantity ?? 0),
        size: it.variant?.size,
        color: it.variant?.color,
        price: Number(it.price ?? 0)
      }))
    } as Order;
  }

  async cancelOrder(id: string): Promise<Order> {
    const orderIdNum = Number(id);
    const { data, error } = await this.supabaseService.getSupabase()
      .from('orders')
      .update({ status: 'cancelled', updated_date: new Date() })
      .eq('order_id', orderIdNum)
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async trackOrder(id: string): Promise<any> {
    const orderIdNum = Number(id);
    const { data, error } = await this.supabaseService.getSupabase()
      .from('order_tracking')
      .select('*')
      .eq('order_id', orderIdNum)
      .order('created_date', { ascending: true });

    if (error) throw error;
    return data;
  }

  private async updateProductStock(productId: string, variantId: string, quantity: number) {
    // NOTE: Your schema stores variants (and their stock) inside `products.variants` jsonb.
    // Updating jsonb variant stock safely requires extra SQL/jsonb logic.
    // For now we skip stock restoration to avoid referencing non-existent tables.
    return;
  }

  async appendTrackingEvent(
    orderId: string,
    status: string,
    description: string,
    location: string,
  ): Promise<void> {
    const { error } = await this.supabaseService.getSupabase().from('order_tracking').insert({
      order_id: Number(orderId),
      status,
      description,
      location,
    });
    if (error) {
      console.error('order_tracking insert:', error);
    }
  }

  /** Driver accepts a pending order → vendor is auto-confirmed. */
  async onDriverAcceptedOrder(orderId: number, driverId: number): Promise<void> {
    const supabase = this.supabaseService.getSupabase();
    const now = new Date().toISOString();

    const { error: orderErr } = await supabase
      .from('orders')
      .update({
        driver_id: driverId,
        status: 'confirmed',
        updated_date: now,
      })
      .eq('order_id', orderId)
      .eq('status', 'pending');

    if (orderErr) {
      throw orderErr;
    }

    await this.appendTrackingEvent(
      String(orderId),
      'confirmed',
      'Driver accepted — order sent to store automatically',
      'Driver',
    );
    await this.appendTrackingEvent(
      String(orderId),
      'confirmed',
      'Store accepted order automatically',
      'Vendor',
    );
  }

  async updateOrderStatus(orderId: string, status: OrderStatus) {
    const orderIdNum = Number(orderId);
    const { error } = await this.supabaseService.getSupabase()
      .from('orders')
      .update({ status, updated_date: new Date() })
      .eq('order_id', orderIdNum);

    if (error) throw error;

    await this.appendTrackingEvent(orderId, status, `Order ${status}`, 'System');
  }

  // Realtime order updates
  subscribeToOrderUpdates(orderId: string, callback: (payload: any) => void) {
    return this.supabaseService.getSupabase()
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `order_id=eq.${orderId}`
        },
        (payload) => callback(payload)
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_tracking',
          filter: `order_id=eq.${orderId}`
        },
        (payload) => callback(payload)
      )
      .subscribe();
  }
}