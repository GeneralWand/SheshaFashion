export interface Address {
    id: string;
    userId: string;
    label: string;
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    isDefault: boolean;
    landmark?: string;
    latitude?: number;
    longitude?: number;
  }