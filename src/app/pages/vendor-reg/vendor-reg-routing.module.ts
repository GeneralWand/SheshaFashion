import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { VendorRegPage } from './vendor-reg.page';

const routes: Routes = [
  {
    path: '',
    component: VendorRegPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class VendorRegPageRoutingModule {}
