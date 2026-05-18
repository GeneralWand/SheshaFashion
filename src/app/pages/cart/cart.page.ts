import { Component, OnInit } from '@angular/core';
import { NavController, ToastController, AlertController } from '@ionic/angular';
import { CartService } from '../../services/cart';
import { Cart, CartItem } from '../../models/cart.model';
import { Store, ProductVariant } from '../../models/store.model';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.page.html',
  styleUrls: ['./cart.page.scss'],
  standalone: false,
})
export class CartPage implements OnInit {
  cart: Cart | null = null;
  loading = true;
  cartStore: Store | null = null;

  constructor(
    private navCtrl: NavController,
    private cartService: CartService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    this.loadCart();
  }

  ionViewWillEnter() {
    this.loadCart();
  }

  async loadCart() {
    this.loading = true;
    this.cartService.cart$.subscribe(cart => {
      this.cart = cart;
      this.cartStore = cart?.store || null;
      this.loading = false;
    });
  }

  async updateQuantity(item: CartItem, newQuantity: number) {
    if (newQuantity < 1) {
      await this.removeItem(item);
      return;
    }

    // Check stock availability - fixed variant property access
    let maxStock = 999;
    
    if (item.variant) {
      // Use 'stock' property which exists in ProductVariant
      maxStock = (item.variant as any).stock || 999;
    } else if (item.product.variants && item.product.variants.length > 0 && item.variant_id) {
      const variant = item.product.variants.find(v => (v as any).variant_id === item.variant_id);
      maxStock = (variant as any)?.stock || 999;
    }
    
    if (newQuantity > maxStock) {
      this.showToast(`Only ${maxStock} items available`, 'warning');
      return;
    }

    try {
      await this.cartService.updateCartItem(item.id, newQuantity);
      this.showToast('Cart updated', 'success');
    } catch (error) {
      console.error('Error updating quantity:', error);
      this.showToast('Failed to update cart', 'danger');
    }
  }

  async removeItem(item: CartItem) {
    const alert = await this.alertCtrl.create({
      header: 'Remove Item',
      message: `Are you sure you want to remove ${item.product.name} from your cart?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Remove',
          role: 'destructive',
          handler: async () => {
            try {
              await this.cartService.removeFromCart(item.id);
              this.showToast('Item removed', 'success');
            } catch (error) {
              console.error('Error removing item:', error);
              this.showToast('Failed to remove item', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async clearCart() {
    if (!this.cart?.items?.length) return;

    const alert = await this.alertCtrl.create({
      header: 'Clear Cart',
      message: 'Are you sure you want to remove all items from your cart?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Clear All',
          role: 'destructive',
          handler: async () => {
            try {
              await this.cartService.clearCart();
              this.showToast('Cart cleared', 'success');
            } catch (error) {
              console.error('Error clearing cart:', error);
              this.showToast('Failed to clear cart', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  goToStore() {
    if (this.cartStore) {
      this.navCtrl.navigateForward(`/store/${this.cartStore.store_id}`);
    }
  }

  continueShopping() {
    this.navCtrl.navigateBack('/home');
  }

  async proceedToCheckout() {
    if (!this.cart?.items?.length) {
      this.showToast('Your cart is empty', 'warning');
      return;
    }

    // Check if store is open
    if (this.cartStore && !this.cartStore.is_open) {
      this.showToast('This store is currently closed', 'danger');
      return;
    }

    // Check minimum order
    if (this.cartStore && this.cart.subtotal < this.cartStore.min_order) {
      this.showToast(`Minimum order amount is R${this.cartStore.min_order}`, 'warning');
      return;
    }

    // Navigate to checkout
    this.navCtrl.navigateForward('/checkout');
  }

  getItemTotal(item: CartItem): number {
    return item.price * item.quantity;
  }

  getVariantText(item: CartItem): string {
    if (!item.variant) return '';
    const variantParts = [];
    if ((item.variant as any).size) variantParts.push(`Size: ${(item.variant as any).size}`);
    if ((item.variant as any).color) variantParts.push(`Color: ${(item.variant as any).color}`);
    return variantParts.join(' • ');
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