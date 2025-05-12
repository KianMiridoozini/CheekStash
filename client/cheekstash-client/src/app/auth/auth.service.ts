import { Injectable, signal, WritableSignal, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { LoginPayload } from '../models/auth.model';
import { ChangePasswordPayload, ConfirmPasswordPayload, User } from '../models/user.model';

export interface LoginResponse {
  token: string;
  username: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private tokenKey = 'token';
  private usernameKey = 'username';
  private userKey = 'currentUser';

  currentUserSignal: WritableSignal<User | null> = signal(null);

  constructor(private http: HttpClient) {
    const storedUser = localStorage.getItem(this.userKey);
    if (storedUser) {
      this.currentUserSignal.set(JSON.parse(storedUser));
    }

    effect(() => {
      const user = this.currentUserSignal();
      if (user) {
        localStorage.setItem(this.userKey, JSON.stringify(user));
      } else {
        localStorage.removeItem(this.userKey);
      }
    });
  }

  login(credentials: LoginPayload): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, credentials).pipe(
      tap((res: LoginResponse) => {
        localStorage.setItem(this.tokenKey, res.token);
        this.fetchAndStoreUserProfile();
      }),
      catchError(err => {
        console.error('Login failed', err);
        this.clearUserSession();
        return throwError(() => new Error(err.error?.message || 'Login failed'));
      })
    );
  }

  private fetchAndStoreUserProfile() {
    this.http.get<User>(`${this.apiUrl}/auth/me`).subscribe({
      next: (user) => {
        this.currentUserSignal.set(user);
        localStorage.setItem(this.usernameKey, user.username);
      },
      error: (err) => {
        console.error('Failed to fetch user profile', err);
        this.clearUserSession();
      }
    });
  }

  logout(): void {
    this.clearUserSession();
  }

  private clearUserSession(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.usernameKey);
    localStorage.removeItem(this.userKey);
    this.currentUserSignal.set(null);
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem(this.tokenKey);
  }

  getUsername(): string | null {
    const user = this.currentUserSignal();
    return user ? user.username : localStorage.getItem(this.usernameKey);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getCurrentUser(): Observable<User> {
    const currentUser = this.currentUserSignal();
    if (currentUser) {
      return of(currentUser);
    }
    const obs = this.http.get<User>(`${this.apiUrl}/auth/me`);
    obs.subscribe({
      next: (user) => this.currentUserSignal.set(user),
      error: () => this.currentUserSignal.set(null)
    });
    return obs;
  }

  refreshUserProfile(): void {
    if (this.isAuthenticated()) {
      this.fetchAndStoreUserProfile();
    }
  }

  changePassword(payload: ChangePasswordPayload): Observable<any> {
    return this.http.put(`${this.apiUrl}/auth/password`, payload);
  }

  deleteAccount(payload: ConfirmPasswordPayload): Observable<any> {
    return this.http.delete(`${this.apiUrl}/auth/account`, { body: payload });
  }
}
