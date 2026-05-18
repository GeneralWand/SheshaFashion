import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController, ToastController } from '@ionic/angular';
import { OrderService } from '../../services/order';
import { Order } from '../../models/order.model';
import { PLACEHOLDER_PRODUCT_IMG } from '../../utils/media';

@Component({
  selector: 'app-order-tracking',
  templateUrl: './order-tracking.page.html',
  styleUrls: ['./order-tracking.page.scss'],
  standalone: false,
})
export class OrderTrackingPage implements OnInit, OnDestroy {
  order: Order | null = null;
  trackingEvents: any[] = [];
  private subscription: any;
  readonly placeholderProduct = PLACEHOLDER_PRODUCT_IMG;

  constructor(
    private route: ActivatedRoute,
    private orderService: OrderService,
    private navCtrl: NavController,
    private toastCtrl: ToastController
  ) {}

  async ngOnInit() {
    const orderId = this.route.snapshot.paramMap.get('id');
    if (orderId) {
      await this.loadOrder(orderId);
      this.subscribeToUpdates(orderId);
    }
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  async loadOrder(orderId: string) {
    try {
      this.order = await this.orderService.getOrderById(orderId);
      this.trackingEvents = await this.orderService.trackOrder(orderId);
    } catch (error) {
      console.error('Error loading order:', error);
      this.showToast('Failed to load order details', 'danger');
      this.navCtrl.back();
    }
  }

  subscribeToUpdates(orderId: string) {
    this.subscription = this.orderService.subscribeToOrderUpdates(orderId, (payload) => {
      if (payload.eventType === 'UPDATE') {
        this.loadOrder(orderId);
      } else if (payload.eventType === 'INSERT' && payload.table === 'order_tracking') {
        this.trackingEvents.push(payload.new);
      }
    });
  }

  isEventCompleted(status: string): boolean {
    const orderStatusIndex = this.getStatusIndex(this.order?.status || '');
    const eventStatusIndex = this.getStatusIndex(status);
    return eventStatusIndex <= orderStatusIndex;
  }

  isCurrentEvent(status: string): boolean {
    const orderStatusIndex = this.getStatusIndex(this.order?.status || '');
    const eventStatusIndex = this.getStatusIndex(status);
    return eventStatusIndex === orderStatusIndex;
  }

  getStatusIndex(status: string): number {
    const statuses = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'];
    return statuses.indexOf(status);
  }

  getEventIcon(status: string): string {
    const icons: { [key: string]: string } = {
      pending: 'time-outline',
      confirmed: 'checkmark-circle-outline',
      preparing: 'sync-outline',
      ready: 'cube-outline',
      out_for_delivery: 'car-outline',
      delivered: 'checkmark-done-circle-outline',
    };
    return icons[status] || 'ellipse-outline';
  }

  getEventTitle(status: string): string {
    const titles: { [key: string]: string } = {
      pending: 'Order Placed',
      confirmed: 'Store Confirmed',
      preparing: 'Preparing',
      ready: 'Ready for Pickup',
      out_for_delivery: 'Out for Delivery',
      delivered: 'Delivered',
    };
    return titles[status] || status;
  }

  contactSupport() {
    this.showToast('Connecting to support...', 'warning');
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