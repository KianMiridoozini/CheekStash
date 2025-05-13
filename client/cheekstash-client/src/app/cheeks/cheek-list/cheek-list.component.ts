import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Cheek } from '../../models/cheek.model';
import { CheeksService } from '../cheeks.service';
import { AuthService } from '../../auth/auth.service';
import { User } from '../../models/user.model'; // Import User model
import { TagsService } from '../../tags/tags.service'; // Added
import { Tag } from '../../models/tag.model'; // Added
import { forkJoin, of, Observable } from 'rxjs'; // Added
import { map, catchError, switchMap } from 'rxjs/operators'; // Added switchMap
import { LoadingIndicatorComponent } from '../../shared/components/loading-indicator/loading-indicator.component'; // Added

@Component({
  selector: 'app-cheek-list',
  standalone: true,
  imports: [CommonModule, RouterModule, LoadingIndicatorComponent], // Added LoadingIndicatorComponent
  templateUrl: './cheek-list.component.html',
  styleUrl: './cheek-list.component.css'
})
export class CheekListComponent implements OnInit {
  cheeks: Cheek[] = [];
  isLoading: boolean = true;
  error: string | null = null;
  currentUserId: string | null = null;

  constructor(
    private cheeksService: CheeksService,
    private authService: AuthService,
    private tagsService: TagsService // Added
  ) {}

  ngOnInit(): void {
    const currentUser = this.authService.currentUserSignal();
    if (currentUser) {
      this.currentUserId = currentUser.id; 
    }
    this.loadCheeks();
  }

  loadCheeks(): void {
    this.isLoading = true;
    this.error = null;

    this.cheeksService.getAllCheeks().pipe(
      switchMap(cheeksData => {
        if (!cheeksData || cheeksData.length === 0) {
          return of([]); 
        }
        // For each cheek, create an observable that fetches its tags
        const cheeksWithTagsObservables = cheeksData.map(cheek =>
          this.fetchTagsForCheek(cheek)
        );
        return forkJoin(cheeksWithTagsObservables); // Execute all tag-fetching observables
      }),
      catchError(err => {
        console.error('Error fetching cheeks or their tags:', err);
        this.error = 'Failed to load cheeks data. Please try again later.';
        this.isLoading = false;
        return of([]); // Return an empty array on error to prevent further processing issues
      })
    ).subscribe({
      next: (processedCheeks) => {
        this.cheeks = processedCheeks;
        this.isLoading = false;
      },
      // The main error handling is now in the catchError operator above
      // but we can keep a final error handler here if needed for the subscription itself.
      error: (err) => {
        // This error handler would catch errors not caught by the catchError in the pipe,
        // or errors that occur during the final processing in the `next` callback.
        console.error('Unhandled error in loadCheeks subscription:', err);
        this.error = this.error || 'An unexpected error occurred.'; // Preserve earlier error if set
        this.isLoading = false;
        this.cheeks = []; // Clear cheeks on final error
      }
    });
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
      cheek.tags = []; // Ensure tags property exists even if no tagIds
      return of(cheek); 
    }
  }

  // Type guard function to check if a value is a User object
  isUser(owner: any): owner is User {
    return !!owner && typeof owner === 'object' && 'username' in owner;
  }

  // Helper method to safely get owner's username
  getOwnerUsername(owner: any): string {
    if (this.isUser(owner)) {
      return owner.username;
    }
    return typeof owner === 'string' ? owner : 'Unknown';
  }

  // Helper method to safely get owner's ID
  getOwnerId(owner: any): string {
    if (this.isUser(owner)) {
      return owner.id;
    }
    return typeof owner === 'string' ? owner : '';
  }
}
