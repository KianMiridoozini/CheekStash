import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { RegisterPayload } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  register(userData: RegisterPayload): Observable<any> {
    return this.http.post(`${this.apiUrl}/users/register`, userData);
  }
}
