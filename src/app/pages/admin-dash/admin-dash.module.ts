import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { AdminDashPageRoutingModule } from './admin-dash-routing.module';

import { AdminDashPage } from './admin-dash.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AdminDashPageRoutingModule
  ],
  declarations: [AdminDashPage]
})
export class AdminDashPageModule {}
