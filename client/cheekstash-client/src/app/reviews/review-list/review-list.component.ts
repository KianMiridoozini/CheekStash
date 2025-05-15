import { Component, Input, OnInit, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReviewsService } from '../reviews.service';
import { Review } from '../../models/review.model';
import { AuthService } from '../../auth/auth.service';
import { User } from '../../models/user.model';
import { LoadingIndicatorComponent } from '../../shared/components/loading-indicator/loading-indicator.component';
import { ReviewFormComponent } from '../review-form/review-form.component'; // For editing
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-review-list',
  standalone: true,
  imports: [CommonModule, RouterLink, LoadingIndicatorComponent, ReviewFormComponent],
  templateUrl: './review-list.component.html',
  styleUrls: ['./review-list.component.css']
})
export class ReviewListComponent implements OnInit, OnChanges {
  @Input() cheekId!: string;
  @Input() initialReviews: Review[] | null = null;
  @Output() reviewDeleted = new EventEmitter<string>();
  @Output() reviewUpdated = new EventEmitter<Review>();
  @Output() userHasReviewed = new EventEmitter<boolean>();

  allFetchedReviews: Review[] = [];
  displayedReviews: Review[] = [];
  isLoading: boolean = false;
  error: string | null = null;
  currentUser: User | null = null;

  editingReview: Review | null = null;
  showDeleteConfirmation: boolean = false;
  reviewToDelete: Review | null = null;

  reviewBreakdown: { [key: number]: number } = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  totalReviews: number = 0;
  selectedStarFilter: number | null | undefined = undefined; // undefined: no filter active, null: "All" filter

  reviewsPerPage: number = 5;
  currentPage: number = 1;

  constructor(
    private reviewsService: ReviewsService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.currentUserSignal();
    if (this.initialReviews) {
      this.processInitialReviews(this.initialReviews);
      this.isLoading = false;
    } else if (this.cheekId) {
      this.fetchReviews();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['cheekId'] && !changes['cheekId'].firstChange) {
      if (this.cheekId) {
        this.fetchReviews();
      } else {
        this.allFetchedReviews = [];
        this.displayedReviews = [];
        this.resetReviewStatsAndState();
        this.userHasReviewed.emit(false);
      }
    }
    if (changes['initialReviews'] && this.initialReviews) {
        this.processInitialReviews(this.initialReviews);
    }
  }

  private processInitialReviews(reviewsData: Review[]): void {
    this.allFetchedReviews = this.sortReviews(reviewsData);
    this.calculateReviewBreakdown();
    this.checkCurrentUserReviewStatus();
    this.displayedReviews = [];
    this.selectedStarFilter = undefined;
    this.currentPage = 1;
  }

  fetchReviews(): void {
    if (!this.cheekId) {
      this.allFetchedReviews = [];
      this.displayedReviews = [];
      this.resetReviewStatsAndState();
      this.userHasReviewed.emit(false);
      return;
    }
    this.isLoading = true;
    this.error = null;
    this.editingReview = null;

    this.reviewsService.getReviewsForCheek(this.cheekId).subscribe({
      next: (data) => { 
        this.allFetchedReviews = this.sortReviews((data as any).reviews);
        this.calculateReviewBreakdown();
        this.checkCurrentUserReviewStatus();
        this.displayedReviews = [];
        this.selectedStarFilter = undefined;
        this.currentPage = 1;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching reviews:', err);
        this.error = 'Failed to load reviews. Please try again later.';
        this.isLoading = false;
        this.resetReviewStatsAndState();
        this.userHasReviewed.emit(false);
      }
    });
  }

  private resetReviewStatsAndState(): void {
    this.reviewBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    this.totalReviews = 0;
    this.selectedStarFilter = undefined; // Reset to undefined
    this.displayedReviews = [];
    this.currentPage = 1;
  }

  private checkCurrentUserReviewStatus(): void {
    let foundUserReview = false;
    if (this.currentUser && this.allFetchedReviews && this.allFetchedReviews.length > 0) {
      foundUserReview = this.allFetchedReviews.some(review => review.user && typeof review.user === 'object' && review.user._id === this.currentUser!.id);
    }
    this.userHasReviewed.emit(foundUserReview);
  }

  public refreshReviews(): void {
    if (this.cheekId) {
      this.fetchReviews();
    }
  }

  sortReviews(reviews: Review[]): Review[] {
    return reviews.sort((a, b) => {
      // Prioritize current user's review
      if (this.currentUser) {
        const aIsCurrentUser = a.user && typeof a.user === 'object' && a.user._id === this.currentUser.id;
        const bIsCurrentUser = b.user && typeof b.user === 'object' && b.user._id === this.currentUser.id;
        if (aIsCurrentUser && !bIsCurrentUser) {
          return -1; // a comes first
        }
        if (!aIsCurrentUser && bIsCurrentUser) {
          return 1; // b comes first
        }
      }
      // Then sort by creation date (newest first)
      return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
    });
  }

  private calculateReviewBreakdown(): void {
    this.reviewBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    this.totalReviews = this.allFetchedReviews.length;
    this.allFetchedReviews.forEach(review => {
      if (review.rating >= 1 && review.rating <= 5) {
        this.reviewBreakdown[review.rating]++;
      }
    });
  }

  filterByStar(star: number | null): void {
    this.selectedStarFilter = star;
    this.currentPage = 1;
    this.updateDisplayedReviews();
  }

  private updateDisplayedReviews(): void {
    if (this.selectedStarFilter === undefined) {
      this.displayedReviews = [];
      return;
    }

    let reviewsToDisplay: Review[];
    if (this.selectedStarFilter === null) {
      reviewsToDisplay = [...this.allFetchedReviews];
    } else {
      reviewsToDisplay = this.allFetchedReviews.filter(review => review.rating === this.selectedStarFilter);
    }
    
    const startIndex = 0; 
    const endIndex = this.currentPage * this.reviewsPerPage;
    this.displayedReviews = reviewsToDisplay.slice(startIndex, endIndex);
  }

  loadMoreReviews(): void {
    if (this.canLoadMore) {
      this.currentPage++;
      this.updateDisplayedReviews();
    }
  }

  get canLoadMore(): boolean {
    if (this.selectedStarFilter === undefined || this.displayedReviews.length === 0) {
      return false; // Don't show if no filter active or no reviews displayed yet for the current filter
    }
    
    let totalFilterMatches: number;
    if (this.selectedStarFilter === null) {
      totalFilterMatches = this.allFetchedReviews.length;
    } else {
      totalFilterMatches = this.allFetchedReviews.filter(review => review.rating === this.selectedStarFilter).length;
    }
    return this.displayedReviews.length < totalFilterMatches;
  }
  
  getStarPercentage(star: number): number {
    if (this.totalReviews === 0) {
      return 0;
    }
    return (this.reviewBreakdown[star] / this.totalReviews) * 100;
  }

  isCurrentUserReviewOwner(review: Review): boolean {
    return !!(this.currentUser && review.user && typeof review.user === 'object' && this.currentUser.id === review.user._id);
  }

  startEditReview(review: Review): void {
    this.editingReview = { ...review };
  }

  cancelEditReview(): void {
    this.editingReview = null;
  }

  handleReviewUpdated(updatedReview: Review): void {
    const index = this.allFetchedReviews.findIndex(r => r._id === updatedReview._id);
    if (index !== -1) {
      this.allFetchedReviews[index] = updatedReview;
      this.allFetchedReviews = this.sortReviews([...this.allFetchedReviews]); // Re-sort all reviews
    }
    this.calculateReviewBreakdown(); // Recalculate breakdown
    // If a filter is active, update displayed reviews, otherwise they'll see it when they next filter
    if (this.selectedStarFilter !== undefined) {
        this.updateDisplayedReviews(); 
    }
    this.reviewUpdated.emit(updatedReview);
    this.editingReview = null;
  }

  confirmDeleteReview(review: Review): void {
    this.reviewToDelete = review;
    this.showDeleteConfirmation = true;
  }

  cancelDelete(): void {
    this.reviewToDelete = null;
    this.showDeleteConfirmation = false;
  }

  proceedWithDelete(): void {
    if (!this.reviewToDelete) return;

    this.isLoading = true;
    this.reviewsService.deleteReview(this.reviewToDelete._id).subscribe({
      next: () => {
        this.allFetchedReviews = this.allFetchedReviews.filter(r => r._id !== this.reviewToDelete!._id);
        this.allFetchedReviews = this.sortReviews(this.allFetchedReviews); 
        
        this.calculateReviewBreakdown();
        this.checkCurrentUserReviewStatus();

        // If a filter is active, update displayed reviews
        if (this.selectedStarFilter !== undefined) {
            this.updateDisplayedReviews();
        } else {
            // If no filter was active, and the deleted review was the only one, displayedReviews might be empty.
            // This is fine as the user needs to click a filter to see reviews.
        }

        this.reviewDeleted.emit(this.reviewToDelete!._id);
        this.reviewToDelete = null;
        this.showDeleteConfirmation = false;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error deleting review:', err);
        this.error = err.error?.message || 'Failed to delete review.';
        this.reviewToDelete = null;
        this.showDeleteConfirmation = false;
        this.isLoading = false;
      }
    });
  }
}
