import { Component, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {
  ActionSheetController,
  LoadingController,
  NavController,
  ToastController,
} from '@ionic/angular';
import { AuthService } from '../../services/auth';
import { SupabaseService } from '../../services/supabase';
import { fileToDataUrl } from '../../utils/media';
import { isUniqueViolation, isUsersEmailUniqueViolation } from '../../utils/postgres-errors';

export interface VendorRegStoreDraft {
  name: string;
  description: string;
  address: string;
  location: { lat: number; lng: number } | null;
  deliveryFee: number | string;
  minOrder: number | string;
  logoUrl: string;
}

@Component({
  selector: 'app-vendor-reg',
  templateUrl: './vendor-reg.page.html',
  styleUrls: ['./vendor-reg.page.scss'],
  standalone: false,
})
export class VendorRegPage implements OnInit {
  vendorRegForm!: FormGroup;
  activeSegment: 'account' | 'business' | 'stores' = 'account';
  stores: VendorRegStoreDraft[] = [];
  businessDocUrl: string | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private supabaseService: SupabaseService,
    private navCtrl: NavController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private actionSheetCtrl: ActionSheetController,
  ) {}

  ngOnInit() {
    this.vendorRegForm = this.fb.group(
      {
        fullName: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        phone: ['', Validators.required],
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', Validators.required],
        storeName: ['', Validators.required],
        businessEmail: ['', [Validators.required, Validators.email]],
        businessPhone: ['', Validators.required],
        businessAddress: ['', Validators.required],
        taxId: [''],
        termsAccepted: [false, Validators.requiredTrue],
      },
      { validators: VendorRegPage.passwordsMatch },
    );

    if (this.authService.isAuthenticated()) {
      const p = this.authService.getCurrentUser();
      if (p) {
        this.vendorRegForm.patchValue({
          fullName: `${p.first_name} ${p.last_name}`.trim(),
          email: p.email,
          phone: p.phone ?? '',
        });
      }
      this.vendorRegForm.get('password')?.clearValidators();
      this.vendorRegForm.get('confirmPassword')?.clearValidators();
      this.vendorRegForm.get('password')?.updateValueAndValidity();
      this.vendorRegForm.get('confirmPassword')?.updateValueAndValidity();
    }

    if (this.stores.length === 0) {
      this.addStore();
    }
  }

  static passwordsMatch(group: AbstractControl): ValidationErrors | null {
    const pwdCtrl = group.get('password');
    const confirmCtrl = group.get('confirmPassword');
    const p = pwdCtrl?.value ?? '';
    const c = confirmCtrl?.value ?? '';
    if (!pwdCtrl?.hasError('required') && !p && !c) {
      return null;
    }
    return p === c ? null : { passwordMismatch: true };
  }

  addStore() {
    this.stores.push({
      name: '',
      description: '',
      address: '',
      location: null,
      deliveryFee: 0,
      minOrder: 0,
      logoUrl: '',
    });
  }

  removeStore(index: number) {
    this.stores.splice(index, 1);
    if (this.stores.length === 0) {
      this.addStore();
    }
  }

  /** Same pattern as driver-reg / vendor logo: `fileToDataUrl` (no Storage bucket). */
  async uploadBusinessDoc() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        this.businessDocUrl = await fileToDataUrl(file);
        await this.showToast('Document ready', 'success');
      } catch (e: any) {
        await this.showToast(e?.message || 'Could not read document', 'danger');
      }
    };
    input.click();
  }

  /** Matches vendor dashboard `onLogoSelected`: embed file as data URL on the draft store. */
  async uploadStoreLogo(index: number) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        this.stores[index].logoUrl = await fileToDataUrl(file);
        await this.showToast('Logo ready', 'success');
      } catch (e: any) {
        await this.showToast(e?.message || 'Could not read logo image', 'danger');
      }
    };
    input.click();
  }

  async pickStoreLocation(index: number) {
    const sheet = await this.actionSheetCtrl.create({
      header: 'Store location',
      buttons: [
        {
          text: 'Use current location',
          handler: async () => {
            try {
              const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                  enableHighAccuracy: true,
                  timeout: 15000,
                });
              });
              this.stores[index].location = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              };
              await this.showToast('Location saved', 'success');
            } catch {
              await this.showToast('Could not read your location', 'warning');
            }
          },
        },
        {
          text: 'Enter coordinates',
          handler: () => {
            void this.promptStoreCoordinates(index);
          },
        },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  private async promptStoreCoordinates(index: number) {
    const lat = window.prompt('Latitude (e.g. -26.2041)');
    const lng = window.prompt('Longitude (e.g. 28.0473)');
    const la = lat ? parseFloat(lat) : NaN;
    const lo = lng ? parseFloat(lng) : NaN;
    if (!Number.isFinite(la) || !Number.isFinite(lo)) {
      await this.showToast('Invalid coordinates', 'warning');
      return;
    }
    this.stores[index].location = { lat: la, lng: lo };
    await this.showToast('Location saved', 'success');
  }

  private storesValid(): boolean {
    return this.stores.every(
      (s) =>
        !!s.name?.trim() &&
        !!s.address?.trim() &&
        !!s.location &&
        Number.isFinite(s.location.lat) &&
        Number.isFinite(s.location.lng),
    );
  }

  async registerVendor() {
    Object.keys(this.vendorRegForm.controls).forEach((k) => {
      this.vendorRegForm.get(k)?.markAsTouched();
    });

    if (this.vendorRegForm.invalid) {
      await this.showToast('Please complete all required fields', 'warning');
      return;
    }
    if (!this.storesValid()) {
      await this.showToast('Each store needs a name, address, and a location', 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Submitting application...',
      spinner: 'crescent',
    });
    await loading.present();

    try {
      let userId = this.authService.getCurrentUserId();
      const v = this.vendorRegForm.getRawValue();

      if (!userId) {
        const full = String(v.fullName).trim();
        const sp = full.indexOf(' ');
        const firstName = sp === -1 ? full : full.slice(0, sp).trim();
        const lastName = sp === -1 ? '-' : full.slice(sp + 1).trim() || '-';
        const profile = await this.authService.register({
          email: v.email,
          password: v.password,
          firstName,
          lastName,
          phone: v.phone,
          role: 'vendor',
        });
        userId = profile.id;
      }

      const combinedDescription =
        this.stores.map((s) => s.description).filter(Boolean).join('\n\n') || null;

      const { data: vendorRow, error: vendorError } = await this.supabaseService
        .getSupabase()
        .from('vendors')
        .insert({
          user_id: userId,
          store_name: v.storeName,
          store_description: combinedDescription,
          business_email: v.businessEmail,
          business_phone: v.businessPhone,
          business_address: v.businessAddress,
          tax_id: v.taxId?.trim() || null,
          is_approved: false,
        })
        .select()
        .single();

      if (vendorError || !vendorRow) {
        throw vendorError ?? new Error('Could not create vendor application');
      }

      const vendorId = Number(vendorRow.vendor_id);

      for (const s of this.stores) {
        const { error: storeError } = await this.supabaseService.getSupabase().from('stores').insert({
          vendor_id: vendorId,
          name: s.name.trim(),
          description: s.description?.trim() || null,
          phone: v.businessPhone || null,
          email: v.businessEmail || null,
          delivery_fee: Number(s.deliveryFee) || 0,
          min_order: Number(s.minOrder) || 0,
          status: 'open',
          is_featured: false,
          location: s.location,
          address: {
            street: s.address.trim(),
            city: '',
            state: '',
            zip_code: '',
            country: 'South Africa',
          },
          logo_url: s.logoUrl?.trim() ? s.logoUrl.trim() : null,
        });
        if (storeError) {
          throw storeError;
        }
      }

      await this.authService.persistRegistrationRole(String(userId), 'vendor');

      await loading.dismiss();
      await this.showToast('Application submitted! Awaiting approval.', 'success');
      await this.navCtrl.navigateRoot('/vendor');
    } catch (e: any) {
      await loading.dismiss();
      let message = 'Registration failed. Please try again.';
      if (isUsersEmailUniqueViolation(e)) {
        message = 'Email may already be registered. Try logging in.';
      } else if (isUniqueViolation(e)) {
        message =
          'This application conflicts with existing data (e.g. you may already have a vendor profile). Try logging in.';
      } else if (e?.message) {
        message = e.message;
      }
      await this.showToast(message, 'danger');
    }
  }

  private async showToast(message: string, color: string) {
    const t = await this.toastCtrl.create({
      message,
      duration: 2800,
      color,
      position: 'top',
    });
    await t.present();
  }
}
