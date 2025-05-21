import { Injectable, signal, WritableSignal, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ReplaySubject, Observable, of, throwError } from 'rxjs';
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
  private initialProfileLoadAttempted = new ReplaySubject<void>(1);
  initialProfileLoadAttempted$ = this.initialProfileLoadAttempted.asObservable();


  constructor(private http: HttpClient) {
    setTimeout(() => {
      if (this.isAuthenticated()) {
        this.fetchAndStoreUserProfile().subscribe({
          complete: () => {
            this.initialProfileLoadAttempted.next();
            this.initialProfileLoadAttempted.complete();
          },
          error: () => { // Also signal on error
            this.initialProfileLoadAttempted.next();
            this.initialProfileLoadAttempted.complete();
          }
        });
      } else {
        this.initialProfileLoadAttempted.next();
        this.initialProfileLoadAttempted.complete();
      }
    }, 0);

    effect(() => {
      // console.log('Current user from signal (AuthService effect):', this.currentUserSignal());
    });
  }

  login(credentials: LoginPayload): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, credentials).pipe(
      tap((res: LoginResponse) => {
        localStorage.setItem(this.tokenKey, res.token);
        localStorage.setItem(this.usernameKey, res.username);
        this.fetchAndStoreUserProfile().subscribe(); 
      }),
      catchError(err => {
        this.clearUserSession();
        return throwError(() => err);
      })
    );
  }

  private fetchAndStoreUserProfile(): Observable<User | null> {
    return this.http.get<User>(`${this.apiUrl}/auth/me`).pipe(
      tap((user) => {
        const userWithId = { ...user, id: user.id || (user as any)._id };
        this.currentUserSignal.set(userWithId);
      }),
      catchError(err => {
        console.error('Failed to fetch user profile:', err);
        if (err.status === 401) {
          this.clearUserSession();
        } else {
          this.currentUserSignal.set(null);
        }
        return of(null); 
      })
    );
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

  getCurrentUser(): Observable<User | null> {
    const currentUser = this.currentUserSignal();
    if (currentUser) {
      return of(currentUser);
    }
    if (this.isAuthenticated()) {
      return this.http.get<User>(`${this.apiUrl}/auth/me`).pipe(
        tap(user => {
          this.currentUserSignal.set(user);
        }),
        catchError(err => {
          this.clearUserSession();
          return throwError(() => new Error('Failed to fetch user profile'));
        })
      );
    }
    return of(null);
  }

  refreshUserProfile(): void {
    if (this.isAuthenticated()) {
      this.fetchAndStoreUserProfile().subscribe();
    }
  }

  changePassword(payload: ChangePasswordPayload): Observable<any> {
    return this.http.put(`${this.apiUrl}/auth/password`, payload);
  }

  deleteAccount(payload: ConfirmPasswordPayload): Observable<any> {
    return this.http.delete(`${this.apiUrl}/auth/account`, { body: payload });
  }
}
