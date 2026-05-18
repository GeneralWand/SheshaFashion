import { Component } from '@angular/core';
import { NavController, LoadingController, ToastController } from '@ionic/angular';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: false,
})
export class RegisterPage {
  userData = {
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: ''
  };
  confirmPassword = '';
  acceptTerms = false;

  constructor(
    private authService: AuthService,
    private navCtrl: NavController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController
  ) {}

  passwordsMismatch(): boolean {
    return this.userData.password !== this.confirmPassword;
  }

  async register() {
    if (this.passwordsMismatch()) {
      this.showToast('Passwords do not match', 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Creating account...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const profile = await this.authService.register(this.userData);
      await loading.dismiss();
      this.showToast('Account created successfully!', 'success');
      const dest =
        profile.role === 'admin'
          ? '/admin-dash'
          : profile.role === 'vendor'
            ? '/vendor'
            : '/home';
      this.navCtrl.navigateRoot(dest);
    } catch (error: any) {
      await loading.dismiss();
      let message = 'Registration failed. Please try again.';
      if (error.message === 'User already registered') {
        message = 'Email already registered. Please login instead.';
      }
      this.showToast(message, 'danger');
    }
  }

  async registerWithGoogle() {
    const loading = await this.loadingCtrl.create({
      message: 'Connecting to Google...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      await this.authService.loginWithGoogle();
      await loading.dismiss();
      this.showToast('Registration successful!', 'success');
      this.navCtrl.navigateRoot('/home');
    } catch (error: any) {
      await loading.dismiss();
      this.showToast('Google registration failed', 'danger');
    }
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 3000,
      color: color,
      position: 'bottom'
    });
    toast.present();
  }

  goBack() {
    this.navCtrl.back();
  }

  goToLogin() {
    this.navCtrl.navigateForward('/login');
  }
}