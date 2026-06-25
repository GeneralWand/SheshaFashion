import { Component, OnInit } from '@angular/core';
import { NavController, ToastController, LoadingController } from '@ionic/angular';
import { Cart } from '../../models/cart.model';
import { Address } from '../../models/address.model';
import { CartService } from '../../services/cart';
import { AuthService } from '../../services/auth';
import { OrderService } from '../../services/order';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.page.html',
  styleUrls: ['./checkout.page.scss'],
  standalone: false,
})
export class CheckoutPage implements OnInit {
  cart: Cart | null = null;
  addresses: Address[] = [];
  selectedAddressId = '';
  paymentMethod: 'card' | 'cash' | 'wallet' = 'cash';
  loading = true;
  placingOrder = false;
  showNewAddress: boolean = false; 

  newAddress: Omit<Address, 'id' | 'userId'> = {
    label: 'Home',
    fullName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'South Africa',
    isDefault: false,
    latitude: undefined,
    longitude: undefined
  };

  constructor(
    private navCtrl: NavController,
    private cartService: CartService,
    private authService: AuthService,
    private orderService: OrderService,
    private supabaseService: SupabaseService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) {}

  async ngOnInit() {
    if (!this.authService.isAuthenticated()) {
      this.navCtrl.navigateRoot('/login');
      return;
    }

    this.cartService.cart$.subscribe((cart) => {
      this.cart = cart;
    });

    if (!this.cart?.items?.length) {
      this.showToast('Your cart is empty', 'warning');
      this.navCtrl.navigateRoot('/cart');
      return;
    }

    await this.loadAddresses();
    this.prefillAddressForm();
    this.loading = false;
  }

  private prefillAddressForm() {
    const profile = this.authService.getCurrentUser();
    this.newAddress.fullName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim();
    this.newAddress.phone = profile?.phone ?? '';
  }

  async loadAddresses() {
    const userId = this.authService.getCurrentUserId();
    if (!userId) return;

    const { data, error } = await this.supabaseService.getSupabase()
      .from('addresses')
      .select('*')
      .eq('user_id', Number(userId))
      .order('is_default', { ascending: false })
      .order('created_date', { ascending: false });

    if (error) {
      this.addresses = [];
      return;
    }

    this.addresses = (data || []).map((address: any) => ({
      id: String(address.address_id),
      userId: String(address.user_id),
      label: address.label ?? '',
      fullName: address.full_name ?? '',
      phone: address.phone ?? '',
      addressLine1: address.address_line1 ?? '',
      addressLine2: address.address_line2 ?? '',
      city: address.city ?? '',
      state: address.state ?? '',
      zipCode: address.zip_code ?? '',
      country: address.country ?? 'South Africa',
      isDefault: !!address.is_default,
      latitude: address.latitude ?? undefined,
      longitude: address.longitude ?? undefined
    }));

    if (this.addresses.length > 0) {
      this.selectedAddressId = this.addresses[0].id;
    }
  }

  async saveNewAddress() {
    const userId = this.authService.getCurrentUserId();
    if (!userId) return;

    if (
      !this.newAddress.fullName ||
      !this.newAddress.phone ||
      !this.newAddress.addressLine1 ||
      !this.newAddress.city ||
      !this.newAddress.state ||
      !this.newAddress.zipCode
    ) {
      this.showToast('Please complete all required address fields', 'warning');
      return;
    }

    const { data, error } = await this.supabaseService.getSupabase()
      .from('addresses')
      .insert({
        user_id: Number(userId),
        label: this.newAddress.label,
        full_name: this.newAddress.fullName,
        phone: this.newAddress.phone,
        address_line1: this.newAddress.addressLine1,
        address_line2: this.newAddress.addressLine2 || null,
        city: this.newAddress.city,
        state: this.newAddress.state,
        zip_code: this.newAddress.zipCode,
        country: this.newAddress.country || 'South Africa',
        is_default: this.addresses.length === 0 || this.newAddress.isDefault
      })
      .select('*')
      .single();

    if (error || !data) {
      this.showToast('Failed to save address', 'danger');
      return;
    }

    await this.loadAddresses();
    this.selectedAddressId = String(data.address_id);
    this.showToast('Address saved', 'success');
  }

  async placeOrder() {
    if (!this.cart?.items?.length) {
      this.showToast('Your cart is empty', 'warning');
      return;
    }

    if (!this.selectedAddressId) {
      this.showToast('Please select or add a delivery address', 'warning');
      return;
    }

    this.placingOrder = true;
    const loading = await this.loadingCtrl.create({
      message: 'Placing order...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const order = await this.orderService.createOrder({
        addressId: Number(this.selectedAddressId),
        paymentMethod: this.paymentMethod
      });
      await loading.dismiss();
      this.showToast('Order placed successfully!', 'success');
      this.navCtrl.navigateRoot(`/order-tracking/${order.id}`);
    } catch (error) {
      await loading.dismiss();
      this.showToast('Failed to place order. Please try again.', 'danger');
    } finally {
      this.placingOrder = false;
    }
  }

  get selectedAddress(): Address | undefined {
    return this.addresses.find((a) => a.id === this.selectedAddressId);
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2200,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}
