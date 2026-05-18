import { Address } from './address.model';
import { Product, Size, Color } from './product.model';

export interface Order {
    id: string;
    userId: string;
    items: OrderItem[];
    status: OrderStatus;
    subtotal: number;
    deliveryFee: number;
    total: number;
    address: Address;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    trackingId?: string;
    estimatedDelivery: Date;
    createdAt: Date;
    updatedAt: Date;
  }
  
  export interface OrderItem {
    productId: string;
    product: Product;
    quantity: number;
    size: Size;
    color: Color;
    price: number;
  }
  
  export type OrderStatus =
    | 'pending'
    | 'confirmed'
    | 'preparing'
    | 'ready'
    | 'out_for_delivery'
    | 'delivered'
    | 'cancelled';
  export type PaymentMethod = 'card' | 'cash' | 'wallet';
  export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';