import { Component, OnInit } from '@angular/core';
import { NavController, LoadingController, ToastController } from '@ionic/angular';
import { OrderService } from '../../services/order';
import { Order } from '../../models/order.model';
import { PLACEHOLDER_PRODUCT_IMG } from '../../utils/media';

@Component({
  selector: 'app-orders',
  templateUrl: './orders.page.html',
  styleUrls: ['./orders.page.scss'],
  standalone: false,
})
export class OrdersPage implements OnInit {
  orders: Order[] = [];
  filteredOrders: Order[] = [];
  selectedStatus = 'all';
  loading = true;
  readonly placeholderProduct = PLACEHOLDER_PRODUCT_IMG;

  constructor(
    private orderService: OrderService,
    private navCtrl: NavController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController
  ) {}

  async ngOnInit() {
    await this.loadOrders();
  }

  async loadOrders() {
    this.loading = true;
    try {
      this.orders = await this.orderService.getOrders();
      this.filterOrders();
    } catch (error) {
      console.error('Error loading orders:', error);
      this.showToast('Failed to load orders', 'danger');
    } finally {
      this.loading = false;
    }
  }

  filterOrders() {
    if (this.selectedStatus === 'all') {
      this.filteredOrders = this.orders;
    } else {
      this.filteredOrders = this.orders.filter(order => order.status === this.selectedStatus);
    }
  }

  goToOrderDetail(orderId: string) {
    this.navCtrl.navigateForward(`/order/${orderId}`);
  }

  trackOrder(event: Event, orderId: string) {
    event.stopPropagation();
    this.navCtrl.navigateForward(`/order-tracking/${orderId}`);
  }

  goToHome() {
    this.navCtrl.navigateBack('/home');
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