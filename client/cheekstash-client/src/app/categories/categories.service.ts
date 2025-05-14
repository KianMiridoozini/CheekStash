import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Category, CreateCategoryPayload, UpdateCategoryPayload } from '../models/category.model';

@Injectable({
    providedIn: 'root'
})
export class CategoriesService {
    private apiUrl = `${environment.apiUrl}/categories`;

    constructor(private http: HttpClient) { }

    getAllCategories(): Observable<Category[]> {
        return this.http.get<Category[]>(this.apiUrl);
    }

    getCategoryById(id: string): Observable<Category> {
        return this.http.get<Category>(`${this.apiUrl}/${id}`);
    }

    createCategory(payload: CreateCategoryPayload): Observable<Category> {
        return this.http.post<Category>(this.apiUrl, payload);
    }

    updateCategory(id: string, payload: UpdateCategoryPayload): Observable<Category> {
        return this.http.patch<Category>(`${this.apiUrl}/${id}`, payload);
    }

    deleteCategory(id: string): Observable<any> {
        return this.http.delete<any>(`${this.apiUrl}/${id}`);
    }
}
