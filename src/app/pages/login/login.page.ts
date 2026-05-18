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
  credentials = {
    email: '',
    password: ''
  };

  constructor(
    private authService: AuthService,
    private navCtrl: NavController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {}

  async login() {
    const loading = await this.loadingCtrl.create({
      message: 'Signing in...',
      spinner: 'crescent'
    });
  
    await loading.present();
  
    try {
      const profile = await this.authService.login(this.credentials);
  
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
          handler: async (data) => {
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
    toast.present();
  }

  goToRegister() {
    this.navCtrl.navigateForward('/register');
  }
}