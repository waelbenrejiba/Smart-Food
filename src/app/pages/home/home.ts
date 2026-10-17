import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class HomeComponent {
  constructor(private router: Router) {}

  goToLogin(): void {
    console.log('Clic sur Se Connecter');
    this.router.navigate(['/login']);
  }
}