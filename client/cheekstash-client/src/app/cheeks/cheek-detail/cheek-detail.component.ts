import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core'; // Import ViewChild
import { ActivatedRoute, RouterLink, Router, ParamMap } from '@angular/router'; // Import ParamMap
import { CommonModule } from '@angular/common';
import { Subscription, switchMap, forkJoin, of, Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { CheeksService } from '../cheeks.service';
import { Cheek } from '../../models/cheek.model';
import { Tag } from '../../models/tag.model';
import { UsersService } from '../../users/users.service';
import { TagsService } from '../../tags/tags.service';
import { LoadingIndicatorComponent } from '../../shared/components/loading-indicator/loading-indicator.component';
import { AuthService } from '../../auth/auth.service';
import { User } from '../../models/user.model';
import { ReviewListComponent } from '../../reviews/review-list/review-list.component';
import { ReviewFormComponent } from '../../reviews/review-form/review-form.component';
import { Review } from '../../models/review.model';

@Component({
  selector: 'app-cheek-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, LoadingIndicatorComponent, ReviewListComponent, ReviewFormComponent],
  templateUrl: './cheek-detail.component.html',
  styleUrls: ['./cheek-detail.component.css']
})
export class CheekDetailComponent implements OnInit, OnDestroy {
  @ViewChild(ReviewListComponent) reviewListComponentRef!: ReviewListComponent;

  cheek: Cheek | null = null;
  ownerUsername: string = 'Loading...';
  isOwnerUsernameLinkable: boolean = false;
  routeUsername: string | null = null;
  isLoading: boolean = true;
  error: string | null = null;
  isOwner: boolean = false;
  showDeleteConfirmation: boolean = false;
  canAddReview: boolean = false; // Will be determined by login status and whether user has already reviewed
  showAddReviewForm: boolean = false;
  hasUserReviewedThisCheek: boolean = false; // New property
  private routeSub: Subscription | undefined;
  currentUser: User | null = null;

  constructor(
    private route: ActivatedRoute,
    private cheeksService: CheeksService,
    private usersService: UsersService,
    private tagsService: TagsService,
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.isLoading = true;
    this.currentUser = this.authService.currentUserSignal();

    this.routeSub = this.route.paramMap.pipe(
      switchMap(params => this.loadCheekDetails(params))
    ).subscribe({
      next: (processedCheek) => {
        // isLoading is set within processCheekData or handleLoadingError
        if (this.cheek || this.error) {
          this.isLoading = false;
        } else if (!processedCheek) {
          this.isLoading = false;
        }
        this.updateCanAddReviewStatus();
      },
      error: (err) => {
        console.error('Error in route parameter subscription:', err);
        this.error = 'Failed to read route parameters.';
        this.isLoading = false;
      }
    });
  }

  private loadCheekDetails(params: ParamMap): Observable<Cheek | null> {
    const usernameFromRoute = params.get('username');
    const cheekSlug = params.get('cheekSlug');

    if (!usernameFromRoute || !cheekSlug) {
      this.error = 'Cheek identifier (username and slug) not found in route.';
      this.isLoading = false;
      this.ownerUsername = 'N/A';
      this.isOwnerUsernameLinkable = false;
      this.canAddReview = false;
      return of(null);
    }

    this.routeUsername = usernameFromRoute;
    this.cheek = null;
    this.error = null;
    this.isLoading = true;
    this.ownerUsername = 'Loading...';
    this.isOwnerUsernameLinkable = false;

    return this.cheeksService.getCheekByUsernameAndSlug(usernameFromRoute, cheekSlug).pipe(
      switchMap(cheekData => this.processCheekData(cheekData)),
      catchError(err => this.handleLoadingError(err))
    );
  }

  private processCheekData(cheekData: Cheek | null): Observable<Cheek | null> {
    if (!cheekData) {
      this.error = 'Cheek not found.';
      this.isLoading = false;
      this.ownerUsername = 'N/A';
      this.isOwnerUsernameLinkable = false;
      this.hasUserReviewedThisCheek = false;
      this.updateCanAddReviewStatus();
      return of(null);
    }

    this.cheek = cheekData;
    // Fetch and assign tags if only tagIds are present
    return this.fetchAndAssignTags(this.cheek).pipe(
      map(cheekWithTags => {
        this.cheek = cheekWithTags; // Update the component's cheek property
        this.checkIfOwner();
        this.determineOwnerDisplayDetails(this.cheek);
        this.updateCanAddReviewStatus();
        this.isLoading = false; // Set loading to false after all processing
        return this.cheek;
      }),
      catchError(err => {
        // Handle error from fetchAndAssignTags if necessary, or let global handler catch it
        console.error('Error processing cheek data after fetching tags:', err);
        this.error = 'Failed to process cheek details.';
        this.isLoading = false;
        return of(null);
      })
    );
  }

  private fetchAndAssignTags(cheek: Cheek): Observable<Cheek> {
    if (cheek.tagIds && cheek.tagIds.length > 0 && (!cheek.tags || cheek.tags.length === 0)) {
      const tagObservables = cheek.tagIds.map(tagId =>
        this.tagsService.getTagById(tagId).pipe(
          catchError(err => {
            console.error(`Error fetching tag ${tagId}:`, err);
            return of(null);
          })
        )
      );
      return forkJoin(tagObservables).pipe(
        map(tags => {
          cheek.tags = tags.filter(tag => tag !== null) as Tag[];
          return cheek;
        })
      );
    } else {
      cheek.tags = cheek.tags || []; // Ensure tags is an array even if no tagIds or already populated
      return of(cheek);
    }
  }

  private determineOwnerDisplayDetails(cheek: Cheek): void {
    if (cheek.owner && typeof cheek.owner === 'object' && (cheek.owner as User).username) {
      this.ownerUsername = (cheek.owner as User).username;
      this.isOwnerUsernameLinkable = true;
    } else if (this.routeUsername) {
      this.ownerUsername = this.routeUsername;
      this.isOwnerUsernameLinkable = true;
    } else if (cheek.owner && typeof cheek.owner === 'string') {
      this.ownerUsername = `User ID: ${cheek.owner}`;
      this.isOwnerUsernameLinkable = false;
    } else {
      this.ownerUsername = 'Unknown User';
      this.isOwnerUsernameLinkable = false;
    }
  }

  private handleLoadingError(err: any): Observable<null> {
    console.error('Error fetching cheek details or related data:', err);
    this.error = `Failed to load cheek: ${err.error?.message || err.message || 'Server error'}`;
    this.isLoading = false;
    this.ownerUsername = 'N/A';
    this.isOwnerUsernameLinkable = false;
    this.canAddReview = false;
    return of(null);
  }

  handleUserHasReviewed(hasReviewed: boolean): void {
    this.hasUserReviewedThisCheek = hasReviewed;
    this.updateCanAddReviewStatus();
  }

  private updateCanAddReviewStatus(): void {
    this.canAddReview = !!this.currentUser && !!this.cheek && !this.hasUserReviewedThisCheek;
  }

  toggleAddReviewForm(): void {
    this.showAddReviewForm = !this.showAddReviewForm;
  }

  handleReviewSubmitted(review: Review): void {
    console.log('Review submitted in detail component:', review);
    this.showAddReviewForm = false;
    // Refresh the review list, which in turn will emit 'userHasReviewed'
    // and update 'canAddReview' status via handleUserHasReviewed.
    if (this.reviewListComponentRef) {
      this.reviewListComponentRef.refreshReviews();
    }
  }

  handleReviewFormClosed(): void {
    this.showAddReviewForm = false;
  }

  handleReviewUpdated(review: Review): void {
    console.log('Review updated in detail component:', review);
  }

  handleReviewDeleted(reviewId: string): void {
    console.log('Review deleted in detail component, ID:', reviewId);
  }

  confirmDeleteCheek(): void {
    if (!this.cheek || !this.cheek._id) {
      console.error('Cheek data is missing, cannot initiate delete confirmation.');
      this.error = 'Could not initiate delete: data missing.';
      return;
    }
    this.showDeleteConfirmation = true;
  }

  proceedWithDelete(): void {
    if (!this.cheek || !this.cheek._id) {
      console.error('Cheek data is missing, cannot delete.');
      this.error = 'Could not delete cheek: data missing.';
      this.showDeleteConfirmation = false;
      return;
    }

    this.isLoading = true;
    this.error = null;
    this.cheeksService.deleteCheek(this.cheek._id).subscribe({
      next: () => {
        this.isLoading = false;
        this.showDeleteConfirmation = false;
        this.router.navigate(['/cheeks']);
      },
      error: (err) => {
        this.isLoading = false;
        this.showDeleteConfirmation = false;
        this.error = `Failed to delete cheek: ${err.error?.message || err.message || 'Server error'}`;
        console.error('Error deleting cheek:', err);
      }
    });
  }

  cancelDelete(): void {
    this.showDeleteConfirmation = false;
  }

  private checkIfOwner(): void {
    if (!this.currentUser || !this.cheek || !this.cheek.owner) {
      this.isOwner = false;
      return;
    }

    const currentAuthUserId = this.currentUser.id;
    let ownerIdToCompare: string | undefined = undefined;

    if (typeof this.cheek.owner === 'object' && this.cheek.owner !== null) {
      ownerIdToCompare = (this.cheek.owner as User).id || (this.cheek.owner as any)._id;
    } else if (typeof this.cheek.owner === 'string') {
      ownerIdToCompare = this.cheek.owner;
    }

    if (ownerIdToCompare) {
      this.isOwner = currentAuthUserId === ownerIdToCompare;
    } else {
      this.isOwner = false;
    }
  }

  ngOnDestroy(): void {
    if (this.routeSub) {
      this.routeSub.unsubscribe();
    }
  }

  public formatLinkUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `https://${url}`;
  }
}
