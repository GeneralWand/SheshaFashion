export interface Category {
    id: string;
    name: string;
    description: string;
    image: string;
    icon: string;
    parentId?: string;
    subCategories?: Category[];
    isActive: boolean;
    order: number;
  }
  
  export interface SubCategory {
    id: string;
    name: string;
    categoryId: string;
    image: string;
    isActive: boolean;
  }