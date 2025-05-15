import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 

import { AdminRoutingModule } from './admin-routing.module';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { AdminManageCategoriesComponent } from './admin-manage-categories/admin-manage-categories.component';
import { AdminManageUsersComponent } from './admin-manage-users/admin-manage-users.component';
import { AdminManageTagsComponent } from './admin-manage-tags/admin-manage-tags.component';
import { SharedModule } from '../shared/shared.module';


@NgModule({
  declarations: [
    AdminDashboardComponent,
    AdminManageCategoriesComponent,
    AdminManageTagsComponent,
    AdminManageUsersComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    AdminRoutingModule,
    SharedModule
  ]
})
export class AdminModule { }
