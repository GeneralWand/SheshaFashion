import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { StorePage } from './store.page';

const routes: Routes = [
  {
    // Allows /store to render the store page (though `id` will be null)
    path: '',
    component: StorePage
  },
  {
    // Enables URLs like /store/<storeId> to load store details/products
    path: ':id',
    component: StorePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class StorePageRoutingModule {}
