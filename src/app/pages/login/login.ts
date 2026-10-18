import { Component, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, NgOptimizedImage],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  username = '';
  password = '';

  message = '';
  loading = false;
  success = false;

  onSubmit(): void {
    this.message = '';
    this.success = false;

    if (!this.username.trim() || !this.password) {
      this.message = 'Veuillez remplir tous les champs.';
      return;
    }

    this.loading = true;

    this.authService.login({
      username: this.username.trim(),
      password: this.password
    }).subscribe({
      next: (response) => {
        // Sauvegarder les tokens reçus de Django
        localStorage.setItem('access_token', response.access);
        localStorage.setItem('refresh_token', response.refresh);

        // Récupérer les informations du compte depuis Django
        this.authService.getProfile().subscribe({
          next: (user) => {
            this.loading = false;

            switch (user.role) {
              case 'CHEF':
                this.router.navigate(['/chef']);
                break;

              case 'ASSOCIATION':
                this.router.navigate(['/association']);
                break;

              case 'CONSUMER':
                this.router.navigate(['/consommateur']);
                break;

              case 'ADMIN':
                this.router.navigate(['/admin']);
                break;

              default:
                this.message =
                  'Rôle du compte absent ou non reconnu.';
                break;
            }
          },

          error: (error) => {
            this.loading = false;
            this.message =
              'Impossible de récupérer le profil utilisateur.';

            console.error(
              'Erreur de récupération du profil :',
              error
            );
          }
        });
      },

      error: (error) => {
        this.loading = false;

        if (error.status === 0) {
          this.message =
            'Django est inaccessible. Vérifiez le serveur et CORS.';
        } else if (
          error.status === 400 ||
          error.status === 401
        ) {
          this.message =
            'Nom d’utilisateur ou mot de passe incorrect.';
        } else {
          this.message =
            `Erreur serveur (${error.status}). Vérifiez votre API.`;
        }

        console.error('Erreur de connexion :', error.error);
      }
    });
  }
}
