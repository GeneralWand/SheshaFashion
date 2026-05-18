import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { VendorRegPageRoutingModule } from './vendor-reg-routing.module';

import { VendorRegPage } from './vendor-reg.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    VendorRegPageRoutingModule
  ],
  declarations: [VendorRegPage]
})
export class VendorRegPageModule {}
