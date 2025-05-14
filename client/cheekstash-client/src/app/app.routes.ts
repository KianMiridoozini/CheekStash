import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { ProfileComponent } from './users/profile/profile.component';
import { EditProfileComponent } from './users/profile/edit-profile/edit-profile.component';
import { CheekListComponent } from './cheeks/cheek-list/cheek-list.component';
import { CheekDetailComponent } from './cheeks/cheek-detail/cheek-detail.component';
import { CheekFormComponent } from './cheeks/cheek-form/cheek-form.component'; // Import the new form component
import { CategoriesListComponent } from './categories/categories-list/categories-list.component';
import { adminGuard } from './auth/guards/admin.guard';
import { cheekOwnerGuard } from './auth/guards/cheek-owner.guard';

export const appRoutes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'profile', component: ProfileComponent },
  { path: 'profile/edit', component: EditProfileComponent },
  { path: 'cheeks', component: CheekListComponent },
  { path: 'cheeks/create', component: CheekFormComponent },
  { path: 'cheeks/:username/:cheekSlug', component: CheekDetailComponent },
  { path: 'users/:username', component: ProfileComponent }, 
  { path: 'cheeks/:username', redirectTo: 'users/:username', pathMatch: 'full' },
  { path: 'categories', component: CategoriesListComponent },
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule),
    canActivate: [adminGuard]
  },
    {
    path: 'cheeks/:username/:cheekSlug/edit',
    component: CheekFormComponent,
    canActivate: [cheekOwnerGuard] 
  },
  { path: '**', redirectTo: '' },
];
