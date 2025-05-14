// home.component.ts
import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core'; // Added AfterViewInit
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, of, Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, tap, catchError, filter, takeUntil, startWith, take } from 'rxjs/operators'; // Added startWith and take
import { CheeksService } from '../cheeks/cheeks.service';
import { Cheek } from '../models/cheek.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  searchKeyword: string = '';
  private destroy$ = new Subject<void>();

  private searchSubject = new Subject<string>();
  suggestedCheeks$!: Observable<Cheek[]>;
  showSuggestions = false;
  suggestionsLoading = false;

  constructor(
    private router: Router,
    private cheeksService: CheeksService
  ) {}

  ngOnInit(): void {
    this.suggestedCheeks$ = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter(term => typeof term === 'string' && term.trim().length > 1),
      tap(() => {
        this.suggestionsLoading = true;
        if (this.searchInput && document.activeElement === this.searchInput.nativeElement && this.searchKeyword.trim().length > 1) {
          this.showSuggestions = true;
        }
      }),
      switchMap(term =>
        this.cheeksService.getCheekSuggestions(term.trim(), 5).pipe(
          tap(() => {
            this.suggestionsLoading = false;
            // If input is still focused and term is valid, the suggestions area should remain visible.
            // The template will then show either the cheeks or "no suggestions found".
            if (this.searchInput && document.activeElement === this.searchInput.nativeElement && this.searchKeyword.trim().length > 1) {
              this.showSuggestions = true; 
            } else {
              this.showSuggestions = false;
            }
          }),
          catchError(err => {
            this.suggestionsLoading = false;
            this.showSuggestions = false;
            return of([]);
          })
        )
      ),
      startWith([]), 
      takeUntil(this.destroy$)
    );

    this.searchSubject.pipe(
      filter(term => typeof term === 'string' && term.trim().length <= 1),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.showSuggestions = false;
      this.suggestionsLoading = false; 
    });
  }

  ngAfterViewInit(): void {
    // searchInput is now available
  }

  onSearchKeywordChange(keyword: string): void {
    this.searchKeyword = keyword;
    const trimmedKeyword = keyword.trim();
    this.searchSubject.next(trimmedKeyword);

    if (trimmedKeyword.length <= 1) {
      this.showSuggestions = false;
      this.suggestionsLoading = false;
    } else {
      if (this.searchInput && document.activeElement === this.searchInput.nativeElement) {
        // this.showSuggestions = true; // This might be redundant due to the observable tap
      }
    }
  }

  onSearchSubmit(): void {
    this.showSuggestions = false;
    if (this.searchKeyword && this.searchKeyword.trim() !== '') {
      this.router.navigate(['/cheeks'], { queryParams: { search: this.searchKeyword.trim() } });
    } else {
      this.router.navigate(['/cheeks']);
    }
  }

  selectSuggestion(cheekTitle: string): void {
    this.searchKeyword = cheekTitle;
    this.showSuggestions = false;
    this.onSearchSubmit();
  }
  
  onInputBlur(): void {
    setTimeout(() => {
      this.showSuggestions = false;
    }, 150);
  }

  onInputFocus(): void {
    const trimmedKeyword = this.searchKeyword.trim();
    if (trimmedKeyword.length > 1) {
      this.showSuggestions = true; 
      this.searchSubject.next(trimmedKeyword);
    } else {
      this.showSuggestions = false;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}