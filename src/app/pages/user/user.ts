
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

type UserRole = 'CONSUMER' | 'CHEF' | 'ASSOCIATION';

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './user.html',
  styleUrl: './user.css'
})
export class UserComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  username = '';
  first_name = '';
  last_name = '';
  email = '';
  password = '';
  confirmPassword = '';

  role: UserRole = 'CONSUMER';

  message = '';
  success = false;
  loading = false;

  onSubmit(): void {
    this.message = '';
    this.success = false;

    if (this.password !== this.confirmPassword) {
      this.message = 'Les mots de passe ne correspondent pas.';
      return;
    }

    if (this.password.length < 8) {
      this.message = 'Le mot de passe doit contenir au moins 8 caractères.';
      return;
    }

    this.loading = true;

    this.authService.register({
      username: this.username.trim(),
      first_name: this.first_name.trim(),
      last_name: this.last_name.trim(),
      email: this.email.trim(),
      password: this.password,
      role: this.role
    }).subscribe({
      next: () => {
        this.success = true;
        this.message = 'Compte créé avec succès ! Redirection vers la connexion...';
        this.loading = false;

        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 1500);
      },
      error: (error) => {
        this.loading = false;

        if (error.status === 0) {
          this.message =
            'Impossible de contacter Django. Vérifiez le serveur et la configuration CORS.';
        } else if (error.status === 400 && error.error) {
          this.message = Object.entries(error.error)
            .map(([field, value]) => {
              const detail = Array.isArray(value)
                ? value.join(', ')
                : typeof value === 'string'
                  ? value
                  : JSON.stringify(value);

              return `${field} : ${detail}`;
            })
            .join(' | ');
        } else {
          this.message = `Erreur serveur (${error.status}). Veuillez réessayer.`;
        }

        console.error('Erreur API Django :', error);
      }
    });
  }
}
