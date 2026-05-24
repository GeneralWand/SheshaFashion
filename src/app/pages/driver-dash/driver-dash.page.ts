import { Component, OnDestroy, OnInit } from '@angular/core';
import { AlertController, ToastController, ViewWillEnter } from '@ionic/angular';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from '../../services/auth';
import { OrderService } from '../../services/order';
import { SupabaseService } from '../../services/supabase';

export interface DriverOrderOffer {
  /** Same as orderId — used by template filter */
  id: string;
  orderId: string;
  storeName: string;
  distance: number;
  estimatedTime: number;
  earnings: number;
  raw?: any;
}

export type DeliveryStatus = 'assigned' | 'accepted' | 'picked_up' | 'delivered';

export interface ActiveDelivery {
  assignmentId: number;
  orderId: string;
  pickupLocation: string;
  deliveryLocation: string;
  status: DeliveryStatus;
  completionFee: number;
}

export interface DeliveryHistoryRow {
  orderId: string;
  storeName: string;
  date: Date;
  earnings: number;
  status: string;
}

@Component({
  selector: 'app-driver-dash',
  templateUrl: './driver-dash.page.html',
  host: { class: 'driver-dash' },
  standalone: false,
})
export class DriverDashPage implements OnInit, OnDestroy, ViewWillEnter {
  isOnline = false;

  stats = {
    totalDeliveries: 0,
    totalEarnings: 0,
    rating: 0,
  };

  todayEarnings = 0;
  completedDeliveriesToday = 0;

  availableOrders: DriverOrderOffer[] = [];
  activeDeliveries: ActiveDelivery[] = [];
  deliveryHistory: DeliveryHistoryRow[] = [];

  private driverPk: number | null = null;
  private appliedStoreIds: number[] = [];
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private realtimeChannel: RealtimeChannel | null = null;
  showAllDeliveryHistory = false;

  constructor(
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private authService: AuthService,
    private orderService: OrderService,
    private supabaseService: SupabaseService,
  ) {}

  ngOnInit() {
    void this.refreshAll();
    this.subscribeRealtime();
  }

  ngOnDestroy() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    if (this.realtimeChannel) {
      void this.supabaseService.getSupabase().removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }

  ionViewWillEnter() {
    void this.refreshAll();
  }

  private subscribeRealtime() {
    const supabase = this.supabaseService.getSupabase();
    this.realtimeChannel = supabase
      .channel('driver-order-events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () =>
        this.scheduleRefresh(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_assignments' }, () =>
        this.scheduleRefresh(),
      )
      .subscribe();
  }

  private scheduleRefresh() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      void this.refreshAll();
    }, 400);
  }

  private async resolveDriverProfile(): Promise<boolean> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      this.driverPk = null;
      this.appliedStoreIds = [];
      return false;
    }

    const { data, error } = await this.supabaseService
      .getSupabase()
      .from('drivers')
      .select('driver_id, applied_store_ids, rating')
      .eq('user_id', Number(userId))
      .maybeSingle();

    if (error || !data) {
      this.driverPk = null;
      this.appliedStoreIds = [];
      return false;
    }

    this.driverPk = Number(data.driver_id);
    const rawStores = data.applied_store_ids;
    this.appliedStoreIds = Array.isArray(rawStores)
      ? rawStores.map((n: any) => Number(n)).filter((n) => Number.isFinite(n))
      : [];
    this.stats.rating = Number(data.rating ?? 0);
    return true;
  }

  private formatPickup(order: any): string {
    const s = order?.store;
    if (!s) return 'Store pickup';
    const a = s.address;
    if (typeof a === 'string' && a.trim()) return `${s.name} — ${a}`;
    if (a && typeof a === 'object') {
      const line = [a.street, a.address_line1, a.city].filter(Boolean).join(', ');
      return line ? `${s.name} — ${line}` : String(s.name);
    }
    return String(s.name || 'Store pickup');
  }

  private formatDropoff(order: any): string {
    const a = order?.address;
    if (!a) return 'Customer address';
    const parts = [a.full_name, a.address_line1, a.city, a.zip_code].filter(Boolean);
    return parts.length ? parts.join(', ') : 'Customer address';
  }

  private assignmentToUiStatus(a: any): DeliveryStatus {
    if (a.delivered_date) return 'delivered';
    if (a.pickup_date) return 'picked_up';
    if (a.accepted_date) return 'accepted';
    return 'assigned';
  }

  private async loadAvailableOrders(): Promise<void> {
    if (
      !this.isOnline ||
      !this.appliedStoreIds.length ||
      this.driverPk == null ||
      !this.authService.getCurrentUserId()
    ) {
      this.availableOrders = [];
      return;
    }

    const supabase = this.supabaseService.getSupabase();
    const { data: ordersRaw, error: oErr } = await supabase
      .from('orders')
      .select(
        `
        order_id,
        store_id,
        status,
        total,
        delivery_fee,
        items,
        created_date,
        store:stores(name, address)
      `,
      )
      .eq('status', 'pending')
      .in('store_id', this.appliedStoreIds)
      .order('created_date', { ascending: true });

    if (oErr) {
      console.error(oErr);
      this.availableOrders = [];
      return;
    }

    const orderList = ordersRaw || [];
    if (orderList.length === 0) {
      this.availableOrders = [];
      return;
    }

    const orderIds = orderList.map((o: any) => Number(o.order_id)).filter((n) => Number.isFinite(n));
    const { data: takenRows } = await supabase
      .from('delivery_assignments')
      .select('order_id')
      .in('order_id', orderIds);

    const taken = new Set((takenRows || []).map((t: any) => Number(t.order_id)));
    const pool = orderList.filter((o: any) => !taken.has(Number(o.order_id)));

    this.availableOrders = pool.map((o: any) => {
      const fee = Number(o.delivery_fee ?? 0);
      return {
        id: String(o.order_id),
        orderId: String(o.order_id),
        storeName: o.store?.name ?? 'Store',
        distance: 0,
        estimatedTime: 20,
        earnings: fee > 0 ? Math.round(fee * 0.55) : 42,
        raw: o,
      };
    });
  }

  private async loadActiveDeliveries(): Promise<void> {
    if (this.driverPk == null) {
      this.activeDeliveries = [];
      return;
    }

    const { data, error } = await this.supabaseService
      .getSupabase()
      .from('delivery_assignments')
      .select(
        `
        assignment_id,
        order_id,
        accepted_date,
        pickup_date,
        delivered_date,
        total_payment,
        order:orders(
          order_id,
          delivery_fee,
          total,
          store:stores(name, address),
          address:addresses(full_name, address_line1, city, zip_code)
        )
      `,
      )
      .eq('driver_id', this.driverPk)
      .is('delivered_date', null)
      .order('assigned_date', { ascending: false });

    if (error) {
      console.error(error);
      this.activeDeliveries = [];
      return;
    }

    this.activeDeliveries = (data || []).map((row: any) => {
      const df = Number(row.order?.delivery_fee ?? 0);
      const completionFee = df > 0 ? Math.max(25, Math.round(df * 0.55)) : 42;
      return {
        assignmentId: Number(row.assignment_id),
        orderId: String(row.order_id),
        pickupLocation: this.formatPickup(row.order),
        deliveryLocation: this.formatDropoff(row.order),
        status: this.assignmentToUiStatus(row),
        completionFee,
      };
    });
  }

  private async loadDriverStatsAndHistory(): Promise<void> {
    if (this.driverPk == null) {
      this.deliveryHistory = [];
      this.todayEarnings = 0;
      this.completedDeliveriesToday = 0;
      this.stats.totalDeliveries = 0;
      this.stats.totalEarnings = 0;
      return;
    }

    const supabase = this.supabaseService.getSupabase();
    const { data, error } = await supabase
      .from('delivery_assignments')
      .select('order_id, delivered_date, total_payment')
      .eq('driver_id', this.driverPk)
      .not('delivered_date', 'is', null)
      .order('delivered_date', { ascending: false });

    if (error) {
      console.error('loadDriverStatsAndHistory:', error);
      return;
    }

    const completed = data ?? [];
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    let todaySum = 0;
    let todayCount = 0;
    let totalEarnings = 0;

    for (const row of completed) {
      const payment = Number(row.total_payment ?? 0);
      totalEarnings += payment;
      const d = row.delivered_date ? new Date(row.delivered_date) : null;
      if (d && d >= startOfToday) {
        todaySum += payment;
        todayCount += 1;
      }
    }

    this.stats.totalDeliveries = completed.length;
    this.stats.totalEarnings = totalEarnings;
    this.todayEarnings = todaySum;
    this.completedDeliveriesToday = todayCount;

    void this.syncDriverTotalsToDb(completed.length, totalEarnings);

    const historyLimit = this.showAllDeliveryHistory ? 200 : 25;
    const historySlice = completed.slice(0, historyLimit);
    const storeNames = await this.fetchStoreNamesForOrders(
      historySlice.map((r) => Number(r.order_id)).filter((id) => Number.isFinite(id)),
    );

    this.deliveryHistory = historySlice.map((row) => {
      const d = row.delivered_date ? new Date(row.delivered_date) : new Date();
      const oid = Number(row.order_id);
      return {
        orderId: String(row.order_id),
        storeName: storeNames.get(oid) ?? 'Delivery',
        date: d,
        earnings: Number(row.total_payment ?? 0),
        status: 'delivered',
      };
    });
  }

  private async fetchStoreNamesForOrders(orderIds: number[]): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    if (!orderIds.length) {
      return map;
    }

    const supabase = this.supabaseService.getSupabase();
    const { data: orders, error: oErr } = await supabase
      .from('orders')
      .select('order_id, store_id')
      .in('order_id', orderIds);

    if (oErr || !orders?.length) {
      return map;
    }

    const storeIds = [...new Set(orders.map((o) => o.store_id).filter((id) => id != null))];
    const { data: stores } = storeIds.length
      ? await supabase.from('stores').select('store_id, name').in('store_id', storeIds)
      : { data: [] as { store_id: number; name: string }[] };

    const storeMap = new Map((stores ?? []).map((s) => [Number(s.store_id), String(s.name)]));

    for (const o of orders) {
      const name = storeMap.get(Number(o.store_id));
      if (name) {
        map.set(Number(o.order_id), name);
      }
    }

    return map;
  }

  private async syncDriverTotalsToDb(totalDeliveries: number, totalEarnings: number): Promise<void> {
    if (this.driverPk == null) {
      return;
    }
    const { error } = await this.supabaseService
      .getSupabase()
      .from('drivers')
      .update({
        total_deliveries: totalDeliveries,
        total_earnings: totalEarnings,
      })
      .eq('driver_id', this.driverPk);

    if (error) {
      console.warn('Could not sync driver totals:', error.message);
    }
  }

  async refreshAll(): Promise<void> {
    const ok = await this.resolveDriverProfile();
    if (!ok) {
      this.availableOrders = [];
      this.activeDeliveries = [];
      this.stats.totalDeliveries = 0;
      this.stats.totalEarnings = 0;
      this.todayEarnings = 0;
      this.completedDeliveriesToday = 0;
      this.deliveryHistory = [];
      return;
    }
    await Promise.all([
      this.loadAvailableOrders(),
      this.loadActiveDeliveries(),
      this.loadDriverStatsAndHistory(),
    ]);
  }

  async toggleOnlineStatus() {
    this.isOnline = !this.isOnline;
    await this.presentToast(
      this.isOnline ? 'You are now online' : 'You are now offline',
      this.isOnline ? 'success' : 'medium',
    );
    if (!this.isOnline) {
      this.availableOrders = [];
    }
    await this.refreshAll();
  }

  async acceptOrder(order: DriverOrderOffer) {
    if (this.driverPk == null) {
      await this.presentToast('Sign in as a driver to accept deliveries', 'warning');
      return;
    }

    const orderIdNum = Number(order.orderId);
    if (!Number.isFinite(orderIdNum)) return;

    const supabase = this.supabaseService.getSupabase();
    const now = new Date().toISOString();
    const { error: insErr } = await supabase.from('delivery_assignments').insert({
      order_id: orderIdNum,
      driver_id: this.driverPk,
      status: 'accepted',
      accepted_date: now,
      base_payment: order.earnings,
      total_payment: order.earnings,
    });

    if (insErr) {
      console.error(insErr);
      await this.presentToast(insErr.message || 'Could not accept — order may already be taken', 'danger');
      await this.refreshAll();
      return;
    }

    try {
      await this.orderService.onDriverAcceptedOrder(orderIdNum, this.driverPk);
    } catch (updErr: any) {
      console.error(updErr);
      await this.presentToast(
        updErr?.message || 'Assignment saved but order could not be confirmed for the store',
        'warning',
      );
    }

    await this.presentToast('Delivery accepted — store notified automatically', 'success');
    await this.refreshAll();
  }

  async viewDeliveryDetails(delivery: ActiveDelivery) {
    const alert = await this.alertCtrl.create({
      header: `Order #${delivery.orderId}`,
      message: `Pickup: ${delivery.pickupLocation}\nDrop-off: ${delivery.deliveryLocation}\nStatus: ${delivery.status}`,
      buttons: ['OK'],
    });
    await alert.present();
  }

  async acceptDelivery(delivery: ActiveDelivery) {
    const { error } = await this.supabaseService
      .getSupabase()
      .from('delivery_assignments')
      .update({ accepted_date: new Date().toISOString() })
      .eq('assignment_id', delivery.assignmentId);

    if (error) {
      await this.presentToast(error.message || 'Update failed', 'danger');
      return;
    }
    delivery.status = 'accepted';
    await this.presentToast('Marked as accepted — head to pickup', 'success');
    await this.refreshAll();
  }

  async markAsPickedUp(delivery: ActiveDelivery) {
    const supabase = this.supabaseService.getSupabase();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('delivery_assignments')
      .update({ pickup_date: now })
      .eq('assignment_id', delivery.assignmentId);

    if (error) {
      await this.presentToast(error.message || 'Update failed', 'danger');
      return;
    }

    const { error: oErr } = await supabase
      .from('orders')
      .update({ status: 'out_for_delivery', updated_date: now })
      .eq('order_id', Number(delivery.orderId));

    if (oErr) {
      console.error(oErr);
    } else {
      await this.orderService.appendTrackingEvent(
        delivery.orderId,
        'out_for_delivery',
        'Order picked up — on the way to customer',
        'Driver',
      );
    }

    delivery.status = 'picked_up';
    await this.presentToast('Picked up — en route to customer', 'success');
    await this.refreshAll();
  }

  async markAsDelivered(delivery: ActiveDelivery) {
    const fee = delivery.completionFee;

    const { error: aErr } = await this.supabaseService
      .getSupabase()
      .from('delivery_assignments')
      .update({
        delivered_date: new Date().toISOString(),
        total_payment: fee,
      })
      .eq('assignment_id', delivery.assignmentId);

    if (aErr) {
      await this.presentToast(aErr.message || 'Update failed', 'danger');
      return;
    }

    const { error: oErr } = await this.supabaseService
      .getSupabase()
      .from('orders')
      .update({
        status: 'delivered',
        actual_delivery: new Date().toISOString(),
        updated_date: new Date().toISOString(),
      })
      .eq('order_id', Number(delivery.orderId));

    if (oErr) {
      console.error(oErr);
    } else {
      await this.orderService.appendTrackingEvent(
        delivery.orderId,
        'delivered',
        'Order delivered to customer',
        'Driver',
      );
    }

    await this.presentToast('Delivery completed', 'success');
    await this.refreshAll();
  }

  async viewAllHistory() {
    this.showAllDeliveryHistory = !this.showAllDeliveryHistory;
    await this.loadDriverStatsAndHistory();
    await this.presentToast(
      this.showAllDeliveryHistory ? 'Showing full delivery history' : 'Showing recent deliveries',
      'primary',
    );
  }

  get displayedDeliveryHistory(): DeliveryHistoryRow[] {
    return this.deliveryHistory;
  }

  private async presentToast(message: string, color: string) {
    const t = await this.toastCtrl.create({
      message,
      duration: 2200,
      color,
      position: 'top',
    });
    await t.present();
  }
}
