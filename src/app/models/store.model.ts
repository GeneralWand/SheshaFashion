import { ProductVariant } from './product.model';

export { ProductVariant };

export interface Store {
    store_id: string;        // Primary key
    vendor_id: string;
    name: string;
    description: string;
    logo_url: string;        // Changed from 'logo'
    cover_image_url: string; // Changed from 'cover_image'
    category: string;
    cuisine_type?: string;
    rating: number;
    review_count: number;
    delivery_fee: number;
    min_order: number;
    estimated_delivery_time: string;
    is_open: boolean;
    is_featured: boolean;
    address: StoreAddress;
    location: {
      lat: number;
      lng: number;
    };
    opening_hours: OpeningHours[];
    phone: string;
    email: string;
    status: string;          // 'open' or 'closed'
    created_date: Date;      // Changed from 'created_at'
    updated_date: Date;      // Changed from 'updated_at'
}

export interface StoreAddress {
    street: string;
    city: string;
    state: string;
    zip_code: string;
    country: string;
}

export interface OpeningHours {
    day: string;
    open: string;
    close: string;
    is_closed: boolean;
}

export interface StoreProduct {
    product_id: string;      // Changed from 'id'
    store_id: string;
    name: string;
    description: string;
    price: number;
    discount_price?: number;
    images: string[];
    category: string;
    /** Assigned category (subcategory if set, else parent). */
    category_id?: string;
    size?: string | null;
    color?: string | null;
    is_available: boolean;
    is_featured: boolean;
    tags: string[];
    variants: ProductVariant[];
    status: string;          // 'available' or 'unavailable'
    created_date: Date;      // Changed from 'created_at'
    updated_date: Date;      // Changed from 'updated_at'
}

export interface Category {
    category_id: string;     // Changed from 'id'
    name: string;
    description: string;
    image_url: string;       // Changed from 'image'
    icon: string;
    parent_id?: string;
    subCategories?: Category[];
    is_active: boolean;
    display_order: number;   // Changed from 'order'
}