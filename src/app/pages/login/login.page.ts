import { Component } from '@angular/core';
import { NavController, LoadingController, ToastController, AlertController } from '@ionic/angular';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage {
  // Login Data
  loginData = {
    email: '',
    password: ''
  };
  showLoginPassword: boolean = false;
  rememberMe: boolean = false;

  // Register Data
  registerData = {
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: ''
  };
  showRegisterPassword: boolean = false;
  confirmPassword: string = '';
  acceptTerms: boolean = false;

  constructor(
    private authService: AuthService,
    private navCtrl: NavController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {}

  // ========== LOGIN METHODS ==========
  async login() {
    const loading = await this.loadingCtrl.create({
      message: 'Signing in...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const profile = await this.authService.login(this.loginData);
      await loading.dismiss();
      this.showToast('Welcome back!', 'success');

      const dest =
        profile.role === 'admin'
          ? '/admin-dash'
          : profile.role === 'vendor'
            ? '/vendor'
            : profile.role === 'driver'
              ? '/driver-dash'
              : profile.role === 'customer'
                ? '/home'
                : '/home';

      this.navCtrl.navigateRoot(dest);
    } catch (error: any) {
      await loading.dismiss();
      let message = 'Login failed. Please check your credentials.';
      if (error.message === 'Invalid login credentials') {
        message = 'Invalid email or password';
      }
      this.showToast(message, 'danger');
    }
  }

  async loginWithGoogle() {
    const loading = await this.loadingCtrl.create({
      message: 'Connecting to Google...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      await this.authService.loginWithGoogle();
      await loading.dismiss();
      this.showToast('Login successful!', 'success');
      this.navCtrl.navigateRoot('/home');
    } catch (error: any) {
      await loading.dismiss();
      this.showToast('Google login failed', 'danger');
    }
  }

  async loginWithFacebook() {
    const loading = await this.loadingCtrl.create({
      message: 'Connecting to Facebook...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      // Your Facebook login logic
      await loading.dismiss();
      this.showToast('Facebook login successful!', 'success');
      this.navCtrl.navigateRoot('/home');
    } catch (error: any) {
      await loading.dismiss();
      this.showToast('Facebook login failed', 'danger');
    }
  }

  async forgotPassword() {
    const alert = await this.alertCtrl.create({
      header: 'Reset Password',
      message: 'Enter your email address to receive a password reset link.',
      inputs: [
        {
          name: 'email',
          type: 'email',
          placeholder: 'Email address'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Send',
          handler: async (data: any) => {
            if (data.email) {
              const loading = await this.loadingCtrl.create({
                message: 'Sending reset link...',
                spinner: 'crescent'
              });
              await loading.present();

              try {
                await this.authService.resetPassword(data.email);
                await loading.dismiss();
                this.showToast('Password reset link sent to your email', 'success');
              } catch (error) {
                await loading.dismiss();
                this.showToast('Failed to send reset link', 'danger');
              }
            }
          }
        }
      ]
    });

    await alert.present();
  }

  // ========== REGISTER METHODS ==========
  registerPasswordsMismatch(): boolean {
    return this.registerData.password !== this.confirmPassword;
  }

  async register() {
    if (this.registerPasswordsMismatch()) {
      this.showToast('Passwords do not match', 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Creating account...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const profile = await this.authService.register(this.registerData);
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

  // ========== UTILITY METHODS ==========
  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 3000,
      color: color,
      position: 'bottom',
      buttons: [
        {
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }
}