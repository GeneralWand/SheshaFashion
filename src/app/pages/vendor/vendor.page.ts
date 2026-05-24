import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavController, ToastController, AlertController } from '@ionic/angular';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../services/supabase';
import { AuthService } from '../../services/auth';
import { StoreService } from '../../services/store';
import { ProductService } from '../../services/product';
import { Store, StoreProduct } from '../../models/store.model';
import { Product } from '../../models/product.model';
import { Category } from '../../models/category.model';
import { fileToDataUrl } from '../../utils/media';
import { PRODUCT_SIZE_OPTIONS } from '../../constants/product-attributes';

@Component({
  selector: 'app-vendor',
  templateUrl: './vendor.page.html',
  host: { class: 'vendor' },
  standalone: false,
})
export class VendorPage implements OnInit, OnDestroy {
  activeTab: 'dashboard' | 'store' | 'products' | 'orders' | 'analytics' = 'dashboard';
  ordersHistoryFilter: 'all' | 'active' | 'completed' = 'all';
  
  // Vendor Info
  vendor: any = null;
  isApproved = false;
  isLoading = true;
  
  /** All stores linked to this vendor (Store tab picker + multi-store). */
  vendorStores: Store[] = [];

  // Store Data (working copy for the selected store)
  store: Store = {
    store_id: '',
    vendor_id: '',
    name: '',
    description: '',
    logo_url: '',
    cover_image_url: '',
    category: '',
    rating: 0,
    review_count: 0,
    delivery_fee: 0,
    min_order: 0,
    estimated_delivery_time: '30-45 min',
    is_open: true,
    is_featured: false,
    address: { street: '', city: '', state: '', zip_code: '', country: 'South Africa' },
    location: { lat: 0, lng: 0 },
    opening_hours: [],
    phone: '',
    email: '',
    status: 'open',
    created_date: new Date(),
    updated_date: new Date()
  };
  
  // Products
  products: StoreProduct[] = [];
  categories: Category[] = [];
  
  // Orders
  orders: any[] = [];
  
  // Stats
  stats = {
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    averageRating: 0
  };
  
  // Image upload
  uploadingImage = false;

  isAddProductModalOpen = false;
  readonly productSizeOptions = PRODUCT_SIZE_OPTIONS;
  addProductForm = {
    parent_category_id: '' as string,
    subcategory_id: '' as string,
    name: '',
    description: '',
    price: '',
    discount_price: '',
    stock: '',
    size: '' as string,
    color: '' as string,
  };
  addProductImagePreview: string | null = null;
  addProductImageFile: File | null = null;

  isEditProductModalOpen = false;
  editingProduct: StoreProduct | null = null;
  editProductForm = {
    parent_category_id: '' as string,
    subcategory_id: '' as string,
    name: '',
    description: '',
    price: '',
    discount_price: '',
    status: '',
    stock: '' as string,
    size: '' as string,
    color: '' as string,
  };
  editProductImagePreview: string | null = null;
  editProductImageFile: File | null = null;

  private ordersRealtimeChannel: RealtimeChannel | null = null;

  constructor(
    private navCtrl: NavController,
    private supabaseService: SupabaseService,
    private authService: AuthService,
    private storeService: StoreService,
    private productService: ProductService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {}

  async ngOnInit() {
    await this.checkVendorStatus();
    this.subscribeOrderUpdates();
  }

  ngOnDestroy() {
    if (this.ordersRealtimeChannel) {
      void this.supabaseService.getSupabase().removeChannel(this.ordersRealtimeChannel);
      this.ordersRealtimeChannel = null;
    }
  }

  private subscribeOrderUpdates() {
    if (this.ordersRealtimeChannel) {
      void this.supabaseService.getSupabase().removeChannel(this.ordersRealtimeChannel);
    }
    this.ordersRealtimeChannel = this.supabaseService
      .getSupabase()
      .channel('vendor-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        if (this.isApproved && this.store.store_id) {
          void this.loadOrders();
          void this.loadStats();
        }
      })
      .subscribe();
  }

  async checkVendorStatus() {
    this.isLoading = true;
    const userId = this.authService.getCurrentUserId();
    
    if (!userId) {
      this.navCtrl.navigateRoot('/login');
      return;
    }
    
    // Check if user is a vendor
    const { data: vendor, error } = await this.supabaseService.getSupabase()
      .from('vendors')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error || !vendor) {
      this.vendor = null;
      this.isApproved = false;
    } else {
      this.vendor = vendor;
      this.isApproved = vendor.is_approved;
      
      if (this.isApproved) {
        await this.loadVendorStores();
        if (this.store.store_id) {
          await this.loadProducts();
          await this.loadCategories();
          await this.loadOrders();
          await this.loadStats();
        } else {
          this.products = [];
          this.orders = [];
          this.stats = {
            totalProducts: 0,
            totalOrders: 0,
            totalRevenue: 0,
            averageRating: 0,
          };
          await this.loadCategories();
        }
      }
    }
    
    this.isLoading = false;
  }

  async registerAsVendor() {
    const alert = await this.alertCtrl.create({
      header: 'Become a Vendor',
      inputs: [
        {
          name: 'store_name',
          type: 'text',
          placeholder: 'Store Name',
          attributes: { required: true }
        },
        {
          name: 'store_description',
          type: 'textarea',
          placeholder: 'Store Description'
        },
        {
          name: 'business_email',
          type: 'email',
          placeholder: 'Business Email'
        },
        {
          name: 'business_phone',
          type: 'tel',
          placeholder: 'Business Phone'
        },
        {
          name: 'business_address',
          type: 'textarea',
          placeholder: 'Business Address'
        },
        {
          name: 'tax_id',
          type: 'text',
          placeholder: 'Tax ID / Registration Number (Optional)'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Submit Application',
          handler: async (data) => {
            if (!data.store_name || !data.business_email || !data.business_phone || !data.business_address) {
              this.showToast('Please fill all required fields', 'warning');
              return false;
            }
          
            const userId = this.authService.getCurrentUserId();
          
            const { error } = await this.supabaseService.getSupabase()
              .from('vendors')
              .insert({
                user_id: userId,
                store_name: data.store_name,
                store_description: data.store_description,
                business_email: data.business_email,
                business_phone: data.business_phone,
                business_address: data.business_address,
                tax_id: data.tax_id,
                is_approved: false
              });
          
            if (error) {
              this.showToast('Error submitting application', 'danger');
              return false;
            }
          
            this.showToast('Application submitted! Awaiting approval.', 'success');
            await this.checkVendorStatus();
            return true; // ✅ IMPORTANT
          }
        }
      ]
    });
    
    await alert.present();
  }

  private activeStoreStorageKey(): string {
    return `vendorActiveStore_${this.vendor?.vendor_id ?? ''}`;
  }

  private cloneStoreForEditor(s: Store): Store {
    return {
      ...s,
      address: { ...s.address },
      location: { ...s.location },
      opening_hours: Array.isArray(s.opening_hours) ? s.opening_hours.map((h) => ({ ...h })) : [],
    };
  }

  private emptyStoreShell(): Store {
    return {
      store_id: '',
      vendor_id: String(this.vendor?.vendor_id ?? ''),
      name: '',
      description: '',
      logo_url: '',
      cover_image_url: '',
      category: '',
      rating: 0,
      review_count: 0,
      delivery_fee: 0,
      min_order: 0,
      estimated_delivery_time: '30-45 min',
      is_open: true,
      is_featured: false,
      address: { street: '', city: '', state: '', zip_code: '', country: 'South Africa' },
      location: { lat: 0, lng: 0 },
      opening_hours: [],
      phone: '',
      email: '',
      status: 'open',
      created_date: new Date(),
      updated_date: new Date(),
    };
  }

  /** Load every store for this vendor; pick remembered or first. Does not auto-create. */
  async loadVendorStores() {
    try {
      this.vendorStores = await this.storeService.getStoresByVendorId(String(this.vendor.vendor_id));
    } catch (e) {
      console.error('loadVendorStores:', e);
      this.vendorStores = [];
    }

    if (this.vendorStores.length === 0) {
      this.store = this.emptyStoreShell();
      return;
    }

    const key = this.activeStoreStorageKey();
    const saved = sessionStorage.getItem(key);
    const pick =
      saved && this.vendorStores.some((s) => s.store_id === saved)
        ? saved
        : this.vendorStores[this.vendorStores.length - 1].store_id;

    const selected = this.vendorStores.find((s) => s.store_id === pick) ?? this.vendorStores[0];
    this.store = this.cloneStoreForEditor(selected);
    sessionStorage.setItem(key, this.store.store_id);
  }

  /** Create a store row from vendor application fields (quick setup). */
  async createStoreFromApplication() {
    if (!this.vendor) return;
    await this.insertNewStoreRecord({
      name: this.vendor.store_name || 'My store',
      description: this.vendor.store_description || '',
      phone: this.vendor.business_phone || '',
      email: this.vendor.business_email || '',
    });
  }

  /** Prompt for details, then insert a new store for this vendor. */
  async promptAddNewStore() {
    if (!this.vendor) return;

    const alert = await this.alertCtrl.create({
      header: 'New store',
      message: 'Add another store under your vendor account.',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'Store name', attributes: { required: true } },
        { name: 'description', type: 'textarea', placeholder: 'Description (optional)' },
        {
          name: 'phone',
          type: 'tel',
          placeholder: 'Phone',
          value: this.vendor.business_phone || '',
        },
        {
          name: 'email',
          type: 'email',
          placeholder: 'Email',
          value: this.vendor.business_email || '',
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Create',
          handler: async (data) => {
            if (!data.name?.trim()) {
              this.showToast('Store name is required', 'warning');
              return false;
            }
            await this.insertNewStoreRecord({
              name: data.name.trim(),
              description: data.description?.trim() || '',
              phone: data.phone?.trim() || this.vendor.business_phone || '',
              email: data.email?.trim() || this.vendor.business_email || '',
            });
            return true;
          },
        },
      ],
    });

    await alert.present();
  }

  private async insertNewStoreRecord(payload: {
    name: string;
    description: string;
    phone: string;
    email: string;
  }) {
    const { data, error } = await this.supabaseService.getSupabase()
      .from('stores')
      .insert({
        vendor_id: Number(this.vendor.vendor_id),
        name: payload.name,
        description: payload.description || null,
        phone: payload.phone || null,
        email: payload.email || null,
        status: 'open',
        is_featured: false,
        location: { lat: 0, lng: 0 },
        address: { street: '', city: '', state: '', zip_code: '', country: 'South Africa' },
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      this.showToast('Could not create store', 'danger');
      return;
    }

    if (data?.store_id != null) {
      sessionStorage.setItem(this.activeStoreStorageKey(), String(data.store_id));
    }

    await this.loadVendorStores();
    await this.loadProducts();
    await this.loadOrders();
    await this.loadStats();
    this.showToast('Store created', 'success');
  }

  async onVendorStoreChange(ev: CustomEvent) {
    const id = String(ev.detail?.value ?? '');
    if (!id || id === this.store.store_id) {
      return;
    }
    sessionStorage.setItem(this.activeStoreStorageKey(), id);
    const selected = this.vendorStores.find((s) => s.store_id === id);
    if (selected) {
      this.store = this.cloneStoreForEditor(selected);
    }
    await this.loadProducts();
    await this.loadOrders();
    await this.loadStats();
  }

  /** Writes current `store` fields to Supabase (no full-page loading overlay). */
  private async persistStoreToSupabase(): Promise<boolean> {
    const sid = parseInt(this.store.store_id, 10);
    if (!Number.isFinite(sid)) {
      return false;
    }

    const { error } = await this.supabaseService.getSupabase()
      .from('stores')
      .update({
        name: this.store.name,
        description: this.store.description,
        delivery_fee: this.store.delivery_fee,
        min_order: this.store.min_order,
        estimated_delivery_time: this.store.estimated_delivery_time,
        phone: this.store.phone,
        email: this.store.email,
        address: this.store.address,
        logo_url: this.store.logo_url?.trim() ? this.store.logo_url : null,
        cover_image_url: this.store.cover_image_url?.trim() ? this.store.cover_image_url : null,
        updated_date: new Date().toISOString(),
      })
      .eq('store_id', sid);

    if (error) {
      console.error(error);
      return false;
    }
    return true;
  }

  async saveStoreDetails() {
    if (!this.store.store_id) {
      this.showToast('Create or select a store first', 'warning');
      return;
    }
    this.isLoading = true;
    const ok = await this.persistStoreToSupabase();
    if (ok) {
      await this.loadVendorStores();
      const refreshed = this.vendorStores.find((s) => s.store_id === this.store.store_id);
      if (refreshed) {
        this.store = this.cloneStoreForEditor(refreshed);
      }
    }
    this.isLoading = false;
    if (!ok) {
      this.showToast('Error saving store details', 'danger');
    } else {
      this.showToast('Store details saved', 'success');
    }
  }

  async onLogoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!this.store.store_id) {
      this.showToast('Create or select a store first', 'warning');
      input.value = '';
      return;
    }

    this.uploadingImage = true;
    try {
      this.store.logo_url = await fileToDataUrl(file);
      const ok = await this.persistStoreToSupabase();
      this.showToast(ok ? 'Logo saved' : 'Could not save logo', ok ? 'success' : 'danger');
    } catch (e: any) {
      console.error('Logo:', e);
      this.showToast(e?.message || 'Could not read logo image', 'danger');
    } finally {
      this.uploadingImage = false;
      input.value = '';
    }
  }

  async onCoverSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!this.store.store_id) {
      this.showToast('Create or select a store first', 'warning');
      input.value = '';
      return;
    }

    this.uploadingImage = true;
    try {
      this.store.cover_image_url = await fileToDataUrl(file);
      const ok = await this.persistStoreToSupabase();
      this.showToast(ok ? 'Cover image saved' : 'Could not save cover', ok ? 'success' : 'danger');
    } catch (e: any) {
      console.error('Cover:', e);
      this.showToast(e?.message || 'Could not read cover image', 'danger');
    } finally {
      this.uploadingImage = false;
      input.value = '';
    }
  }

  async onProductImageSelected(event: any, product: StoreProduct) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    try {
      await this.uploadProductImageById(product.product_id, file, Array.isArray(product.images) ? product.images : []);

      this.showToast('Product image uploaded', 'success');
      await this.loadProducts();
    } catch (error) {
      console.error('Error uploading product image:', error);
      this.showToast('Failed to upload image', 'danger');
    } finally {
      if (event?.target) event.target.value = '';
    }
  }

  private async uploadProductImageById(productId: string, file: File, existingImages: string[] = []): Promise<void> {
    const pid = parseInt(String(productId), 10);
    if (!Number.isFinite(pid)) {
      throw new Error('Invalid product id');
    }

    const dataUrl = await fileToDataUrl(file);
    const merged = [
      dataUrl,
      ...existingImages.filter((img) => typeof img === 'string' && img.trim() && img !== dataUrl),
    ];

    const { data: row, error } = await this.supabaseService.getSupabase()
      .from('products')
      .update({
        images: merged,
        updated_date: new Date().toISOString(),
      })
      .eq('product_id', pid)
      .select('product_id, images')
      .maybeSingle();

    if (error) {
      console.error('products update (images):', error);
      throw error;
    }
    if (!row) {
      throw new Error(
        'Could not update product images (no row returned). Check RLS policies allow UPDATE and SELECT on products.'
      );
    }
  }

  async loadProducts() {
    if (!this.store.store_id) {
      this.products = [];
      return;
    }
    try {
      this.products = await this.storeService.getStoreProducts(this.store.store_id);
    } catch (error) {
      console.error('Error loading products:', error);
      this.products = [];
    }
  }

  async loadCategories() {
    try {
      this.categories = await this.productService.getCategories();
    } catch (error) {
      console.error('Error loading categories:', error);
      this.categories = [];
    }
  }

  openAddProductModal() {
    if (!this.store.store_id) {
      this.showToast('Create or select a store first', 'warning');
      return;
    }
    this.resetAddProductForm();
    this.isAddProductModalOpen = true;
  }

  closeAddProductModal() {
    this.onAddProductModalDismiss();
  }

  resetAddProductForm() {
    this.addProductForm = {
      parent_category_id: '',
      subcategory_id: '',
      name: '',
      description: '',
      price: '',
      discount_price: '',
      stock: '',
      size: '',
      color: '',
    };
    this.addProductImagePreview = null;
    this.addProductImageFile = null;
  }

  get categoryParents(): Category[] {
    return this.categories.filter((c) => !c.parentId);
  }

  get addFormSubcategories(): Category[] {
    const pid = this.addProductForm.parent_category_id;
    if (!pid) return [];
    return this.categories.filter((c) => c.parentId === pid);
  }

  get editFormSubcategories(): Category[] {
    const pid = this.editProductForm.parent_category_id;
    if (!pid) return [];
    return this.categories.filter((c) => c.parentId === pid);
  }

  onAddParentCategoryChange(): void {
    this.addProductForm.subcategory_id = '';
  }

  onEditParentCategoryChange(): void {
    this.editProductForm.subcategory_id = '';
  }

  /** Map stored `category_id` to parent + sub selects. */
  private categoryHierarchyForProduct(categoryId?: string): { parent: string; sub: string } {
    if (!categoryId) {
      return { parent: '', sub: '' };
    }
    const cat = this.categories.find((c) => c.id === categoryId);
    if (!cat) {
      return { parent: '', sub: '' };
    }
    if (cat.parentId) {
      return { parent: cat.parentId, sub: cat.id };
    }
    return { parent: cat.id, sub: '' };
  }

  private resolveAddProductCategoryId(): number | null {
    const p = this.addProductForm.parent_category_id;
    if (!p) return null;
    const subs = this.addFormSubcategories;
    if (subs.length > 0) {
      const s = this.addProductForm.subcategory_id;
      return s ? parseInt(s, 10) : null;
    }
    return parseInt(p, 10);
  }

  private resolveEditProductCategoryId(): number | null {
    const p = this.editProductForm.parent_category_id;
    if (!p) return null;
    const subs = this.editFormSubcategories;
    if (subs.length > 0) {
      const s = this.editProductForm.subcategory_id;
      return s ? parseInt(s, 10) : null;
    }
    return parseInt(p, 10);
  }

  private buildVariantPayload(
    stockRaw: string | number | null | undefined,
    sizeRaw: string,
    colorRaw: string
  ): Record<string, unknown>[] {
    const stockNum =
      stockRaw !== '' && stockRaw != null ? parseInt(String(stockRaw), 10) : 0;
    const stock = Number.isFinite(stockNum) ? stockNum : 0;
    const sizeVal = sizeRaw?.trim() || '';
    const colorVal = colorRaw?.trim() || '';
    const row: Record<string, unknown> = { stock };
    if (sizeVal) {
      row['size'] = sizeVal;
    }
    if (colorVal) {
      row['color'] = colorVal;
      row['color_code'] = '#333333';
    }
    return [row];
  }

  onAddProductModalDismiss() {
    this.isAddProductModalOpen = false;
    this.resetAddProductForm();
  }

  onEditProductModalDismiss() {
    this.isEditProductModalOpen = false;
    this.editingProduct = null;
    this.editProductImagePreview = null;
    this.editProductImageFile = null;
  }

  onAddProductImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.addProductImageFile = file;
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        this.addProductImagePreview = (e.target?.result as string) ?? null;
      };
      reader.readAsDataURL(file);
    }
  }

  async submitAddProduct() {
    const { name, price, description, discount_price, stock, size, color } = this.addProductForm;
    if (!name?.trim() || price === '' || price == null) {
      this.showToast('Name and price are required', 'warning');
      return;
    }
    if (!this.store.store_id) {
      this.showToast('Create or select a store first', 'warning');
      return;
    }
    if (!this.addProductForm.parent_category_id) {
      this.showToast('Please select a category', 'warning');
      return;
    }
    if (this.addFormSubcategories.length > 0 && !this.addProductForm.subcategory_id) {
      this.showToast('Please select a subcategory', 'warning');
      return;
    }

    const resolvedCategoryId = this.resolveAddProductCategoryId();

    const imageFile = this.addProductImageFile;
    let images: string[] = [];

    if (imageFile) {
      try {
        images = [await fileToDataUrl(imageFile)];
      } catch (readErr: any) {
        console.error('Product image read:', readErr);
        this.showToast(readErr?.message || 'Could not read the image file.', 'danger');
        return;
      }
    }

    const variants = this.buildVariantPayload(stock, size, color);
    const vendorId = Number(this.vendor.vendor_id);
    const storeId = parseInt(String(this.store.store_id), 10);
    const sizeVal = size?.trim() ? size.trim() : null;
    const colorVal = color?.trim() ? color.trim() : null;

    const { data: createdProduct, error } = await this.supabaseService.getSupabase()
      .from('products')
      .insert({
        store_id: storeId,
        vendor_id: vendorId,
        category_id: resolvedCategoryId,
        name: name.trim(),
        description: description || null,
        price: parseFloat(String(price)),
        discount_price: discount_price !== '' && discount_price != null ? parseFloat(String(discount_price)) : null,
        status: 'available',
        size: sizeVal,
        color: colorVal,
        variants,
        images,
      })
      .select('product_id, images')
      .single();

    if (error) {
      this.showToast('Error adding product', 'danger');
      console.error(error);
      return;
    }

    if (images.length > 0) {
      const saved = createdProduct?.images as unknown;
      const savedOk = Array.isArray(saved) && saved.some((u) => typeof u === 'string' && u.length > 0);
      if (!savedOk) {
        this.showToast(
          'Product was created but images did not persist. Check products.images column (text[]), triggers, and RLS.',
          'warning'
        );
      }
    }

    this.showToast('Product added successfully', 'success');
    await this.loadProducts();
    await this.loadStats();
    this.closeAddProductModal();
  }

  openEditProductModal(product: StoreProduct) {
    this.editingProduct = product;
    const { parent, sub } = this.categoryHierarchyForProduct(product.category_id);
    const v0 =
      Array.isArray(product.variants) && product.variants.length > 0
        ? (product.variants[0] as any)
        : {};
    const stockFromVariant = v0.stock != null ? String(v0.stock) : '';
    this.editProductForm = {
      parent_category_id: parent,
      subcategory_id: sub,
      name: product.name,
      description: product.description || '',
      price: String(product.price),
      discount_price: product.discount_price != null ? String(product.discount_price) : '',
      status: product.status || 'available',
      stock: stockFromVariant,
      size: (product.size ?? v0.size ?? '') as string,
      color: (product.color ?? v0.color ?? '') as string,
    };
    this.editProductImagePreview = null;
    this.editProductImageFile = null;
    this.isEditProductModalOpen = true;
  }

  closeEditProductModal() {
    this.onEditProductModalDismiss();
  }

  onEditProductImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.editProductImageFile = file;
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        this.editProductImagePreview = (e.target?.result as string) ?? null;
      };
      reader.readAsDataURL(file);
    }
  }

  async submitEditProduct() {
    if (!this.editingProduct) return;

    const { name, description, price, discount_price, status, stock, size, color } = this.editProductForm;
    if (!name?.trim() || price === '' || price == null) {
      this.showToast('Name and price are required', 'warning');
      return;
    }
    if (!this.editProductForm.parent_category_id) {
      this.showToast('Please select a category', 'warning');
      return;
    }
    if (this.editFormSubcategories.length > 0 && !this.editProductForm.subcategory_id) {
      this.showToast('Please select a subcategory', 'warning');
      return;
    }

    const resolvedCategoryId = this.resolveEditProductCategoryId();
    const variants = this.buildVariantPayload(stock, size, color);
    const sizeVal = size?.trim() ? size.trim() : null;
    const colorVal = color?.trim() ? color.trim() : null;

    const { error } = await this.supabaseService.getSupabase()
      .from('products')
      .update({
        name: name.trim(),
        description: description || null,
        price: parseFloat(String(price)),
        discount_price: discount_price !== '' && discount_price != null ? parseFloat(String(discount_price)) : null,
        status: status || 'available',
        category_id: resolvedCategoryId,
        size: sizeVal,
        color: colorVal,
        variants,
        updated_date: new Date().toISOString(),
      })
      .eq('product_id', parseInt(this.editingProduct.product_id, 10));

    if (error) {
      this.showToast('Error updating product', 'danger');
      return;
    }

    if (this.editProductImageFile) {
      try {
        await this.uploadProductImageById(
          this.editingProduct.product_id,
          this.editProductImageFile,
          Array.isArray(this.editingProduct.images) ? this.editingProduct.images : []
        );
      } catch (uploadError) {
        console.error('Error uploading product image:', uploadError);
        this.showToast('Product updated, but image upload failed', 'warning');
      }
    }

    this.showToast('Product updated', 'success');
    await this.loadProducts();
    this.closeEditProductModal();
  }

  async deleteProduct(product: StoreProduct) {
    const alert = await this.alertCtrl.create({
      header: 'Delete Product',
      message: `Are you sure you want to delete "${product.name}"?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            const { error } = await this.supabaseService.getSupabase()
              .from('products')
              .delete()
              .eq('product_id', parseInt(product.product_id));
            
            if (error) {
              this.showToast('Error deleting product', 'danger');
            } else {
              this.showToast('Product deleted', 'success');
              await this.loadProducts();
              await this.loadStats();
            }
          }
        }
      ]
    });
    
    await alert.present();
  }

  /** Store IDs for the active vendor (selected store, or all stores). */
  private getOrderStoreIds(): number[] {
    const ids = new Set<number>();
    const active = parseInt(String(this.store?.store_id ?? ''), 10);
    if (Number.isFinite(active)) {
      ids.add(active);
    }
    for (const s of this.vendorStores) {
      const sid = parseInt(String(s.store_id), 10);
      if (Number.isFinite(sid)) {
        ids.add(sid);
      }
    }
    return [...ids];
  }

  private isActiveOrderStatus(status: string | undefined): boolean {
    return [
      'pending',
      'confirmed',
      'preparing',
      'ready',
      'out_for_delivery',
      'processing',
      'shipped',
    ].includes(String(status ?? ''));
  }

  private isCompletedOrderStatus(status: string | undefined): boolean {
    return ['delivered', 'cancelled'].includes(String(status ?? ''));
  }

  async loadOrders() {
    const storeIds = this.getOrderStoreIds();
    if (!storeIds.length) {
      this.orders = [];
      return;
    }

    const supabase = this.supabaseService.getSupabase();
    let query = supabase.from('orders').select('*').order('created_date', { ascending: false });

    query = storeIds.length === 1 ? query.eq('store_id', storeIds[0]) : query.in('store_id', storeIds);

    const { data, error } = await query;

    if (error) {
      console.error('loadOrders:', error);
      this.orders = [];
      return;
    }

    let rows = data ?? [];

    const orderIds = rows.map((o) => o.order_id).filter((id) => id != null);
    if (orderIds.length) {
      const { data: assignments } = await supabase
        .from('delivery_assignments')
        .select('order_id, driver_id, accepted_date, pickup_date, delivered_date')
        .in('order_id', orderIds);

      if (assignments?.length) {
        const byOrder = new Map<number, any[]>();
        for (const a of assignments) {
          const oid = Number(a.order_id);
          if (!byOrder.has(oid)) {
            byOrder.set(oid, []);
          }
          byOrder.get(oid)!.push(a);
        }
        rows = rows.map((o) => ({
          ...o,
          delivery: byOrder.get(Number(o.order_id)) ?? [],
        }));
      }
    }

    const userIds = [...new Set(rows.map((o) => o.user_id).filter((id) => id != null))];
    if (userIds.length) {
      const { data: users } = await supabase
        .from('users')
        .select('user_id, full_name, email, phone')
        .in('user_id', userIds);

      if (users?.length) {
        const userMap = new Map(users.map((u) => [Number(u.user_id), u]));
        rows = rows.map((o) => ({
          ...o,
          user: userMap.get(Number(o.user_id)) ?? null,
        }));
      }
    }

    this.orders = rows;
  }

  get filteredOrderHistory(): any[] {
    if (this.ordersHistoryFilter === 'active') {
      return this.orders.filter((o) => this.isActiveOrderStatus(o.status));
    }
    if (this.ordersHistoryFilter === 'completed') {
      return this.orders.filter((o) => this.isCompletedOrderStatus(o.status));
    }
    return this.orders;
  }

  isOrderAwaitingDriver(order: any): boolean {
    return order?.status === 'pending';
  }

  orderStatusLabel(order: any): string {
    if (order?.status === 'pending') {
      return 'Awaiting driver';
    }
    const hasDriver = Array.isArray(order?.delivery)
      ? order.delivery.length > 0
      : !!order?.delivery;
    if (order?.status === 'confirmed' && hasDriver) {
      return 'Confirmed (auto)';
    }
    return order?.status ?? '';
  }

  async selectDashboardTab() {
    this.activeTab = 'dashboard';
    await this.loadOrders();
  }

  async selectOrdersTab() {
    this.activeTab = 'orders';
    await this.loadOrders();
    if (this.orders.length > 0 && this.ordersHistoryFilter === 'completed') {
      const hasCompleted = this.orders.some((o) => this.isCompletedOrderStatus(o.status));
      if (!hasCompleted) {
        this.ordersHistoryFilter = 'all';
      }
    }
  }

  async updateOrderStatus(order: any, status: string) {
    if (order.status === 'pending') {
      this.showToast('This order is waiting for a driver to accept first', 'warning');
      return;
    }
    if (status === 'pending') {
      this.showToast('Cannot move an order back to pending', 'warning');
      return;
    }

    const { error } = await this.supabaseService.getSupabase()
      .from('orders')
      .update({ 
        status: status,
        updated_date: new Date()
      })
      .eq('order_id', order.order_id);
    
    if (error) {
      this.showToast('Error updating order status', 'danger');
    } else {
      await this.supabaseService.getSupabase().from('order_tracking').insert({
        order_id: order.order_id,
        status,
        description: `Store updated order to ${status}`,
        location: 'Vendor',
      });
      this.showToast(`Order status updated to ${status}`, 'success');
      await this.loadOrders();
    }
  }

  async viewOrderDetails(order: any) {
    const itemsList = order.items?.map((item: any) => 
      `• ${item.name || item.product_name} x${item.quantity} - R${item.price}`
    ).join('\n');
    
    const alert = await this.alertCtrl.create({
      header: `Order #${order.order_id}`,
      message: `
        Customer: ${order.user?.full_name || 'N/A'}
        Phone: ${order.user?.phone || 'N/A'}
        Email: ${order.user?.email || 'N/A'}
        
        Items:
        ${itemsList || 'No items'}
        
        Subtotal: R${order.subtotal}
        Delivery: R${order.delivery_fee}
        Total: R${order.total}
        
        ${order.delivery_notes ? `Notes: ${order.delivery_notes}` : ''}
      `,
      buttons: ['Close']
    });
    
    await alert.present();
  }

  async loadStats() {
    if (!this.store.store_id) {
      this.stats = {
        totalProducts: 0,
        totalOrders: 0,
        totalRevenue: 0,
        averageRating: 0,
      };
      return;
    }

    // Total products
    this.stats.totalProducts = this.products.length;
    
    const storeIds = this.getOrderStoreIds();
    let statsQuery = this.supabaseService.getSupabase().from('orders').select('total, status');
    statsQuery =
      storeIds.length === 1
        ? statsQuery.eq('store_id', storeIds[0])
        : statsQuery.in('store_id', storeIds);

    const { data: orders } = await statsQuery;

    if (orders) {
      this.stats.totalOrders = orders.length;
      this.stats.totalRevenue = orders
        .filter((o) => o.status === 'delivered')
        .reduce((sum, o) => sum + (o.total || 0), 0);
    }
    
    // Average rating
    const productIds = this.products.map(p => parseInt(p.product_id));
    if (productIds.length > 0) {
      const { data: reviews } = await this.supabaseService.getSupabase()
        .from('reviews')
        .select('rating')
        .in('product_id', productIds);
      
      if (reviews && reviews.length > 0) {
        const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
        this.stats.averageRating = totalRating / reviews.length;
      }
    }
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

  logout() {
    this.authService.logout();
    this.navCtrl.navigateRoot('/login');
  }
}