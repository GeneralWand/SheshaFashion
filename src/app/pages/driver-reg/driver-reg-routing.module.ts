import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { DriverRegPage } from './driver-reg.page';

const routes: Routes = [
  {
    path: '',
    component: DriverRegPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DriverRegPageRoutingModule {}
