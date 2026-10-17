
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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

login(data: LoginData): Observable<any> {
  return this.http.post(
    `${this.apiUrl}/auth/login/`,
    data
  );
}

}
