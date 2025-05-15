import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Review, CreateReviewPayload, UpdateReviewPayload } from '../models/review.model';

@Injectable({
  providedIn: 'root'
})
export class ReviewsService {
  private apiUrl = `${environment.apiUrl}/reviews`;

  constructor(private http: HttpClient) { }

  getReviewsForCheek(cheekId: string): Observable<Review[]> {
    return this.http.get<Review[]>(`${this.apiUrl}/${cheekId}`);
  }

  getReviewById(reviewId: string): Observable<Review> {
    return this.http.get<Review>(`${this.apiUrl}/${reviewId}`);
  }

  getReviewsByUserId(userId: string): Observable<Review[]> {
    return this.http.get<Review[]>(`${this.apiUrl}/user/${userId}`);
  }

  createReview(payload: CreateReviewPayload): Observable<Review> {
    return this.http.post<Review>(this.apiUrl, payload);
  }

  updateReview(reviewId: string, payload: UpdateReviewPayload): Observable<Review> {
    return this.http.put<Review>(`${this.apiUrl}/${reviewId}`, payload);
  }

  deleteReview(reviewId: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${reviewId}`);
  }
}
