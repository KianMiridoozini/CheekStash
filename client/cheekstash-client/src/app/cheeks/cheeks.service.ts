import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Cheek, CreateCheekPayload, UpdateCheekPayload, CheekQueryParams, PaginatedCheeksResponse } from '../models/cheek.model';

@Injectable({
  providedIn: 'root'
})
export class CheeksService {
  private apiUrl = `${environment.apiUrl}/cheeks`;

  constructor(private http: HttpClient) { }

  getAllCheeksPaginated(params: CheekQueryParams = {}): Observable<PaginatedCheeksResponse> {
    let httpParams = new HttpParams();
    if (params.searchKeyword) {
      httpParams = httpParams.set('searchKeyword', params.searchKeyword);
    }
    if (params.categoryIds && params.categoryIds.length > 0) {
      httpParams = httpParams.set('categoryIds', params.categoryIds.join(','));
    }
    if (params.tagIds && params.tagIds.length > 0) {
      httpParams = httpParams.set('tagIds', params.tagIds.join(','));
    }
    if (params.page) {
      httpParams = httpParams.set('page', params.page.toString());
    }
    if (params.limit) {
      httpParams = httpParams.set('limit', params.limit.toString());
    }

    return this.http.get<PaginatedCheeksResponse>(this.apiUrl, { params: httpParams });
  }

  getCheekSuggestions(keyword: string, limit: number = 5): Observable<Cheek[]> {
    let httpParams = new HttpParams();
    httpParams = httpParams.set('searchKeyword', keyword);
    httpParams = httpParams.set('limit', limit.toString());
    return this.http.get<Cheek[]>(`${this.apiUrl}/suggestions`, { params: httpParams });
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
