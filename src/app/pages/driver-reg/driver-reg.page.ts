import { Component, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { LoadingController, NavController, ToastController } from '@ionic/angular';
import { AuthService } from '../../services/auth';
import { SupabaseService } from '../../services/supabase';
import { fileToDataUrl } from '../../utils/media';
import { isUniqueViolation, isUsersEmailUniqueViolation } from '../../utils/postgres-errors';

@Component({
  selector: 'app-driver-reg',
  templateUrl: './driver-reg.page.html',
  styleUrls: ['./driver-reg.page.scss'],
  standalone: false,
})
export class DriverRegPage implements OnInit {
  driverRegForm!: FormGroup;
  currentStep = 1;
  licensePhotoUrl: string | null = null;
  vehicleRegUrl: string | null = null;
  /** Open stores — driver selects one or more to deliver for */
  storeChoices: { store_id: number; name: string; selected: boolean }[] = [];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private supabaseService: SupabaseService,
    private navCtrl: NavController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
  ) {}

  ngOnInit() {
    this.driverRegForm = this.fb.group(
      {
        fullName: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        phone: ['', Validators.required],
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', Validators.required],
        licenseNumber: ['', Validators.required],
        licenseExpiry: ['', Validators.required],
        backgroundCheckConsent: [false, Validators.requiredTrue],
        vehicleType: ['', Validators.required],
        vehicleModel: ['', Validators.required],
        vehicleColor: ['', Validators.required],
        plateNumber: ['', Validators.required],
      },
      { validators: DriverRegPage.passwordsMatch },
    );

    if (this.authService.isAuthenticated()) {
      const p = this.authService.getCurrentUser();
      if (p) {
        this.driverRegForm.patchValue({
          fullName: `${p.first_name} ${p.last_name}`.trim(),
          email: p.email,
          phone: p.phone ?? '',
        });
      }
      this.driverRegForm.get('password')?.clearValidators();
      this.driverRegForm.get('confirmPassword')?.clearValidators();
      this.driverRegForm.get('password')?.updateValueAndValidity();
      this.driverRegForm.get('confirmPassword')?.updateValueAndValidity();
    }

    void this.loadStoreChoices();
  }

  async loadStoreChoices() {
    const { data, error } = await this.supabaseService
      .getSupabase()
      .from('stores')
      .select('store_id, name')
      .eq('status', 'open')
      .order('name', { ascending: true });

    if (error) {
      console.error(error);
      this.storeChoices = [];
      return;
    }
    this.storeChoices = (data || []).map((s: any) => ({
      store_id: Number(s.store_id),
      name: String(s.name),
      selected: false,
    }));
  }

  toggleStoreChoice(row: { store_id: number; name: string; selected: boolean }) {
    row.selected = !row.selected;
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

  nextStep() {
    if (this.currentStep === 1) {
      this.markStepControlsTouched(['fullName', 'email', 'phone', 'password', 'confirmPassword']);
      if (
        this.driverRegForm.get('fullName')?.invalid ||
        this.driverRegForm.get('email')?.invalid ||
        this.driverRegForm.get('phone')?.invalid ||
        this.driverRegForm.get('password')?.invalid ||
        this.driverRegForm.get('confirmPassword')?.invalid ||
        this.driverRegForm.hasError('passwordMismatch')
      ) {
        void this.toast('Please fix the errors in personal information', 'warning');
        return;
      }
    }
    if (this.currentStep === 2) {
      this.markStepControlsTouched(['licenseNumber', 'licenseExpiry', 'backgroundCheckConsent']);
      if (
        this.driverRegForm.get('licenseNumber')?.invalid ||
        this.driverRegForm.get('licenseExpiry')?.invalid ||
        this.driverRegForm.get('backgroundCheckConsent')?.invalid
      ) {
        void this.toast('Please complete license and consent', 'warning');
        return;
      }
      if (!this.licensePhotoUrl) {
        void this.toast('Please upload a license photo', 'warning');
        return;
      }
    }
    if (this.currentStep < 3) {
      this.currentStep += 1;
    }
  }

  previousStep() {
    if (this.currentStep > 1) {
      this.currentStep -= 1;
    }
  }

  private markStepControlsTouched(names: string[]) {
    for (const n of names) {
      this.driverRegForm.get(n)?.markAsTouched();
    }
  }

  /** Same pattern as vendor `onLogoSelected` / `onCoverSelected`: `fileToDataUrl` + store string (no object storage). */
  async uploadLicensePhoto() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        this.licensePhotoUrl = await fileToDataUrl(file);
        await this.toast('License photo ready', 'success');
      } catch (e: any) {
        await this.toast(e?.message || 'Could not read license photo', 'danger');
      }
    };
    input.click();
  }

  /** Same as license: data URL stored in DB on submit (matches vendor image-in-DB approach). */
  async uploadVehicleRegistration() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        this.vehicleRegUrl = await fileToDataUrl(file);
        await this.toast('Document ready', 'success');
      } catch (e: any) {
        await this.toast(e?.message || 'Could not read document', 'danger');
      }
    };
    input.click();
  }

  async registerDriver() {
    this.markStepControlsTouched([
      'vehicleType',
      'vehicleModel',
      'vehicleColor',
      'plateNumber',
    ]);
    if (this.driverRegForm.invalid) {
      await this.toast('Please complete all required fields', 'warning');
      return;
    }
    if (!this.vehicleRegUrl) {
      await this.toast('Please upload vehicle registration', 'warning');
      return;
    }

    const appliedStoreIds = this.storeChoices.filter((s) => s.selected).map((s) => s.store_id);
    if (appliedStoreIds.length === 0) {
      await this.toast('Select at least one store you want to deliver for', 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Submitting...', spinner: 'crescent' });
    await loading.present();

    try {
      let userId = this.authService.getCurrentUserId();
      const v = this.driverRegForm.getRawValue();

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
        });
        userId = profile.id;
      }

      const { error } = await this.supabaseService.getSupabase().from('drivers').insert({
        user_id: userId,
        license_number: v.licenseNumber.trim(),
        license_expiry: v.licenseExpiry,
        license_photo_url: this.licensePhotoUrl,
        vehicle_type: v.vehicleType,
        vehicle_model: v.vehicleModel.trim(),
        vehicle_color: v.vehicleColor.trim(),
        plate_number: v.plateNumber.trim(),
        vehicle_registration_url: this.vehicleRegUrl,
        background_check_consent: !!v.backgroundCheckConsent,
        is_approved: false,
        applied_store_ids: appliedStoreIds,
      });

      if (error) {
        throw error;
      }

      await this.authService.persistRegistrationRole(String(userId), 'driver');

      await loading.dismiss();
      await this.toast('Application submitted! Awaiting approval.', 'success');
      await this.navCtrl.navigateRoot('/driver-dash');
    } catch (e: any) {
      await loading.dismiss();
      let message = 'Could not submit application. Try again or contact support.';
      if (isUsersEmailUniqueViolation(e)) {
        message = 'This email may already be registered.';
      } else if (isUniqueViolation(e)) {
        message =
          'This application conflicts with existing data (e.g. you may already have a driver profile). Try logging in.';
      } else if (e?.message) {
        message = e.message;
      }
      if (e?.message?.includes('relation') && e?.message?.includes('does not exist')) {
        message =
          'Database table `drivers` is missing or columns do not match. Add the table in Supabase or adjust the insert fields.';
      }
      if (e?.message?.includes('invalid input syntax for type bigint') && e?.message?.includes('[')) {
        message =
          'Column applied_store_ids must be bigint[] (array), not bigint. Run the fix SQL in supabase/schema-additions.sql.';
      } else if (
        e?.message?.includes('applied_store_ids') ||
        (e?.message?.includes('column') && e?.message?.includes('does not exist'))
      ) {
        message =
          'Add column applied_store_ids as bigint[] on drivers (see supabase/schema-additions.sql) and try again.';
      }
      await this.toast(message, 'danger');
    }
  }

  private async toast(message: string, color: string) {
    const t = await this.toastCtrl.create({
      message,
      duration: 3200,
      color,
      position: 'top',
    });
    await t.present();
  }
}
