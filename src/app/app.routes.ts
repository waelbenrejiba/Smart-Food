import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home';
import {LoginComponent} from './pages/login/login';
import {UserComponent} from './pages/user/user';
import {Chef} from './pages/chef/chef';

export const routes: Routes = [
  { path: '', component: HomeComponent },
    { path: 'login', component: LoginComponent },
      { path: 'user', component: UserComponent },
      { path: 'chef', component: Chef },
      { path: '**', redirectTo: '' }

]
