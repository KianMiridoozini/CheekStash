import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReviewsService } from '../reviews.service';
import { CreateReviewPayload, Review, UpdateReviewPayload } from '../../models/review.model';
import { AuthService } from '../../auth/auth.service';
import { User } from '../../models/user.model';
import { LoadingIndicatorComponent } from '../../shared/components/loading-indicator/loading-indicator.component';
import { RouterLink } from '@angular/router'; // Added RouterLink for potential future use

@Component({
  selector: 'app-review-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LoadingIndicatorComponent],
  templateUrl: './review-form.component.html',
  styleUrls: ['./review-form.component.css']
})
export class ReviewFormComponent implements OnInit {
  @Input() cheekId!: string;
  @Input() existingReview: Review | null = null; // For editing
  @Output() reviewSubmitted = new EventEmitter<Review>();
  @Output() reviewUpdated = new EventEmitter<Review>();
  @Output() closeForm = new EventEmitter<void>(); // To close form, e.g., after editing

  reviewForm!: FormGroup;
  isLoading: boolean = false;
  error: string | null = null;
  submitted: boolean = false;
  currentUser: User | null = null;

  stars: number[] = [1, 2, 3, 4, 5];
  hoveredStar: number = 0;
  selectedStar: number = 0;

  get isEditMode(): boolean {
    return !!this.existingReview;
  }

  constructor(
    private fb: FormBuilder,
    private reviewsService: ReviewsService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.currentUserSignal();

    this.reviewForm = this.fb.group({
      rating: [null, Validators.required],
      reviewText: ['', Validators.maxLength(2000)] // 'review' is the form control name for the text
    });

    if (this.isEditMode && this.existingReview) {
      this.selectedStar = this.existingReview.rating;
      this.reviewForm.patchValue({
        rating: this.existingReview.rating,
        reviewText: this.existingReview.review || ''
      });
    }
  }

  setRating(rating: number): void {
    if (this.isLoading) return;
    this.selectedStar = rating;
    this.reviewForm.get('rating')?.setValue(rating);
    this.reviewForm.get('rating')?.markAsDirty();
    this.reviewForm.get('rating')?.updateValueAndValidity(); // Ensure validation status is updated
  }

  setHoveredStar(star: number): void {
    if (this.isLoading) return;
    this.hoveredStar = star;
  }

  clearHoveredStar(): void {
    if (this.isLoading) return;
    this.hoveredStar = 0;
  }

  onCloseForm(): void {
    this.closeForm.emit();
  }

  onSubmit(): void {
    this.submitted = true;
    this.error = null;

    if (!this.currentUser) {
      this.error = 'You must be logged in to submit a review.';
      return;
    }

    if (this.reviewForm.invalid) {
      this.reviewForm.markAllAsTouched();
      this.error = "Please provide a rating.";
      if (this.reviewForm.get('reviewText')?.errors?.['maxlength']) {
        this.error = "Review text is too long."
      }
      return;
    }

    this.isLoading = true;
    const formValue = this.reviewForm.value;

    if (this.isEditMode && this.existingReview?._id) {
      this._handleUpdateReview(formValue);
    } else {
      this._handleCreateReview(formValue);
    }
  }

  private _handleUpdateReview(formValue: any): void {
    if (!this.existingReview?._id) return;

    const payload: UpdateReviewPayload = {
      rating: formValue.rating,
      review: formValue.reviewText || undefined
    };
    this.reviewsService.updateReview(this.existingReview._id, payload).subscribe({
      next: (updatedReview) => {
        this.isLoading = false;
        this.submitted = false;
        this.reviewUpdated.emit(updatedReview);
      },
      error: (err) => {
        this.isLoading = false;
        this.error = err.error?.message || 'Failed to update review. Please try again.';
        console.error('Error updating review:', err);
      }
    });
  }

  private _handleCreateReview(formValue: any): void {
    const payload: CreateReviewPayload = {
      cheekId: this.cheekId,
      rating: formValue.rating,
      review: formValue.reviewText || undefined
    };
    this.reviewsService.createReview(payload).subscribe({
      next: (newReview) => {
        this.isLoading = false;
        this.submitted = false;
        this.reviewSubmitted.emit(newReview);
        this.reviewForm.reset({ rating: null, reviewText: '' });
        this.selectedStar = 0;
        this.reviewForm.get('rating')?.updateValueAndValidity();
      },
      error: (err) => {
        this.isLoading = false;
        this.error = err.error?.message || 'Failed to submit review. Please try again.';
        console.error('Error creating review:', err);
      }
    });
  }

  cancelEdit(): void {
    this.closeForm.emit();
  }
}
