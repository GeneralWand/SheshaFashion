import { Component, Input, OnInit } from '@angular/core';
import { StoreProduct, ProductVariant } from '../../models/store.model';
import { ModalController } from '@ionic/angular';
import { PLACEHOLDER_PRODUCT_IMG } from '../../utils/media';
@Component({
  selector: 'app-product-options',
  templateUrl: './product-options.component.html',
  styleUrls: ['./product-options.component.scss'],
  standalone: false,
})
export class ProductOptionsComponent  implements OnInit {

  @Input() product!: StoreProduct;

  readonly placeholderProduct = PLACEHOLDER_PRODUCT_IMG;

  variants: ProductVariant[] = [];
  uniqueSizes: string[] = [];
  uniqueColors: string[] = [];
  selectedSize: string = '';
  selectedColor: string = '';
  quantity = 1;
  note = '';

  constructor(private modalCtrl: ModalController) {}

  ngOnInit() {
    this.variants = Array.isArray(this.product.variants) ? this.product.variants : [];
    const sizeOf = (v: ProductVariant) => (v as any).size;
    const colorOf = (v: ProductVariant) => (v as any).color;
    const sizes = this.variants
      .map(sizeOf)
      .filter((s): s is string => s != null && String(s).trim() !== '');
    const colors = this.variants
      .map(colorOf)
      .filter((c): c is string => c != null && String(c).trim() !== '');
    this.uniqueSizes = [...new Set(sizes)];
    this.uniqueColors = [...new Set(colors)];

    if (this.uniqueSizes.length) {
      this.selectedSize = this.uniqueSizes[0];
    }
    if (this.uniqueColors.length) {
      this.selectedColor = this.uniqueColors[0];
    }
  }

  getSelectedVariant(): ProductVariant | undefined {
    if (!this.variants.length) {
      return undefined;
    }
    if (!this.uniqueSizes.length && !this.uniqueColors.length) {
      return this.variants[0];
    }
    const found = this.variants.find((v) => {
      const sz = (v as any).size;
      const cl = (v as any).color;
      const sizeOk = !this.uniqueSizes.length || sz === this.selectedSize;
      const colorOk = !this.uniqueColors.length || cl === this.selectedColor;
      return sizeOk && colorOk;
    });
    return found ?? this.variants[0];
  }

  isSizeOutOfStock(size: string): boolean {
    const variantsWithSize = this.variants.filter((v) => (v as any).size === size);
    return variantsWithSize.length > 0 && variantsWithSize.every((v) => Number((v as any).stock ?? 0) === 0);
  }

  isColorOutOfStock(color: string): boolean {
    const variantsWithColor = this.variants.filter((v) => (v as any).color === color);
    return variantsWithColor.length > 0 && variantsWithColor.every((v) => Number((v as any).stock ?? 0) === 0);
  }

  isSelectedInStock(): boolean {
    const variant = this.getSelectedVariant();
    if (!variant) {
      return false;
    }
    const stock = Number((variant as any).stock ?? 0);
    return stock >= this.quantity;
  }

  getColorCode(color: string): string {
    const variant = this.variants.find(v => v.color === color);
    return variant?.color_code || '#000000';
  }

  selectSize(size: string) {
    if (!this.isSizeOutOfStock(size)) {
      this.selectedSize = size;
    }
  }

  selectColor(color: string) {
    if (!this.isColorOutOfStock(color)) {
      this.selectedColor = color;
    }
  }

  increaseQuantity() {
    if (this.isSelectedInStock()) {
      this.quantity++;
    }
  }

  decreaseQuantity() {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  addToCart() {
    const variant = this.getSelectedVariant();
    this.modalCtrl.dismiss({
      quantity: this.quantity,
      variant: variant,
      note: this.note
    });
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }
}
