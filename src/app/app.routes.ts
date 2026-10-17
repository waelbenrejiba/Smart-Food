
import { Routes } from '@angular/router';
import { Chef } from './pages/chef/chef';

export const routes: Routes = [
  { path: 'chef', component: Chef },
  { path: '', redirectTo: 'chef', pathMatch: 'full' },
  { path: '**', redirectTo: 'chef' }
];