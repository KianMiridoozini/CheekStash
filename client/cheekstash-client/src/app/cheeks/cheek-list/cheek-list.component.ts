import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, of } from 'rxjs'; // Removed Observable if not explicitly returned by a function here
import { map, takeUntil, tap, catchError, distinctUntilChanged } from 'rxjs/operators'; // Removed switchMap for now

import { LoadingIndicatorComponent } from '../../shared/components/loading-indicator/loading-indicator.component';
import { CheekSearchComponent, EmittedSearchCriteria, InitialSearchFilters } from '../cheek-search/cheek-search.component';
import { CheeksService } from '../cheeks.service';
import { AuthService } from '../../auth/auth.service';
import { Cheek, PaginatedCheeksResponse, CheekQueryParams } from '../../models/cheek.model';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-cheek-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LoadingIndicatorComponent,
    CheekSearchComponent,
    FormsModule
  ],
  templateUrl: './cheek-list.component.html',
  styleUrl: './cheek-list.component.css'
})
export class CheekListComponent implements OnInit, OnDestroy {
  cheeks: Cheek[] = [];
  isLoading: boolean = true;
  error: string | null = null;
  currentUserId: string | null = null;
  noCheeksFound: boolean = false;

  initialSearchFilters: InitialSearchFilters = {};
  currentSortBy: string = 'recent';

  // Pagination state
  currentPage: number = 1;
  readonly initialLoadCount: number = 9;
  readonly loadMoreCount: number = 6;
  totalCheeksFromServer: number = 0;
  allCheeksLoaded: boolean = false;
  private currentSearchCriteria: EmittedSearchCriteria | undefined;

  public readonly Math = Math;

  private queryParamsSubscription: Subscription | undefined;
  private destroy$ = new Subject<void>();

  constructor(
    private cheeksService: CheeksService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.isLoading = true;
    const currentUser = this.authService.currentUserSignal();
    if (currentUser) {
      this.currentUserId = currentUser.id;
    }

    this.queryParamsSubscription = this.route.queryParams.pipe(
      takeUntil(this.destroy$),
      map(params => {
        const parsedFilters: InitialSearchFilters = {};
        if (params['search']) {
          parsedFilters.searchKeyword = params['search'];
        }
        if (params['categoryNames']) {
          parsedFilters.categoryNames = Array.isArray(params['categoryNames']) ? params['categoryNames'] : params['categoryNames'].split(',');
        }
        if (params['tagNames']) {
          parsedFilters.tagNames = Array.isArray(params['tagNames']) ? params['tagNames'] : params['tagNames'].split(',');
        }
        const sortByFromUrl = params['sortBy'] || 'recent';
        return { filters: parsedFilters, sortBy: sortByFromUrl };
      }),
      // Prevent re-triggering if the initial name-based filters from URL haven't changed.
      distinctUntilChanged((prev, curr) => JSON.stringify(prev.filters) === JSON.stringify(curr.filters) && prev.sortBy === curr.sortBy),
    ).subscribe(({ filters, sortBy }) => {
      // Update properties that are @Input to CheekSearchComponent or used for sorting
      this.initialSearchFilters = filters; 
      this.currentSortBy = sortBy;
    });
  }

  ngOnDestroy(): void {
    if (this.queryParamsSubscription) {
      this.queryParamsSubscription.unsubscribe();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchFiltersChanged(criteria: EmittedSearchCriteria): void {
    // This method is called when CheekSearchComponent emits its processed criteria (with IDs)
    // console.log('onSearchFiltersChanged called with criteria:', JSON.stringify(criteria));
    // console.log('Current search criteria before potential update:', JSON.stringify(this.currentSearchCriteria));

    // Prevent reloading if the new criteria are identical to what was last used.
    if (this.currentSearchCriteria && JSON.stringify(this.currentSearchCriteria) === JSON.stringify(criteria)) {
      // console.log("onSearchFiltersChanged: Criteria haven't changed, not reloading.");
      return;
    }

    this.cheeks = [];
    this.allCheeksLoaded = false;
    this.totalCheeksFromServer = 0;
    this.currentSearchCriteria = criteria; // Update current criteria with the new one
    this.currentPage = 1; // Reset page
    this.loadCheeks(criteria, true);
  }

  loadCheeks(criteria: EmittedSearchCriteria, isNewSearch: boolean = false): void {
    // console.log('loadCheeks called. isLoading:', this.isLoading, 'isNewSearch:', isNewSearch, 'Criteria:', criteria);
    if (this.isLoading && !isNewSearch) {
        return;
    }
    this.isLoading = true;
    this.error = null;
    if (isNewSearch) {
        this.noCheeksFound = false;
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: this.buildNavQueryParams(criteria, this.currentSortBy), 
          replaceUrl: true
        });
    }

    let pageToRequest: number;
    let limitToRequest: number;

    if (isNewSearch) {
      pageToRequest = 1; // Always page 1 for a new search
      limitToRequest = this.initialLoadCount;
    } else {
      pageToRequest = Math.floor(this.cheeks.length / this.loadMoreCount) + 1;
      limitToRequest = this.loadMoreCount;
    }
    // console.log(`Requesting page: ${pageToRequest}, limit: ${limitToRequest}`);


    const serviceParams: CheekQueryParams = {
      searchKeyword: criteria.searchKeyword,
      categoryIds: criteria.categoryIds,
      tagIds: criteria.tagIds,
      page: pageToRequest,
      limit: limitToRequest,
    };

    this.cheeksService.getAllCheeksPaginated(serviceParams).pipe(
      takeUntil(this.destroy$),
      tap((paginatedResponse: PaginatedCheeksResponse | null) => {
        this.isLoading = false;
        if (paginatedResponse && paginatedResponse.cheeks) {
          let newCheeksReceived = paginatedResponse.cheeks;

          if (isNewSearch) {
            this.cheeks = newCheeksReceived;
          } else {
            const newCheeksToAdd = newCheeksReceived.filter(
              newCheek => !this.cheeks.some(existingCheek => existingCheek._id === newCheek._id)
            );
            this.cheeks = [...this.cheeks, ...newCheeksToAdd];
          }
          
          this.totalCheeksFromServer = paginatedResponse.totalItems;
          this.allCheeksLoaded = this.cheeks.length >= this.totalCheeksFromServer;
          this.noCheeksFound = this.cheeks.length === 0;

        } else {
          if (isNewSearch) {
            this.cheeks = [];
            this.noCheeksFound = true;
            this.totalCheeksFromServer = 0;
          }
          this.allCheeksLoaded = true;
        }
      }),
      catchError((err: any) => {
        this.isLoading = false;
        this.error = `Failed to load cheeks. ${err.message || 'Please try again later.'}`;
        console.error('Error loading cheeks:', err);
        if (isNewSearch) {
            this.cheeks = [];
            this.noCheeksFound = true;
            this.totalCheeksFromServer = 0; // Reset on error for new search
        }
        return of(null);
      })
    ).subscribe();
  }

  onLoadMore(): void {
    if (!this.allCheeksLoaded && !this.isLoading && this.currentSearchCriteria) {
      this.loadCheeks(this.currentSearchCriteria, false); // false for isNewSearch
    }
  }

  private buildNavQueryParams(criteria: EmittedSearchCriteria, sortBy: string): any {
    const navParams: any = {};
    if (criteria.searchKeyword) {
      navParams.search = criteria.searchKeyword;
    }

    // EmittedSearchCriteria should have categoryNames and tagNames if they were part of the search
    if (criteria.categoryNames && criteria.categoryNames.length > 0) {
      navParams.categoryNames = criteria.categoryNames.join(',');
    } 

    if (criteria.tagNames && criteria.tagNames.length > 0) {
      navParams.tagNames = criteria.tagNames.join(',');
    } else if (criteria.tagIds && criteria.tagIds.length > 0 && (!criteria.tagNames || criteria.tagNames.length === 0)) {
      // Fallback to tagIds in URL if tagNames are not available but tagIds are.
      // This might happen if filtering is initiated with IDs directly somehow.
      navParams.tagIds = criteria.tagIds.join(',');
    }

    if (sortBy && sortBy !== 'recent') {
      navParams.sortBy = sortBy;
    }

    // Clean up null/undefined query parameters before navigating
    Object.keys(navParams).forEach(key => {
      if (navParams[key] === null || navParams[key] === undefined || navParams[key] === '') {
        delete navParams[key];
      }
    });
    return navParams;
  }

  isUser(owner: User | string): owner is User {
    return typeof owner === 'object' && owner !== null && 'username' in owner;
  }

  getOwnerUsername(owner: User | string): string {
    if (this.isUser(owner)) {
      return owner.username;
    }
    return typeof owner === 'string' ? owner : 'N/A'; 
  }

  getOwnerId(owner: User | string): string {
    if (this.isUser(owner)) {
      return owner.id;
    }
    return owner;
  }

  onSortChange(event: Event): void {
    const newSortBy = (event.target as HTMLSelectElement).value;
    if (this.currentSortBy === newSortBy) {
      return;
    }
    this.currentSortBy = newSortBy;

    const currentRouterParams = { ...this.route.snapshot.queryParams };
    if (this.currentSortBy && this.currentSortBy !== 'recent') {
      currentRouterParams['sortBy'] = this.currentSortBy;
    } else {
      delete currentRouterParams['sortBy'];
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: currentRouterParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });

    this.applyClientSideSorting();
  }

  applyClientSideSorting(): void {
    if (!this.cheeks || this.cheeks.length === 0) {
      return;
    }

    const sortedCheeks = [...this.cheeks];

    const fallbackDateA = new Date(0); // Very old date

    switch (this.currentSortBy) {
      case 'recent':
        sortedCheeks.sort((a, b) =>
          new Date(b.createdAt || fallbackDateA).getTime() - new Date(a.createdAt || fallbackDateA).getTime()
        );
        break;
      case 'rating-desc':
        sortedCheeks.sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0));
        break;
      case 'rating-asc':
        sortedCheeks.sort((a, b) => (a.averageRating ?? 0) - (b.averageRating ?? 0));
        break;
      case 'alpha-asc':
        sortedCheeks.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'alpha-desc':
        sortedCheeks.sort((a, b) => b.title.localeCompare(a.title));
        break;
      default:
        // Default to recent if sortBy is unknown
        sortedCheeks.sort((a, b) =>
          new Date(b.createdAt || fallbackDateA).getTime() - new Date(a.createdAt || fallbackDateA).getTime()
        );
    }
    this.cheeks = sortedCheeks;
  }
}
