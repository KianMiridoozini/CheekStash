import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Cheek, CreateCheekPayload, UpdateCheekPayload } from '../models/cheek.model';

@Injectable({
  providedIn: 'root'
})
export class CheeksService {
  private apiUrl = `${environment.apiUrl}/cheeks`;

  constructor(private http: HttpClient) { }

  getAllCheeks(): Observable<Cheek[]> {
    return this.http.get<Cheek[]>(this.apiUrl);
  }

  getCheekByUsernameAndTitle(usernamePlusSlug: string): Observable<Cheek> {
    return this.http.get<Cheek>(`${this.apiUrl}/by/${usernamePlusSlug}`);
  }

  getCheekByUsernameAndSlug(username: string, cheekSlug: string): Observable<Cheek> {
    return this.http.get<Cheek>(`${this.apiUrl}/by/${username}/${cheekSlug}`);
  }

  getCheekById(id: string): Observable<Cheek> {
    return this.http.get<Cheek>(`${this.apiUrl}/${id}`);
  }

  createCheek(payload: CreateCheekPayload): Observable<Cheek> {
    return this.http.post<Cheek>(this.apiUrl, payload);
  }

  updateCheek(id: string, payload: UpdateCheekPayload): Observable<Cheek> {
    return this.http.patch<Cheek>(`${this.apiUrl}/${id}`, payload);
  }

  deleteCheek(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }

  getCheeksByUserId(userId: string): Observable<Cheek[]> {
    return this.http.get<Cheek[]>(`${this.apiUrl}/user/${userId}`);
  }

  updateCheekVisibility(cheekId: string, payload: { isPublic: boolean }): Observable<Cheek> {
    return this.http.patch<Cheek>(`${this.apiUrl}/${cheekId}/visibility`, payload);
  }

  getCheeksByCategoryId(categoryId: string): Observable<Cheek[]> {
    return this.http.get<Cheek[]>(`${this.apiUrl}/category/${categoryId}`);
  }

  getCheeksByTagName(tagName: string): Observable<Cheek[]> {
    return this.http.get<Cheek[]>(`${this.apiUrl}/tag/${tagName}`);
  }
}
