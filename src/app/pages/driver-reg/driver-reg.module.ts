import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { DriverRegPageRoutingModule } from './driver-reg-routing.module';

import { DriverRegPage } from './driver-reg.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    DriverRegPageRoutingModule
  ],
  declarations: [DriverRegPage]
})
export class DriverRegPageModule {}
