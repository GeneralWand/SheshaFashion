import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';
import { NavController, ToastController, ModalController, AlertController } from '@ionic/angular';
import { ProductService } from '../../services/product';
import { StoreService } from '../../services/store';
import { CartService } from '../../services/cart';
import { Store, StoreProduct } from '../../models/store.model';
import { ProductOptionsComponent } from '../../modals/product-options/product-options.component';
import { PLACEHOLDER_PRODUCT_IMG } from '../../utils/media';

@Component({
  selector: 'app-product-detail',
  templateUrl: './product-detail.page.html',
  styleUrls: ['./product-detail.page.scss'],
  standalone: false,
})
export class ProductDetailPage implements OnInit, OnDestroy {
  product: StoreProduct | null = null;
  store: Store | null = null;
  loading = true;
  selectedImageIndex = 0;
  readonly placeholderProduct = PLACEHOLDER_PRODUCT_IMG;
  private routeSub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private productService: ProductService,
    private storeService: StoreService,
    private cartService: CartService,
    private toastCtrl: ToastController,
    private modalCtrl: ModalController,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    this.routeSub = combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(
      async ([paramMap, queryMap]) => {
        const productId =
          paramMap.get('productId') || queryMap.get('product_id') || queryMap.get('id');
        const storeId = queryMap.get('store_id') || undefined;
        if (!productId) {
          this.loading = false;
          await this.showToast('Product not found', 'warning');
          return;
        }
        await this.loadProduct(String(productId), storeId ? String(storeId) : undefined);
      }
    );
  }

  ngOnDestroy() {
    this.routeSub?.unsubscribe();
  }

  private categoryLabel(raw: any): string {
    const c = raw?.category;
    if (c && typeof c === 'object' && c.name) return String(c.name);
    return '';
  }

  private toStoreProduct(raw: any): StoreProduct {
    return {
      product_id: String(raw.product_id),
      store_id: String(raw.store_id),
      name: raw.name,
      description: raw.description ?? '',
      price: Number(raw.price),
      discount_price: raw.discount_price != null ? Number(raw.discount_price) : undefined,
      images: Array.isArray(raw.images) ? raw.images : [],
      category: this.categoryLabel(raw),
      category_id: raw.category_id != null ? String(raw.category_id) : undefined,
      size: raw.size != null ? String(raw.size) : null,
      color: raw.color != null ? String(raw.color) : null,
      is_available: raw.status === 'available',
      is_featured: !!raw.is_featured,
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      variants: Array.isArray(raw.variants) ? raw.variants : [],
      status: raw.status,
      created_date: raw.created_date ? new Date(raw.created_date) : new Date(),
      updated_date: raw.updated_date ? new Date(raw.updated_date) : new Date(),
    };
  }

  async loadProduct(productId: string, storeId?: string) {
    this.loading = true;
    this.selectedImageIndex = 0;
    try {
      const raw = await this.productService.getProductById(productId);
      this.product = this.toStoreProduct(raw);
      const sid = storeId || this.product.store_id;
      if (sid) {
        this.store = await this.storeService.getStoreById(String(sid));
      }
    } catch (e) {
      console.error(e);
      await this.showToast('Failed to load product', 'danger');
      this.product = null;
    } finally {
      this.loading = false;
    }
  }

  mainImageSrc(): string {
    const imgs = this.product?.images;
    if (imgs?.length) {
      return imgs[this.selectedImageIndex] ?? imgs[0];
    }
    return this.placeholderProduct;
  }

  async openOptions() {
    if (!this.product) return;
    const modal = await this.modalCtrl.create({
      component: ProductOptionsComponent,
      componentProps: { product: this.product },
    });
    modal.onDidDismiss().then(async (result) => {
      if (result.data) {
        await this.addToCart(result.data.quantity, result.data.variant, result.data.note);
      }
    });
    await modal.present();
  }

  async addToCart(quantity: number, variant?: any, note?: string) {
    if (!this.product) return;
    const result = await this.cartService.addToCart(this.product, quantity, variant, note);
    if (!result.success && result.message?.toLowerCase().includes('clear')) {
      const alert = await this.alertCtrl.create({
        header: 'Different Store',
        message: result.message,
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Clear Cart & Add',
            handler: async () => {
              await this.cartService.clearCartAndAddFromNewStore(this.product!, quantity, variant, note);
              await this.showToast('Added to cart', 'success');
            },
          },
        ],
      });
      await alert.present();
    } else if (result.success) {
      await this.showToast('Added to cart', 'success');
    } else {
      await this.showToast(result.message || 'Failed to add to cart', 'danger');
    }
  }

  async quickAdd() {
    if (!this.product?.is_available) {
      await this.showToast('This product is unavailable', 'warning');
      return;
    }
    if (this.product.variants?.length) {
      await this.openOptions();
      return;
    }
    await this.addToCart(1);
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color,
      position: 'bottom',
    });
    await toast.present();
  }

  goToCart() {
    this.navCtrl.navigateForward('/cart');
  }

  goToStore() {
    if (this.store) {
      this.navCtrl.navigateForward(`/store/${this.store.store_id}`);
    }
  }
}
