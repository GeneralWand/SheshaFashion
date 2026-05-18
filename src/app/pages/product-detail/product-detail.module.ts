import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { IonicModule } from '@ionic/angular';

import { ProductDetailPageRoutingModule } from './product-detail-routing.module';
import { ProductOptionsModule } from '../../modals/product-options/product-options.module';

import { ProductDetailPage } from './product-detail.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    IonicModule,
    ProductDetailPageRoutingModule,
    ProductOptionsModule,
  ],
  declarations: [ProductDetailPage]
})
export class ProductDetailPageModule {}
