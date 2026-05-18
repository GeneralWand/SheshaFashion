import { Component, OnInit } from '@angular/core';
import { NavController, AlertController, LoadingController, ToastController } from '@ionic/angular';
import { AuthService } from '../../services/auth';
import { OrderService } from '../../services/order';
import { Profile } from '../../models/user.model';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: false,
})
export class ProfilePage implements OnInit {
  profile: Profile | null = null;
  orderCount = 0;
  wishlistCount = 0;
  addressCount = 0;

  constructor(
    private authService: AuthService,
    private orderService: OrderService,
    private navCtrl: NavController,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController
  ) {}

  async ngOnInit() {
    await this.loadProfile();
    await this.loadStats();
  }

  async loadProfile() {
    const userId = this.authService.getCurrentUserId();
    if (userId) {
      try {
        this.profile = await this.authService.getUserProfile(userId);
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    }
  }

  async loadStats() {
    try {
      const orders = await this.orderService.getOrders();
      this.orderCount = orders.length;
      
      const wishlist = localStorage.getItem('wishlist');
      this.wishlistCount = wishlist ? JSON.parse(wishlist).length : 0;
      
      const addresses = localStorage.getItem('addresses');
      this.addressCount = addresses ? JSON.parse(addresses).length : 0;
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  async editProfile() {
    const alert = await this.alertCtrl.create({
      header: 'Edit Profile',
      inputs: [
        {
          name: 'firstName',
          type: 'text',
          value: this.profile?.first_name,
          placeholder: 'First Name'
        },
        {
          name: 'lastName',
          type: 'text',
          value: this.profile?.last_name,
          placeholder: 'Last Name'
        },
        {
          name: 'phone',
          type: 'tel',
          value: this.profile?.phone,
          placeholder: 'Phone Number'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Save',
          handler: async (data) => {
            const loading = await this.loadingCtrl.create({
              message: 'Updating profile...',
              spinner: 'crescent'
            });
            await loading.present();

            try {
              await this.authService.updateProfile({
                first_name: data.firstName,
                last_name: data.lastName,
                phone: data.phone
              });
              await this.loadProfile();
              await loading.dismiss();
              this.showToast('Profile updated successfully', 'success');
            } catch (error) {
              await loading.dismiss();
              this.showToast('Failed to update profile', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async changeAvatar() {
    // Implement avatar upload using Supabase storage
    this.showToast('Coming soon!', 'warning');
  }

  async logout() {
    const alert = await this.alertCtrl.create({
      header: 'Logout',
      message: 'Are you sure you want to logout?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Logout',
          handler: async () => {
            const loading = await this.loadingCtrl.create({
              message: 'Logging out...',
              spinner: 'crescent'
            });
            await loading.present();

            try {
              await this.authService.logout();
              await loading.dismiss();
              this.navCtrl.navigateRoot('/login');
              this.showToast('Logged out successfully', 'success');
            } catch (error) {
              await loading.dismiss();
              this.showToast('Logout failed', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  goToOrders() {
    this.navCtrl.navigateForward('/orders');
  }

  goToWishlist() {
    this.navCtrl.navigateForward('/wishlist');
  }

  goToAddresses() {
    this.navCtrl.navigateForward('/addresses');
  }

  goToPaymentMethods() {
    this.navCtrl.navigateForward('/payment-methods');
  }

  goToNotifications() {
    this.showToast('Coming soon!', 'warning');
  }

  goToHelp() {
    this.showToast('Coming soon!', 'warning');
  }

  goToAbout() {
    this.navCtrl.navigateForward('/about');
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
}