import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { DriverDashPageRoutingModule } from './driver-dash-routing.module';

import { DriverDashPage } from './driver-dash.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    DriverDashPageRoutingModule
  ],
  declarations: [DriverDashPage]
})
export class DriverDashPageModule {}
