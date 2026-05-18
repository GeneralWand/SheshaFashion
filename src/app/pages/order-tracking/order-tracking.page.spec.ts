import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrderTrackingPage } from './order-tracking.page';

describe('OrderTrackingPage', () => {
  let component: OrderTrackingPage;
  let fixture: ComponentFixture<OrderTrackingPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(OrderTrackingPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
