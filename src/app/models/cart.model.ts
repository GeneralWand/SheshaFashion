import { ProductVariant, Store, StoreProduct } from './store.model';

export interface Cart {
  id: string;                // cart_id in database
  user_id: string;
  store_id: string | null;
  store?: Store;
  items: CartItem[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  created_date: Date;        // Changed from 'created_at'
  updated_date: Date;        // Changed from 'updated_at'
}

export interface CartItem {
  id: string;                // cart_item_id in database
  cart_id: string;
  product_id: string;
  product: StoreProduct;
  quantity: number;
  variant_id?: string;
  variant?: ProductVariant;
  price: number;
  note?: string;
}