import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ProductOptionsComponent } from './product-options.component';

@NgModule({
  declarations: [ProductOptionsComponent],
  imports: [CommonModule, FormsModule, IonicModule],
  exports: [ProductOptionsComponent],
})
export class ProductOptionsModule {}
