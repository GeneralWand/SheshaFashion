import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController, ToastController, ModalController, AlertController } from '@ionic/angular';
import { StoreService } from '../../services/store';
import { CartService } from '../../services/cart';
import { Store, StoreProduct } from '../../models/store.model';
import { ProductOptionsComponent } from 'src/app/modals/product-options/product-options.component';
import { PLACEHOLDER_PRODUCT_IMG, PLACEHOLDER_STORE_IMG } from '../../utils/media';


@Component({
  selector: 'app-store',
  templateUrl: './store.page.html',
  styleUrls: ['./store.page.scss'],
  standalone: false,
})
export class StorePage implements OnInit {
  loading: boolean = false;
  store: Store | null = null;
  products: StoreProduct[] = [];
  filteredProducts: StoreProduct[] = [];
  categories: string[] = [];
  selectedCategory = 'all';
  cartStore: Store | null = null;
  cartItemCount = 0;
  readonly placeholderProduct = PLACEHOLDER_PRODUCT_IMG;
  readonly placeholderStore = PLACEHOLDER_STORE_IMG;

  constructor(
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private storeService: StoreService,
    private cartService: CartService,
    private toastCtrl: ToastController,
    private modalCtrl: ModalController,
    private alertCtrl: AlertController
  ) {}

  async ngOnInit() {
    const storeId = this.route.snapshot.paramMap.get('id');
    if (storeId) {
      await this.loadStore(storeId);
      await this.loadProducts(storeId);
    }
    
    this.cartService.getCartItemCount().subscribe((count: number) => {
      this.cartItemCount = count;
    });
    
    this.cartService.getCurrentStore().subscribe((store: Store | null) => {
      this.cartStore = store;
    });
  }

  async loadStore(storeId: string) {
    try {
      this.store = await this.storeService.getStoreById(storeId);
    } catch (error) {
      console.error('Error loading store:', error);
      this.showToast('Failed to load store', 'danger');
      this.navCtrl.back();
    }
  }

  async loadProducts(storeId: string) {
    try {
      this.products = await this.storeService.getStoreProducts(storeId);
      this.categories = await this.storeService.getStoreCategories(storeId);
      this.filterProducts();
    } catch (error) {
      console.error('Error loading products:', error);
      this.showToast('Failed to load products', 'danger');
    }
  }

  filterProducts() {
    if (this.selectedCategory === 'all') {
      this.filteredProducts = this.products;
    } else {
      this.filteredProducts = this.products.filter(p => p.category === this.selectedCategory);
    }
  }

  getOpeningHours(): string {
    if (!this.store?.opening_hours) return '';
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const hours = this.store.opening_hours.find(h => h.day === today);
    if (!hours || hours.is_closed) return '';
    return `${hours.open} - ${hours.close}`;
  }

  async showProductOptions(product: StoreProduct) {
    const modal = await this.modalCtrl.create({
      component: ProductOptionsComponent,
      componentProps: {
        product: product
      }
    });
    
    modal.onDidDismiss().then(async (result) => {
      if (result.data) {
        await this.addToCart(product, result.data.quantity, result.data.variant, result.data.note);
      }
    });
    
    await modal.present();
  }

  async addToCart(product: StoreProduct, quantity: number = 1, variant?: any, note?: string) {
    const result = await this.cartService.addToCart(product, quantity, variant, note);
    
    if (!result.success && result.message?.includes('clear your cart')) {
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
              await this.cartService.clearCartAndAddFromNewStore(product, quantity, variant);
              this.showToast(`Added ${product.name} to cart`, 'success');
              this.updateCartBadge();
            }
          }
        ]
      });
      await alert.present();
    } else if (result.success) {
      this.showToast(`Added ${product.name} to cart`, 'success');
      this.updateCartBadge();
    } else {
      this.showToast(result.message || 'Failed to add to cart', 'danger');
    }
  }

  async clearCartAndContinue() {
    const alert = await this.alertCtrl.create({
      header: 'Clear Cart',
      message: `Your cart currently has items from ${this.cartStore?.name}. Are you sure you want to clear it and order from ${this.store?.name}?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Clear Cart',
          handler: async () => {
            await this.cartService.clearCart();
            this.showToast('Cart cleared', 'success');
            this.updateCartBadge();
          }
        }
      ]
    });
    await alert.present();
  }

  updateCartBadge() {
    this.cartService.getCartItemCount().subscribe((count: number) => {
      this.cartItemCount = count;
    });
  }

  goToCart() {
    this.navCtrl.navigateForward('/cart');
  }

  openProductDetail(product: StoreProduct, ev?: Event) {
    ev?.stopPropagation?.();
    const pid = String(product.product_id ?? '');
    if (!pid) return;
    this.navCtrl.navigateForward(`/product-detail/${pid}`, {
      queryParams: { store_id: this.store?.store_id ?? product.store_id },
    });
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
}