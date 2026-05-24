import { Component, OnInit } from '@angular/core';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { SupabaseService } from '../../services/supabase';

const DEFAULT_COMMISSION_PCT = 10;

export interface AdminStoreMini {
  storeId: string;
  name: string;
  status: string;
  category: string;
  deliveryFee: number;
  minOrder: number;
  rating: number;
}

export interface AdminVendorRow {
  vendorId: string;
  storeName: string;
  businessEmail: string;
  businessPhone: string;
  businessAddress: string;
  isApproved: boolean;
  createdDate: Date | null;
  totalSales: number;
  rating: number;
  commissionRate: number;
  stores: AdminStoreMini[];
}

export interface AdminDriverRow {
  driverId: string;
  userId: string;
  fullName: string;
  licenseNumber: string;
  vehicleModel: string;
  vehicleColor: string;
  plateNumber: string;
  isApproved: boolean;
  isOnline: boolean;
  email: string;
  phone: string;
  totalDeliveries: number;
  totalEarnings: number;
  rating: number;
  licensePhotoUrl: string | null;
  vehicleRegUrl: string | null;
}

export interface AdminStoreCard {
  storeId: string;
  name: string;
  category: string;
  status: string;
  vendorName: string;
  address: string;
  deliveryFee: number;
  minOrder: number;
  rating: number;
  reviewCount: number;
  estimatedDeliveryTime: string;
}

export interface AdminActivity {
  icon: string;
  title: string;
  description: string;
  timestamp: Date;
}

@Component({
  selector: 'app-admin-dash',
  templateUrl: './admin-dash.page.html',
  host: { class: 'admin-dash' },
  standalone: false,
})
export class AdminDashPage implements OnInit {
  activeTab: 'pending' | 'vendors' | 'drivers' | 'stores' | 'analytics' = 'pending';

  vendorSearchTerm = '';
  driverSearchTerm = '';
  storeSearchTerm = '';

  expandedVendor: string | null = null;

  private allVendors: AdminVendorRow[] = [];
  allDrivers: AdminDriverRow[] = [];
  private allStoreCards: AdminStoreCard[] = [];

  totalOrders = 0;
  totalRevenue = 0;
  activeUsers = 0;
  recentActivities: AdminActivity[] = [];

  constructor(
    private supabaseService: SupabaseService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
  ) {}

  get pendingVendors(): AdminVendorRow[] {
    return this.allVendors.filter((v) => !v.isApproved);
  }

  get pendingDrivers(): AdminDriverRow[] {
    return this.allDrivers.filter((d) => !d.isApproved);
  }

  get pendingCount(): number {
    return this.pendingVendors.length + this.pendingDrivers.length;
  }

  get filteredVendors(): AdminVendorRow[] {
    const t = this.vendorSearchTerm.trim().toLowerCase();
    if (!t) {
      return this.allVendors;
    }
    return this.allVendors.filter(
      (v) =>
        v.storeName.toLowerCase().includes(t) ||
        v.businessEmail.toLowerCase().includes(t) ||
        v.businessPhone.toLowerCase().includes(t),
    );
  }

  get filteredDrivers(): AdminDriverRow[] {
    const t = this.driverSearchTerm.trim().toLowerCase();
    if (!t) {
      return this.allDrivers;
    }
    return this.allDrivers.filter(
      (d) =>
        d.fullName.toLowerCase().includes(t) ||
        d.email.toLowerCase().includes(t) ||
        d.plateNumber.toLowerCase().includes(t),
    );
  }

  get filteredStores(): AdminStoreCard[] {
    const t = this.storeSearchTerm.trim().toLowerCase();
    if (!t) {
      return this.allStoreCards;
    }
    return this.allStoreCards.filter(
      (s) =>
        s.name.toLowerCase().includes(t) ||
        s.vendorName.toLowerCase().includes(t) ||
        String(s.category ?? '')
          .toLowerCase()
          .includes(t),
    );
  }

  async ngOnInit() {
    await this.loadDashboard();
  }

  filterVendors(): void {
    /* search text drives getters */
  }

  filterDrivers(): void {
    /* search text drives getters */
  }

  filterStores(): void {
    /* search text drives getters */
  }

  private async loadDashboard() {
    const loading = await this.loadingCtrl.create({ message: 'Loading admin data...', spinner: 'crescent' });
    await loading.present();
    try {
      await Promise.all([this.loadVendorsAndStores(), this.loadDriversList(), this.loadAnalytics()]);
    } catch (e) {
      console.error('Admin loadDashboard', e);
      await this.toast('Some data failed to load. Check console.', 'warning');
    } finally {
      await loading.dismiss();
    }
  }

  private formatAddress(a: unknown): string {
    if (a == null) {
      return '';
    }
    if (typeof a === 'string') {
      return a;
    }
    if (typeof a === 'object') {
      const o = a as Record<string, string>;
      return [o['street'], o['city'], o['state'], o['zip_code'], o['country']].filter(Boolean).join(', ');
    }
    return '';
  }

  private async loadVendorsAndStores() {
    const supabase = this.supabaseService.getSupabase();

    const [{ data: vendorsRaw, error: vErr }, { data: storesRaw, error: sErr }, { data: ordersRaw }] =
      await Promise.all([
        supabase.from('vendors').select('*').order('created_date', { ascending: false }),
        supabase.from('stores').select('*').order('name'),
        supabase.from('orders').select('vendor_id,total,payment_status').order('created_date', { ascending: false }),
      ]);

    if (vErr) {
      console.error(vErr);
      this.allVendors = [];
    }

    const salesByVendor = new Map<string, number>();
    for (const o of ordersRaw || []) {
      if (o.vendor_id == null) {
        continue;
      }
      const vid = String(o.vendor_id);
      salesByVendor.set(vid, (salesByVendor.get(vid) ?? 0) + Number(o.total ?? 0));
    }

    const stores = storesRaw || [];
    if (sErr) {
      console.error(sErr);
    }

    this.allVendors = (vendorsRaw || []).map((v: any) => {
      const vendorId = String(v.vendor_id ?? v.id);
      const myStores = stores.filter((s: any) => String(s.vendor_id) === vendorId);
      const miniStores: AdminStoreMini[] = myStores.map((s: any) => ({
        storeId: String(s.store_id),
        name: s.name ?? '',
        status: s.status ?? 'open',
        category: s.category != null ? String(s.category) : '',
        deliveryFee: Number(s.delivery_fee ?? 0),
        minOrder: Number(s.min_order ?? 0),
        rating: Number(s.rating ?? 0),
      }));

      return {
        vendorId,
        storeName: v.store_name ?? '',
        businessEmail: v.business_email ?? '',
        businessPhone: v.business_phone ?? '',
        businessAddress: typeof v.business_address === 'string' ? v.business_address : this.formatAddress(v.business_address),
        isApproved: !!v.is_approved,
        createdDate: v.created_date ? new Date(v.created_date) : null,
        totalSales: Math.round((salesByVendor.get(vendorId) ?? 0) * 100) / 100,
        rating: Number(v.rating ?? 0),
        commissionRate: v.commission_rate != null ? Number(v.commission_rate) : DEFAULT_COMMISSION_PCT,
        stores: miniStores,
      } as AdminVendorRow;
    });

    const vendorNameById = new Map(this.allVendors.map((v) => [v.vendorId, v.storeName]));

    this.allStoreCards = (storesRaw || []).map((s: any) => ({
      storeId: String(s.store_id),
      name: s.name ?? '',
      category: s.category != null ? String(s.category) : '',
      status: s.status ?? 'open',
      vendorName: vendorNameById.get(String(s.vendor_id)) ?? `Vendor #${s.vendor_id}`,
      address: this.formatAddress(s.address),
      deliveryFee: Number(s.delivery_fee ?? 0),
      minOrder: Number(s.min_order ?? 0),
      rating: Number(s.rating ?? 0),
      reviewCount: Number(s.review_count ?? 0),
      estimatedDeliveryTime: s.estimated_delivery_time ?? '—',
    }));
  }

  private async loadDriversList() {
    const supabase = this.supabaseService.getSupabase();
    const { data: drivers, error } = await supabase.from('drivers').select('*').order('created_date', { ascending: false });

    if (error) {
      console.warn('drivers table:', error.message);
      this.allDrivers = [];
      return;
    }

    const userIds = [...new Set((drivers || []).map((d: any) => d.user_id).filter((id: any) => id != null))].map(String);

    let userMap = new Map<string, any>();
    if (userIds.length) {
      const { data: users } = await supabase
        .from('users')
        .select('user_id,full_name,email,phone')
        .in(
          'user_id',
          userIds.map((id) => Number(id)).filter((n) => Number.isFinite(n)),
        );
      userMap = new Map((users || []).map((u: any) => [String(u.user_id), u]));
    }

    this.allDrivers = (drivers || []).map((d: any) => {
      const uid = String(d.user_id ?? '');
      const user = userMap.get(uid);
      return {
        driverId: String(d.driver_id ?? d.id ?? ''),
        userId: uid,
        fullName: (user?.full_name ?? '').trim() || 'Unknown driver',
        licenseNumber: d.license_number ?? '',
        vehicleModel: d.vehicle_model ?? '',
        vehicleColor: d.vehicle_color ?? '',
        plateNumber: d.plate_number ?? '',
        isApproved: !!d.is_approved,
        isOnline: !!d.is_online,
        email: user?.email ?? '',
        phone: user?.phone ?? '',
        totalDeliveries: Number(d.total_deliveries ?? 0),
        totalEarnings: Number(d.total_earnings ?? 0),
        rating: Number(d.rating ?? 0),
        licensePhotoUrl: d.license_photo_url ?? null,
        vehicleRegUrl: d.vehicle_registration_url ?? null,
      } as AdminDriverRow;
    });
  }

  private async loadAnalytics() {
    const supabase = this.supabaseService.getSupabase();

    const [{ data: orderRows, error: orderErr }, { count, error: userCountErr }] = await Promise.all([
      supabase.from('orders').select('order_id,total,status,payment_status,created_date').order('created_date', { ascending: false }),
      supabase.from('users').select('user_id', { count: 'exact', head: true }).eq('status', 'active'),
    ]);

    if (orderErr) {
      console.warn('admin analytics orders', orderErr);
    }
    if (userCountErr) {
      console.warn('admin analytics users count', userCountErr);
    }

    const list = orderRows || [];

    this.totalOrders = list.length;
    this.totalRevenue = list.reduce((sum: number, o: any) => sum + Number(o.total ?? 0), 0);
    this.activeUsers = count ?? 0;

    this.recentActivities = list.slice(0, 15).map(
      (o: any) =>
        ({
          icon: 'receipt-outline',
          title: `Order #${o.order_id}`,
          description: `${o.status ?? '—'} · R${Number(o.total ?? 0).toFixed(2)}`,
          timestamp: o.created_date ? new Date(o.created_date) : new Date(),
        }) as AdminActivity,
    );
  }

  async viewVendorDetails(v: AdminVendorRow) {
    const alert = await this.alertCtrl.create({
      header: v.storeName,
      message: `Email: ${v.businessEmail}\nPhone: ${v.businessPhone}\nAddress: ${v.businessAddress}\nStores attached: ${v.stores.length}\nCommission: ${v.commissionRate}%`,
      buttons: ['OK'],
    });
    await alert.present();
  }

  async approveVendor(v: AdminVendorRow) {
    await this.setVendorApproved(v, true);
  }

  async rejectVendor(v: AdminVendorRow) {
    const alert = await this.alertCtrl.create({
      header: 'Reject application',
      message: `Remove vendor application for "${v.storeName}"? This deletes the vendor row (stores may block if referenced).`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Reject',
          role: 'destructive',
          handler: async () => {
            const { error } = await this.supabaseService.getSupabase().from('vendors').delete().eq('vendor_id', v.vendorId);
            if (error) {
              await this.toast(error.message || 'Could not reject vendor', 'danger');
              return;
            }
            this.allVendors = this.allVendors.filter((x) => x.vendorId !== v.vendorId);
            await this.toast('Vendor application removed', 'success');
          },
        },
      ],
    });
    await alert.present();
  }

  async toggleVendorStatus(v: AdminVendorRow) {
    await this.setVendorApproved(v, !v.isApproved);
  }

  private async setVendorApproved(v: AdminVendorRow, approved: boolean) {
    const loading = await this.loadingCtrl.create({ message: 'Updating...', spinner: 'crescent' });
    await loading.present();
    try {
      const { error } = await this.supabaseService
        .getSupabase()
        .from('vendors')
        .update({ is_approved: approved })
        .eq('vendor_id', v.vendorId);
      if (error) {
        throw error;
      }
      v.isApproved = approved;
      await this.toast(approved ? 'Vendor activated' : 'Vendor deactivated', 'success');
    } catch (e: any) {
      await this.toast(e?.message ?? 'Update failed', 'danger');
    } finally {
      await loading.dismiss();
    }
  }

  toggleVendorStores(v: AdminVendorRow) {
    this.expandedVendor = this.expandedVendor === v.vendorId ? null : v.vendorId;
  }

  async toggleStoreStatus(store: AdminStoreMini) {
    const next = store.status === 'open' ? 'closed' : 'open';
    const loading = await this.loadingCtrl.create({ message: 'Updating store...', spinner: 'crescent' });
    await loading.present();
    try {
      const { error } = await this.supabaseService
        .getSupabase()
        .from('stores')
        .update({ status: next, updated_date: new Date().toISOString() })
        .eq('store_id', store.storeId);
      if (error) {
        throw error;
      }
      store.status = next;
      const card = this.allStoreCards.find((s) => s.storeId === store.storeId);
      if (card) {
        card.status = next;
      }
      await this.toast(`Store is now ${next}`, 'success');
    } catch (e: any) {
      await this.toast(e?.message ?? 'Could not update store', 'danger');
    } finally {
      await loading.dismiss();
    }
  }

  async viewDriverDetails(d: AdminDriverRow) {
    const alert = await this.alertCtrl.create({
      header: d.fullName,
      message: `License: ${d.licenseNumber}\nVehicle: ${d.vehicleModel} (${d.vehicleColor})\nPlate: ${d.plateNumber}\nEmail: ${d.email}\nPhone: ${d.phone}`,
      buttons: ['OK'],
    });
    await alert.present();
  }

  async approveDriver(d: AdminDriverRow) {
    await this.setDriverApproved(d, true);
  }

  async rejectDriver(d: AdminDriverRow) {
    const alert = await this.alertCtrl.create({
      header: 'Reject driver',
      message: `Remove application for ${d.fullName}?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Reject',
          role: 'destructive',
          handler: async () => {
            const { error } = await this.supabaseService.getSupabase().from('drivers').delete().eq('driver_id', d.driverId);
            if (error) {
              await this.toast(error.message || 'Could not reject driver', 'danger');
              return;
            }
            this.allDrivers = this.allDrivers.filter((x) => x.driverId !== d.driverId);
            await this.toast('Driver application removed', 'success');
          },
        },
      ],
    });
    await alert.present();
  }

  async viewDriverDocuments(d: AdminDriverRow) {
    const lines = [
      d.licensePhotoUrl ? `License photo:\n${d.licensePhotoUrl}` : 'No license photo URL.',
      d.vehicleRegUrl ? `Vehicle registration:\n${d.vehicleRegUrl}` : 'No vehicle registration URL.',
    ].join('\n\n');
    const alert = await this.alertCtrl.create({
      header: 'Documents',
      message: lines,
      buttons: ['OK'],
    });
    await alert.present();
  }

  async toggleDriverApproval(d: AdminDriverRow) {
    await this.setDriverApproved(d, !d.isApproved);
  }

  private async setDriverApproved(d: AdminDriverRow, approved: boolean) {
    const loading = await this.loadingCtrl.create({ message: 'Updating...', spinner: 'crescent' });
    await loading.present();
    try {
      const { error } = await this.supabaseService
        .getSupabase()
        .from('drivers')
        .update({ is_approved: approved })
        .eq('driver_id', d.driverId);
      if (error) {
        throw error;
      }
      d.isApproved = approved;
      await this.toast(approved ? 'Driver approved' : 'Driver suspended', 'success');
    } catch (e: any) {
      await this.toast(e?.message ?? 'Update failed', 'danger');
    } finally {
      await loading.dismiss();
    }
  }

  async viewStoreDetails(store: AdminStoreCard) {
    const alert = await this.alertCtrl.create({
      header: store.name,
      message: `Vendor: ${store.vendorName}\n${store.category}\n${store.address}\nFee R${store.deliveryFee} · Min R${store.minOrder}\nStatus: ${store.status}`,
      buttons: ['OK'],
    });
    await alert.present();
  }

  private async toast(message: string, color: string) {
    const t = await this.toastCtrl.create({ message, duration: 2500, color, position: 'top' });
    await t.present();
  }
}
