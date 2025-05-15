import { Component, OnInit, OnChanges, SimpleChanges, Input, Output, EventEmitter, HostListener, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, startWith } from 'rxjs/operators';

import { Category } from '../../models/category.model';
import { Tag } from '../../models/tag.model';
import { CategoriesService } from '../../categories/categories.service';
import { TagsService } from '../../tags/tags.service';

// Define the structure for initial filters (names from URL)
export interface InitialSearchFilters {
  searchKeyword?: string;
  categoryNames?: string[];
  tagNames?: string[];
}

// Define the structure for the emitted search criteria
export interface EmittedSearchCriteria {
  searchKeyword?: string;
  categoryIds?: string[];
  tagIds?: string[];
  categoryNames?: string[];
  tagNames?: string[];
}

@Component({
  selector: 'app-cheek-search',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './cheek-search.component.html',
  styleUrl: './cheek-search.component.css'
})
export class CheekSearchComponent implements OnInit, OnChanges {
  @Input() initialFilters: InitialSearchFilters = {};
  @Output() searchCriteriaChange = new EventEmitter<EmittedSearchCriteria>();

  searchForm: FormGroup;
  categories: Category[] = [];
  tags: Tag[] = [];

  isLoadingCategories = true;
  isLoadingTags = true;

  public isCategoriesDropdownOpen = false;
  public isTagsDropdownOpen = false;

  private dataSourcesLoaded = false;
  private isInitialSearchPending = false;

  constructor(
    private fb: FormBuilder,
    private categoriesService: CategoriesService,
    private tagsService: TagsService,
    private elRef: ElementRef
  ) {
    this.searchForm = this.fb.group({
      searchKeyword: [this.initialFilters?.searchKeyword || ''],
      categoryIds: [[]],
      tagIds: [[]]
    });
  }

  ngOnInit(): void {
    this.loadDataSources();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialFilters'] && this.initialFilters) {
      this.isInitialSearchPending = true;
      if (this.dataSourcesLoaded) {
        this.applyInitialFiltersAndSearch();
      }
    }
  }

  loadDataSources(): void {
    this.isLoadingCategories = true;
    this.isLoadingTags = true;
    this.dataSourcesLoaded = false;

    forkJoin({
      categories: this.categoriesService.getAllCategories().pipe(
        catchError(err => {
          console.error('Error loading categories', err);
          this.isLoadingCategories = false;
          return of([]);
        })
      ),
      tags: this.tagsService.getAllTags().pipe(
        catchError(err => {
          console.error('Error loading tags', err);
          this.isLoadingTags = false;
          return of([]);
        })
      )
    }).subscribe(response => {
      this.categories = response.categories;
      this.tags = response.tags;
      this.isLoadingCategories = false;
      this.isLoadingTags = false;
      this.dataSourcesLoaded = true;

      if (this.isInitialSearchPending) {
        this.applyInitialFiltersAndSearch();
      }
    });
  }

  private mapNamesToIds(names: string[] | undefined, collection: Array<{ _id: string, name: string }>): string[] {
    if (!names || names.length === 0) {
      return [];
    }
    return names
      .map(name => collection.find(item => item.name === name)?._id)
      .filter(id => !!id) as string[];
  }

  applyInitialFiltersAndSearch(): void {
    if (!this.initialFilters || !this.dataSourcesLoaded) {
      return;
    }

    const categoryIdsToPatch = this.mapNamesToIds(this.initialFilters.categoryNames, this.categories);
    const tagIdsToPatch = this.mapNamesToIds(this.initialFilters.tagNames, this.tags);

    this.searchForm.patchValue({
      searchKeyword: this.initialFilters.searchKeyword || '',
      categoryIds: categoryIdsToPatch,
      tagIds: tagIdsToPatch
    }, { emitEvent: false });

    if (this.isInitialSearchPending) {
      this.onSubmit(true);
      this.isInitialSearchPending = false;
    }
  }

  patchFormWithInitialValues(): void {
    if (this.initialFilters && this.dataSourcesLoaded) {
      const categoryIdsToPatch = this.mapNamesToIds(this.initialFilters.categoryNames, this.categories);
      const tagIdsToPatch = this.mapNamesToIds(this.initialFilters.tagNames, this.tags);

      this.searchForm.patchValue({
        searchKeyword: this.initialFilters.searchKeyword || '',
        categoryIds: categoryIdsToPatch,
        tagIds: tagIdsToPatch
      }, { emitEvent: false });
    }
  }

  onCategoryChange(categoryId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const currentCategoryIds = this.searchForm.get('categoryIds')?.value as Array<string> || [];
    if (checked) {
      if (!currentCategoryIds.includes(categoryId)) {
        this.searchForm.get('categoryIds')?.setValue([...currentCategoryIds, categoryId]);
      }
    } else {
      this.searchForm.get('categoryIds')?.setValue(currentCategoryIds.filter(id => id !== categoryId));
    }
    this.searchForm.markAsDirty();
  }

  isCategorySelected(categoryId: string): boolean {
    const currentCategoryIds = this.searchForm.get('categoryIds')?.value as Array<string> || [];
    return currentCategoryIds.includes(categoryId);
  }

  getSelectedCategoriesText(): string {
    const selectedIds = this.searchForm.get('categoryIds')?.value as Array<string> || [];
    if (selectedIds.length === 0) {
      return 'Select Categories';
    }
    if (selectedIds.length <= 2) {
      return this.categories
        .filter(cat => selectedIds.includes(cat._id))
        .map(cat => cat.name)
        .join(', ');
    }
    return `${selectedIds.length} categories selected`;
  }

  onTagChange(tagId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const currentTagIds = this.searchForm.get('tagIds')?.value as Array<string> || [];
    if (checked) {
      if (!currentTagIds.includes(tagId)) {
        this.searchForm.get('tagIds')?.setValue([...currentTagIds, tagId]);
      }
    } else {
      this.searchForm.get('tagIds')?.setValue(currentTagIds.filter(id => id !== tagId));
    }
    this.searchForm.markAsDirty();
  }

  isTagSelected(tagId: string): boolean {
    const currentTagIds = this.searchForm.get('tagIds')?.value as Array<string> || [];
    return currentTagIds.includes(tagId);
  }

  getSelectedTagsText(): string {
    const selectedIds = this.searchForm.get('tagIds')?.value as Array<string> || [];
    if (selectedIds.length === 0) {
      return 'Select Tags';
    }
    if (selectedIds.length <= 2) {
      return this.tags
        .filter(tag => selectedIds.includes(tag._id))
        .map(tag => tag.name)
        .join(', ');
    }
    return `${selectedIds.length} tags selected`;
  }

  toggleCategoriesDropdown(event: MouseEvent): void {
    event.stopPropagation(); // Prevent click from bubbling to document listener
    this.isCategoriesDropdownOpen = !this.isCategoriesDropdownOpen;
    if (this.isCategoriesDropdownOpen) {
      this.isTagsDropdownOpen = false; // Close other dropdown
    }
  }

  toggleTagsDropdown(event: MouseEvent): void {
    event.stopPropagation(); // Prevent click from bubbling to document listener
    this.isTagsDropdownOpen = !this.isTagsDropdownOpen;
    if (this.isTagsDropdownOpen) {
      this.isCategoriesDropdownOpen = false; // Close other dropdown
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.isCategoriesDropdownOpen = false;
      this.isTagsDropdownOpen = false;
    }
  }

  onSubmit(isInitialSubmit: boolean = false): void {
    const formValue = this.searchForm.value;

    const categoryIds = formValue.categoryIds || [];
    const tagIds = formValue.tagIds || [];

    const categoryNames = categoryIds.map((id: string) => this.categories.find(c => c._id === id)?.name).filter((name: string | undefined) => !!name) as string[];
    const tagNames = tagIds.map((id: string) => this.tags.find(t => t._id === id)?.name).filter((name: string | undefined) => !!name) as string[];

    const emittedCriteria: EmittedSearchCriteria = {
      searchKeyword: formValue.searchKeyword?.trim() || undefined,
      categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
      tagIds: tagIds.length > 0 ? tagIds : undefined,
      categoryNames: categoryNames.length > 0 ? categoryNames : undefined,
      tagNames: tagNames.length > 0 ? tagNames : undefined,
    };

    Object.keys(emittedCriteria).forEach(keyStr => {
      const key = keyStr as keyof EmittedSearchCriteria;
      if (emittedCriteria[key] === undefined || (Array.isArray(emittedCriteria[key]) && (emittedCriteria[key] as any[]).length === 0)) {
        delete emittedCriteria[key];
      }
    });

    this.searchCriteriaChange.emit(emittedCriteria);
  }

  resetFilters(): void {
    this.searchForm.reset({
      searchKeyword: '',
      categoryIds: [],
      tagIds: []
    });
    this.searchCriteriaChange.emit({});
  }
}
