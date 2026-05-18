import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { NavController, ToastController, AlertController } from '@ionic/angular';
import { SupabaseService } from '../../services/supabase';
import { normalizeImageUrls, PLACEHOLDER_PRODUCT_IMG, PLACEHOLDER_STORE_IMG } from '../../utils/media';
import { CartService } from '../../services/cart';
import { AuthService } from '../../services/auth';
import { Profile } from '../../models/user.model';
import { register } from 'swiper/element/bundle';

register();

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  featuredStores: any[] = [];
  nearbyStores: any[] = [];
  popularProducts: any[] = [];
  readonly placeholderProduct = PLACEHOLDER_PRODUCT_IMG;
  readonly placeholderStore = PLACEHOLDER_STORE_IMG;
  categories: any[] = [];
  promotions: any[] = [];
  searchQuery = '';
  currentLocation = '';
  loading = true;
  cartItemCount = 0;
  profile: Profile | null = null;
  isLoggedIn = false;
  
  @ViewChild('productsScroll') productsScroll!: ElementRef;

  constructor(
    private navCtrl: NavController,
    private supabaseService: SupabaseService,
    private cartService: CartService,
    private authService: AuthService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {}

  async ngOnInit() {
    this.authService.currentProfile$.subscribe((p) => {
      this.profile = p;
      this.isLoggedIn = !!p;
    });
    await this.loadLocation();
    await this.loadCategories();
    await this.loadPromotions();
    await this.loadStores();
    await this.loadPopularProducts();
    
    this.cartService.getCartItemCount().subscribe((count: number) => {
      this.cartItemCount = count;
    });
  }

  goToLogin() {
    this.navCtrl.navigateForward('/login');
  }

  goToRegister() {
    this.navCtrl.navigateForward('/register');
  }

  goToVendorReg() {
    this.navCtrl.navigateForward('/vendor-reg');
  }

  goToDriverReg() {
    this.navCtrl.navigateForward('/driver-reg');
  }

  goToProfile() {
    this.navCtrl.navigateForward('/profile');
  }

  async logout() {
    await this.authService.logout();
    this.showToast('Logged out', 'success');
  }

  async loadLocation() {
    const savedLocation = localStorage.getItem('deliveryLocation');
    if (savedLocation) {
      this.currentLocation = JSON.parse(savedLocation).address;
    } else {
      this.currentLocation = 'Select location';
    }
  }

  async loadCategories() {
    try {
      const { data, error } = await this.supabaseService.getSupabase()
        .from('categories')
        .select('category_id, name, description, image_url, icon, parent_id, display_order, is_active')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      this.categories = data || [];
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }

  async loadPromotions() {
    try {
      const now = new Date().toISOString();
      const { data, error } = await this.supabaseService.getSupabase()
        .from('promotions')
        .select('promotion_id, code, description, type, value, min_order, start_date, end_date, is_active')
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('end_date', now)
        .order('created_date', { ascending: false })
        .limit(3);

      if (error) throw error;
      this.promotions = data || [];
    } catch (error) {
      console.error('Error loading promotions:', error);
    }
  }

  async loadStores() {
    this.loading = true;
    try {
      let query = this.supabaseService.getSupabase()
        .from('stores')
        .select(`
          store_id,
          vendor_id,
          name,
          description,
          logo_url,
          cover_image_url,
          rating,
          review_count,
          delivery_fee,
          min_order,
          estimated_delivery_time,
          status,
          is_featured,
          address,
          location,
          phone,
          email,
          opening_hours
        `)
        .eq('status', 'open');

      const { data, error } = await query;

      if (error) throw error;

      const userLocation = localStorage.getItem('deliveryLocation');
      let userLat: number | null = null;
      let userLng: number | null = null;
      
      if (userLocation) {
        const locationData = JSON.parse(userLocation);
        userLat = locationData.lat;
        userLng = locationData.lng;
      }

      let stores = (data || []).map((store: any) => {
        const s = {
          ...store,
          logo_url: store.logo_url ?? store.logo ?? '',
          cover_image_url: store.cover_image_url ?? store.cover_image ?? ''
        };
        let distance = null;
        if (userLat && userLng && s.location) {
          const storeLocation = this.parseStoreLocation(s.location);
          if (
            storeLocation &&
            typeof storeLocation.lat === 'number' &&
            typeof storeLocation.lng === 'number'
          ) {
            distance = this.calculateDistance(
              userLat, 
              userLng, 
              storeLocation.lat, 
              storeLocation.lng
            );
          }
        }
        return { ...s, distance };
      });

      if (userLat && userLng) {
        stores = stores.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
      }

      this.featuredStores = stores.filter((s: any) => s.is_featured === true).slice(0, 8);
      this.nearbyStores = stores.slice(0, 5);
      
    } catch (error) {
      console.error('Error loading stores:', error);
      this.showToast('Failed to load stores', 'danger');
    } finally {
      this.loading = false;
    }
  }

  private parseStoreLocation(rawLocation: any): { lat: number; lng: number } | null {
    if (!rawLocation) return null;
    try {
      const parsed = typeof rawLocation === 'string' ? JSON.parse(rawLocation) : rawLocation;
      if (typeof parsed?.lat !== 'number' || typeof parsed?.lng !== 'number') return null;
      return { lat: parsed.lat, lng: parsed.lng };
    } catch {
      return null;
    }
  }

  async loadPopularProducts() {
    try {
      const { data, error } = await this.supabaseService.getSupabase()
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
          rating,
          review_count,
          created_date
        `)
        .eq('status', 'available')
        .order('is_featured', { ascending: false })
        .order('created_date', { ascending: false })
        .limit(20);

      if (error) throw error;
      
      // Get unique store IDs
      const storeIds = [...new Set((data || []).map(p => p.store_id))];
      
      // Fetch all stores in one query
      const { data: stores, error: storesError } = await this.supabaseService.getSupabase()
        .from('stores')
        .select('store_id, name, logo_url')
        .in('store_id', storeIds);
      
      if (storesError) throw storesError;
      
      // Create a map of store_id to store data
      const storeMap = new Map();
      stores?.forEach(store => {
        storeMap.set(store.store_id, store);
      });
      
      // Attach store data to each product
      this.popularProducts = (data || []).map((product: any) => ({
        ...product,
        images: normalizeImageUrls(product.images),
        store: storeMap.get(product.store_id)
      }));
      
    } catch (error) {
      console.error('Error loading popular products:', error);
    }
  }

  getStoreForProduct(product: any): any {
    return product.store || null;
  }

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  async searchStores() {
    if (this.searchQuery.trim().length >= 2) {
      this.navCtrl.navigateForward('/home', { 
        queryParams: { q: this.searchQuery }
      });
    }
  }

  filterByCategory(category: any) {
    this.navCtrl.navigateForward('/home', { 
      queryParams: { category_id: category.category_id }
    });
  }

  viewAllCategories() {
    this.navCtrl.navigateForward('/categories');
  }

  viewAllNearby() {
    this.navCtrl.navigateForward('/home', {
      queryParams: { nearby: true }
    });
  }

  viewAllStores() {
    this.navCtrl.navigateForward('/home');
  }

  async applyPromotion(promotion: any) {
    this.navCtrl.navigateForward('/home', {
      queryParams: { promotion_code: promotion.code }
    });
  }

  async changeLocation() {
    const alert = await this.alertCtrl.create({
      header: 'Delivery Location',
      inputs: [
        {
          name: 'address',
          type: 'text',
          placeholder: 'Enter your address',
          value: this.currentLocation !== 'Select location' ? this.currentLocation : ''
        },
        {
          name: 'useCurrent',
          type: 'checkbox',
          label: 'Use current location',
          value: 'current'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Save',
          handler: async (data) => {
            if (data.useCurrent) {
              await this.getCurrentLocation();
            } else if (data.address) {
              this.currentLocation = data.address;
              localStorage.setItem('deliveryLocation', JSON.stringify({
                address: data.address,
                lat: null,
                lng: null
              }));
              this.showToast('Location updated', 'success');
              await this.loadStores();
              await this.loadPopularProducts();
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async getCurrentLocation() {
    try {
      const position = await this.getUserLocation();
      const address = `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
      
      this.currentLocation = address;
      localStorage.setItem('deliveryLocation', JSON.stringify({
        address: address,
        lat: position.coords.latitude,
        lng: position.coords.longitude
      }));
      this.showToast('Location updated', 'success');
      await this.loadStores();
      await this.loadPopularProducts();
    } catch (error) {
      this.showToast('Failed to get location', 'danger');
    }
  }

  getUserLocation(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject('Geolocation not supported');
      }
      navigator.geolocation.getCurrentPosition(resolve, reject);
    });
  }

  goToStore(storeId: string) {
    this.navCtrl.navigateForward(`/store/${storeId}`);
  }

  goToProduct(product: any) {
    const pid = String(product.product_id ?? product.id ?? '');
    if (!pid) return;
    this.navCtrl.navigateForward(`/product-detail/${pid}`, {
      queryParams: { store_id: product.store_id },
    });
  }

  async quickAddToCart(product: any) {
    if (product.status !== 'available') {
      this.showToast('This product is currently unavailable', 'warning');
      return;
    }

    try {
      const productId = String(product.product_id);
      const storeId = String(product.store_id);
      const images = normalizeImageUrls(product.images);

      // Convert product to match StoreProduct interface expected by cart service
      const cartProduct = {
        product_id: productId,
        store_id: storeId,
        name: product.name,
        description: product.description,
        price: Number(product.price),
        discount_price: product.discount_price != null ? Number(product.discount_price) : undefined,
        images,
        category: '',
        is_available: product.status === 'available',
        is_featured: product.is_featured || false,
        tags: [],
        variants: [],
        status: product.status,
        created_date: product.created_date,
        updated_date: product.created_date
      };
      
      const result = await this.cartService.addToCart(cartProduct, 1);
      if (result.success) {
        this.showToast('Added to cart', 'success');
      } else if (result.message && result.cart) {
        // Show store conflict warning
        const alert = await this.alertCtrl.create({
          header: 'Different Store',
          message: result.message,
          buttons: [
            {
              text: 'Cancel',
              role: 'cancel'
            },
            {
              text: 'Clear Cart & Add',
              handler: async () => {
                await this.cartService.clearCartAndAddFromNewStore(cartProduct);
                this.showToast('Added to cart', 'success');
              }
            }
          ]
        });
        await alert.present();
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      this.showToast('Failed to add to cart', 'danger');
    }
  }

  scrollProductsCarousel(direction: 'prev' | 'next') {
    if (this.productsScroll) {
      const scrollAmount = 280;
      const currentScroll = this.productsScroll.nativeElement.scrollLeft;
      const newScroll = direction === 'next' 
        ? currentScroll + scrollAmount 
        : currentScroll - scrollAmount;
      
      this.productsScroll.nativeElement.scrollTo({
        left: newScroll,
        behavior: 'smooth'
      });
    }
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 2000,
      color: color,
      position: 'bottom'
    });
    toast.present();
  }

  goToCart() {
    this.navCtrl.navigateForward('/cart');
  }
}