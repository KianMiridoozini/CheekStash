import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { AdminManageCategoriesComponent } from './admin-manage-categories/admin-manage-categories.component';
import { AdminManageTagsComponent } from './admin-manage-tags/admin-manage-tags.component'; 

const routes: Routes = [
  {
    path: '', // Default route for /admin
    component: AdminDashboardComponent,
  },
  { path: 'manage-categories', component: AdminManageCategoriesComponent },
  { path: 'manage-tags', component: AdminManageTagsComponent } // Add route for managing tags
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
