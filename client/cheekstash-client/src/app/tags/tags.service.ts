import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Tag, CreateTagPayload } from '../models/tag.model';

@Injectable({
    providedIn: 'root'
})
export class TagsService {
    private apiUrl = `${environment.apiUrl}/tags`;

    constructor(private http: HttpClient) { }

    getAllTags(): Observable<Tag[]> {
        return this.http.get<Tag[]>(this.apiUrl);
    }

    getTagById(id: string): Observable<Tag> {
        return this.http.get<Tag>(`${this.apiUrl}/${id}`);
    }

    createTag(payload: CreateTagPayload): Observable<Tag> {
        return this.http.post<Tag>(this.apiUrl, payload);
    }

    deleteTag(id: string): Observable<any> {
        return this.http.delete<any>(`${this.apiUrl}/${id}`);
    }
}
