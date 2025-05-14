import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Cheek, CheekQueryParams, PaginatedCheeksResponse } from '../../models/cheek.model';
import { CheeksService } from '../cheeks.service';
import { AuthService } from '../../auth/auth.service';
import { TagsService } from '../../tags/tags.service';
import { Tag } from '../../models/tag.model';
import { User } from '../../models/user.model';
import { forkJoin, of, Observable, Subscription } from 'rxjs';
import { map, catchError, switchMap, takeUntil, tap } from 'rxjs/operators';
import { LoadingIndicatorComponent } from '../../shared/components/loading-indicator/loading-indicator.component';
import { CheekSearchComponent, InitialSearchFilters, EmittedSearchCriteria } from '../cheek-search/cheek-search.component';
import { FormsModule } from '@angular/forms';

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
  readonly initialLoadCount: number = 12;
  readonly loadMoreCount: number = 6;
  totalCheeksFromServer: number = 0;
  allCheeksLoaded: boolean = false;
  private currentSearchCriteria: EmittedSearchCriteria | undefined;

  public readonly Math = Math;

  private queryParamsSubscription: Subscription | undefined;
  private destroy$ = new Observable<void>();

  constructor(
    private cheeksService: CheeksService,
    private authService: AuthService,
    private tagsService: TagsService,
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
      map(params => {
        const parsedFilters: InitialSearchFilters = {};
        if (params['search']) {
          parsedFilters.searchKeyword = params['search'].replace(/-/g, ' ');
        }
        if (params['categoryNames']) {
          const categoryNamesFromUrl = Array.isArray(params['categoryNames']) ? params['categoryNames'] : params['categoryNames'].split(',');
          parsedFilters.categoryNames = categoryNamesFromUrl.map((name: string) => name.replace(/-/g, ' '));
        }
        if (params['tagNames']) {
          const tagNamesFromUrl = Array.isArray(params['tagNames']) ? params['tagNames'] : params['tagNames'].split(',');
          parsedFilters.tagNames = tagNamesFromUrl.map((name: string) => name.replace(/-/g, ' '));
        }
        const sortByFromUrl = params['sortBy'] || 'recent';
        return { filters: parsedFilters, sortBy: sortByFromUrl };
      })
    ).subscribe(({ filters, sortBy }) => {
      this.initialSearchFilters = filters;
      this.currentSortBy = sortBy;
    });
  }

  ngOnDestroy(): void {
    if (this.queryParamsSubscription) {
      this.queryParamsSubscription.unsubscribe();
    }
  }

  onSearchFiltersChanged(criteria: EmittedSearchCriteria): void {
    this.cheeks = [];
    this.allCheeksLoaded = false;
    this.totalCheeksFromServer = 0;
    this.currentSearchCriteria = criteria;
    this.loadCheeks(criteria, true);
  }

  loadCheeks(criteria: EmittedSearchCriteria, isNewSearch: boolean = false): void {
    this.isLoading = true;
    this.error = null;
    this.noCheeksFound = false; // Reset on new load

    let pageToRequest: number;
    let limitToRequest: number;

    if (isNewSearch) {
      this.currentPage = 1;
      pageToRequest = 1;
      limitToRequest = this.initialLoadCount;

      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: this.buildNavQueryParams(criteria, this.currentSortBy),
        queryParamsHandling: 'merge',
        replaceUrl: true
      });
    } else {
      pageToRequest = Math.floor(this.cheeks.length / this.loadMoreCount) + 1;
      limitToRequest = this.loadMoreCount;
    }

    const serviceParams: CheekQueryParams = {
      searchKeyword: criteria.searchKeyword,
      categoryIds: criteria.categoryIds,
      tagIds: criteria.tagIds,
      page: pageToRequest,
      limit: limitToRequest,
    };
    if (this.currentUserId) {
      serviceParams.requestingUserId = this.currentUserId;
    }

    this.cheeksService.getAllCheeksPaginated(serviceParams).pipe(
      takeUntil(this.destroy$),
      tap((paginatedResponse: PaginatedCheeksResponse | null) => { // Allow null for catchError
        if (!paginatedResponse) { // Handle case where catchError returned null
          this.isLoading = false;
          this.cheeks = [];
          this.totalCheeksFromServer = 0;
          this.allCheeksLoaded = true;
          this.noCheeksFound = true; // No response means no cheeks
          return;
        }

        this.totalCheeksFromServer = paginatedResponse.totalItems;

        if (isNewSearch && paginatedResponse.totalItems === 0) {
          this.noCheeksFound = true;
        }

        if (!paginatedResponse.cheeks || paginatedResponse.cheeks.length === 0) {
          this.allCheeksLoaded = true;
          if (isNewSearch) { // If it's a new search and no cheeks came back
            this.cheeks = [];
          } // Otherwise, if loading more and no new cheeks, just keep existing ones
          this.isLoading = false;
          return;
        }

        const cheeksWithTagsObservables = paginatedResponse.cheeks.map((cheek: Cheek) => {
          if (cheek.tagIds && cheek.tagIds.length > 0) {
            return forkJoin(
              (cheek.tagIds as string[]).map(tagId => this.tagsService.getTagById(tagId))
            ).pipe(
              map(tags => ({ ...cheek, tags: tags.filter(t => !!t) as Tag[] })),
              catchError(() => of({ ...cheek, tags: [] }))
            );
          } else {
            return of({ ...cheek, tags: [] });
          }
        });

        if (cheeksWithTagsObservables.length > 0) {
          forkJoin(cheeksWithTagsObservables).subscribe({
            next: (processedCheeks: Cheek[]) => {
              if (isNewSearch) {
                this.cheeks = processedCheeks;
              } else {
                this.cheeks = [...this.cheeks, ...processedCheeks];
              }
              this.allCheeksLoaded = this.cheeks.length >= this.totalCheeksFromServer;
              this.applyClientSideSorting();
              this.isLoading = false;
              this.noCheeksFound = this.cheeks.length === 0; // Update based on final list
            },
            error: (err: any) => {
              console.error('Error processing cheeks with tags:', err);
              this.isLoading = false;
            }
          });
        } else {
          if (isNewSearch) {
            this.cheeks = [];
          } else {
            this.cheeks = [...this.cheeks];
          }
          this.applyClientSideSorting();
          this.allCheeksLoaded = true; // Since no new cheeks were added
          this.isLoading = false;
          this.noCheeksFound = this.cheeks.length === 0; // Update based on final list
        }
      }),
      catchError((err: any) => {
        console.error('Error fetching cheeks:', err);
        this.isLoading = false;
        this.error = 'Failed to load cheeks. Please try again later.';
        this.cheeks = [];
        this.totalCheeksFromServer = 0;
        this.allCheeksLoaded = true;
        this.noCheeksFound = true; // Set to true on error as well
        return of(null); // Return of(null) to satisfy Observable<PaginatedCheeksResponse | null>
      })
    ).subscribe();
  }

  onLoadMore(): void {
    if (!this.allCheeksLoaded && !this.isLoading && this.currentSearchCriteria) {
      this.loadCheeks(this.currentSearchCriteria, false);
    }
  }

  private buildNavQueryParams(criteria: EmittedSearchCriteria, sortBy: string): any {
    const navParams: any = {};
    if (criteria.searchKeyword) {
      navParams.search = criteria.searchKeyword.replace(/\s+/g, '-');
    } else {
      navParams.search = null;
    }

    if (criteria.categoryNames && criteria.categoryNames.length > 0) {
      navParams.categoryNames = criteria.categoryNames.map((name: string) => name.replace(/\s+/g, '-')).join(',');
    } else {
      navParams.categoryNames = null;
    }

    if (criteria.tagNames && criteria.tagNames.length > 0) {
      navParams.tagNames = criteria.tagNames.map((name: string) => name.replace(/\s+/g, '-')).join(',');
    } else {
      navParams.tagNames = null;
    }

    if (sortBy && sortBy !== 'recent') {
      navParams.sortBy = sortBy;
    } else {
      navParams.sortBy = null;
    }
    return navParams;
  }

  private fetchTagsForCheek(cheek: Cheek): Observable<Cheek> {
    if (cheek.tagIds && cheek.tagIds.length > 0) {
      const tagObservables = cheek.tagIds.map(tagId =>
        this.tagsService.getTagById(tagId).pipe(
          catchError(err => {
            console.error(`Error fetching tag ${tagId} for cheek ${cheek.title || cheek._id}:`, err);
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
      cheek.tags = [];
      return of(cheek);
    }
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

    const fallbackDateA = new Date(0);
    const fallbackDateB = new Date();

    switch (this.currentSortBy) {
      case 'recent':
        sortedCheeks.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : fallbackDateA.getTime();
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : fallbackDateA.getTime();
          return dateB - dateA;
        });
        break;
      case 'rating-desc':
        sortedCheeks.sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0));
        break;
      case 'rating-asc':
        sortedCheeks.sort((a, b) => (a.averageRating ?? 0) - (b.averageRating ?? 0));
        break;
      case 'alpha-asc':
        sortedCheeks.sort((a, b) => 
          (a.title ?? '').toLowerCase().localeCompare((b.title ?? '').toLowerCase())
        );
        break;
      case 'alpha-desc':
        sortedCheeks.sort((a, b) => 
          (b.title ?? '').toLowerCase().localeCompare((a.title ?? '').toLowerCase())
        );
        break;
      default:
        sortedCheeks.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : fallbackDateA.getTime();
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : fallbackDateA.getTime();
          return dateB - dateA;
        });
        break;
    }
    this.cheeks = sortedCheeks;
  }
}
