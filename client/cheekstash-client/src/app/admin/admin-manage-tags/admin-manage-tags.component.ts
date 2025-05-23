import { Component, OnInit, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { TagsService } from '../../tags/tags.service';
import { Tag, CreateTagPayload } from '../../models/tag.model';

@Component({
  selector: 'app-admin-manage-tags',
  templateUrl: './admin-manage-tags.component.html',
  styleUrl: './admin-manage-tags.component.css',
  standalone: false,
})
export class AdminManageTagsComponent implements OnInit {
  tags: Tag[] = [];
  filteredTags: Tag[] = [];
  isLoading = true;
  error: string | null = null;

  // Form-related properties
  tagFormModel: CreateTagPayload = { name: '' };
  formError: string | null = null;
  @ViewChild('tagFormRef') tagFormRef!: NgForm;

  searchTerm: string = '';
  sortProperty: keyof Tag | 'usageCount' | 'createdAt' = 'name'; 
  sortDirection: 'asc' | 'desc' = 'asc';

  constructor(private tagsService: TagsService) { }

  ngOnInit(): void {
    this.loadTags();
  }

  loadTags(): void {
    this.isLoading = true;
    this.error = null;
    this.formError = null;
    this.tagsService.getAllTags().subscribe({
      next: (data) => {
        this.tags = data;
        this.applyFiltersAndSorting();
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Failed to load tags.';
        console.error('Error fetching tags:', err);
        this.isLoading = false;
      }
    });
  }

  applyFiltersAndSorting(): void {
    let tempTags = [...this.tags];

    // Filtering
    if (this.searchTerm) {
      const lowerSearchTerm = this.searchTerm.toLowerCase();
      tempTags = tempTags.filter(tag =>
        tag.name.toLowerCase().includes(lowerSearchTerm)
      );
    }

    // Sorting
    tempTags.sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (this.sortProperty) {
        case 'name':
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          break;
        case 'usageCount':
          valA = a.usageCount ?? 0;
          valB = b.usageCount ?? 0;
          break;
        case 'createdAt':
          valA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          valB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          break;
        default:
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
      }

      if (valA < valB) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (valA > valB) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });

    this.filteredTags = tempTags;
  }

  onSearchTermChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    this.searchTerm = inputElement.value;
    this.applyFiltersAndSorting();
  }

  changeSort(property: keyof Tag | 'usageCount' | 'createdAt'): void {
    if (this.sortProperty === property) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortProperty = property;
      this.sortDirection = 'asc';
    }
    this.applyFiltersAndSorting();
  }

  saveTag(): void {
    if (this.tagFormRef.invalid) {
      this.formError = "Please ensure the tag name is valid.";
      Object.keys(this.tagFormRef.controls).forEach(field => {
        const control = this.tagFormRef.controls[field];
        control.markAsTouched({ onlySelf: true });
      });
      return;
    }

    this.isLoading = true;
    this.formError = null;

    this.tagsService.createTag(this.tagFormModel).subscribe({
      next: (newTag) => {
        this.loadTags();
        this.tagFormModel = { name: '' };
        this.tagFormRef.resetForm();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error creating tag:', err);
        if (err.status === 409) {
          this.formError = 'This tag name already exists.';
        } else if (err.error && err.error.message && Array.isArray(err.error.message)) {
          this.formError = `Failed to create tag: ${err.error.message.join(', ')}`;
        } else if (err.error && typeof err.error.message === 'string') {
          this.formError = `Failed to create tag: ${err.error.message}`;
        }
        else {
          this.formError = 'An unexpected error occurred while creating the tag.';
        }
        this.isLoading = false;
      }
    });
  }

  deleteTag(tagId: string): void {
    if (!confirm('Are you sure you want to delete this tag? This action cannot be undone.')) {
      return;
    }

    this.isLoading = true;
    this.error = null; // Clear previous main errors
    this.tagsService.deleteTag(tagId).subscribe({
      next: () => {
        // this.tags = this.tags.filter(tag => tag._id !== tagId);
        // this.applyFiltersAndSorting();
        this.loadTags();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error deleting tag:', err);
        this.error = `Failed to delete tag. ${err.error?.message || ''}`;
        this.isLoading = false;
      }
    });
  }
}
