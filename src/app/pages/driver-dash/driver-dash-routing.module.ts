import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { DriverDashPage } from './driver-dash.page';

const routes: Routes = [
  {
    path: '',
    component: DriverDashPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DriverDashPageRoutingModule {}
