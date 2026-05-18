import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AdminDashPage } from './admin-dash.page';

const routes: Routes = [
  {
    path: '',
    component: AdminDashPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminDashPageRoutingModule {}
