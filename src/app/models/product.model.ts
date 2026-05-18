export interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
    discount_price?: number;
    images: string[];
    category_id: string;
    sub_category_id?: string;
    brand: string;
    rating: number;
    review_count: number;
    in_stock: boolean;
    is_featured: boolean;
    tags: string[];
    created_at: Date;
    updated_at: Date;
  }
  
  export interface ProductVariant {
    id: string;
    product_id: string;
    size: string;
    color: string;
    color_code: string;
    stock: number;
    sku: string;
    created_at: Date;
    updated_at: Date;
  }
  
  export interface Size {
    id: string;
    name: string;
    stock: number;
  }
  
  export interface Color {
    id: string;
    name: string;
    code: string;
    stock: number;
  }