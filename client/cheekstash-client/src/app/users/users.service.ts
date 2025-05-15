import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { RegisterPayload } from '../models/auth.model';
import { User, UpdateUserProfilePayload } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  register(userData: RegisterPayload): Observable<any> {
    return this.http.post(`${this.apiUrl}/users/register`, userData);
  }
  getUserById(id: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/${id}`);
  }

  getUserByUsername(username: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/by-username/${username}`);
  }

  // getProfile(): Observable<User> {
  //   return this.http.get<User>(`${this.apiUrl}/users/profile`);
  // }

  updateUserProfile(payload: UpdateUserProfilePayload): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/users/profile`, payload).pipe(
      catchError(err => {
        console.error('Failed to update user profile', err);
        return throwError(() => new Error(err.error?.message || 'Failed to update user profile'));
      })
    );
  }

  uploadProfileImage(file: File): Observable<User> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.http.patch<User>(`${this.apiUrl}/users/avatar`, formData).pipe(
      catchError(err => {
        console.error('Failed to upload profile image', err);
        return throwError(() => new Error(err.error?.message || 'Failed to upload profile image'));
      })
    );
  }

  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/users`).pipe(
      catchError(err => {
        console.error('Failed to fetch all users', err);
        return throwError(() => new Error(err.error?.message || 'Failed to fetch users'));
      })
    );
  }

  // Method for admin to delete a user
  adminDeleteUser(userId: string): Observable<any> { // Or specific response type e.g., { message: string }
    return this.http.delete(`${this.apiUrl}/users/admin/${userId}`).pipe(
      catchError(err => {
        console.error(`Failed to delete user ${userId} by admin`, err);
        return throwError(() => new Error(err.error?.message || 'Failed to delete user'));
      })
    );
  }

  // Method for admin to update a user's role
  adminUpdateUserRole(userId: string, role: 'user' | 'admin'): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/users/admin/${userId}/role`, { role }).pipe(
      catchError(err => {
        console.error(`Failed to update role for user ${userId} by admin`, err);
        return throwError(() => new Error(err.error?.message || 'Failed to update user role'));
      })
    );
  }
}
