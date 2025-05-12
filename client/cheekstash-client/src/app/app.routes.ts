import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { ProfileComponent } from './users/profile/profile.component';
import { EditProfileComponent } from './users/profile/edit-profile/edit-profile.component';
import { CheekListComponent } from './cheeks/cheek-list/cheek-list.component';
import { CheekDetailComponent } from './cheeks/cheek-detail/cheek-detail.component';
import { CheekCreateComponent } from './cheeks/cheek-create/cheek-create.component'; 
import { CategoriesListComponent } from './categories/categories-list/categories-list.component';
import { adminGuard } from './auth/admin.guard';

export const appRoutes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'profile', component: ProfileComponent },
  { path: 'profile/edit', component: EditProfileComponent },
  { path: 'cheeks', component: CheekListComponent },
  { path: 'cheeks/create', component: CheekCreateComponent },
  { path: 'cheeks/:username/:cheekSlug', component: CheekDetailComponent }, // Using separate path parameters
  { path: 'users/:username', component: ProfileComponent }, // View any user's profile with the enhanced ProfileComponent
  { path: 'cheeks/:username', redirectTo: 'users/:username', pathMatch: 'full' }, // Redirect with pathMatch: 'full'
  { path: 'categories', component: CategoriesListComponent },
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule),
    canActivate: [adminGuard]
  },
  { path: '**', redirectTo: '' },
];
