import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Cheek } from '../../models/cheek.model';
import { CheeksService } from '../cheeks.service';
import { AuthService } from '../../auth/auth.service';
import { User } from '../../models/user.model';
import { TagsService } from '../../tags/tags.service';
import { Tag } from '../../models/tag.model';
import { forkJoin, of, Observable } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { LoadingIndicatorComponent } from '../../shared/components/loading-indicator/loading-indicator.component';

@Component({
  selector: 'app-cheek-list',
  standalone: true,
  imports: [CommonModule, RouterModule, LoadingIndicatorComponent],
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
    private tagsService: TagsService
  ) { }

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
      map(cheeksData => cheeksData.filter(cheek => cheek.isPublic)),
      switchMap(filteredCheeksData => {
        if (!filteredCheeksData || filteredCheeksData.length === 0) {
          return of([]);
        }
        const cheeksWithTagsObservables = filteredCheeksData.map(cheek =>
          this.fetchTagsForCheek(cheek)
        );
        return forkJoin(cheeksWithTagsObservables);
      }),
      catchError(err => {
        console.error('Error fetching cheeks or their tags:', err);
        this.error = 'Failed to load cheeks data. Please try again later.';
        this.isLoading = false;
        return of([]);
      })
    ).subscribe({
      next: (processedCheeks) => {
        this.cheeks = processedCheeks;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Unhandled error in loadCheeks subscription:', err);
        this.error = this.error || 'An unexpected error occurred.';
        this.isLoading = false;
        this.cheeks = [];
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
      cheek.tags = [];
      return of(cheek);
    }
  }

  isUser(owner: any): owner is User {
    return !!owner && typeof owner === 'object' && 'username' in owner;
  }

  getOwnerUsername(owner: any): string {
    if (this.isUser(owner)) {
      return owner.username;
    }
    return typeof owner === 'string' ? owner : 'Unknown';
  }

  getOwnerId(owner: any): string {
    if (this.isUser(owner)) {
      return owner.id;
    }
    return typeof owner === 'string' ? owner : '';
  }
}
