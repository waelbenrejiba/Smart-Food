
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { HttpHeaders } from '@angular/common/http';
export interface LoginData {
  username: string;
  password: string;
}
export interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    role: 'ADMIN' | 'CHEF' | 'ASSOCIATION' | 'CONSUMER';
  };
}
export interface LoginResponse {
  access: string;
  refresh: string;
}
export interface RegisterData {
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: 'CONSUMER' | 'CHEF' | 'ASSOCIATION';
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);

  private apiUrl = 'http://127.0.0.1:8000/api';

  register(data: RegisterData): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/users/register/`,
      data
    );
  }
login(credentials: {
  username: string;
  password: string;
}) {
  return this.http.post<LoginResponse>(
    `${this.apiUrl}/auth/login/`,
    credentials
  );
}
getProfile() {
  const token = localStorage.getItem('access_token');

  const headers = new HttpHeaders({
    Authorization: `Bearer ${token}`
  });

  return this.http.get<any>(
    `${this.apiUrl}/users/me/`,
    { headers }
  );
}

logout(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}
}
