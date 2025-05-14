import { Component, OnInit } from '@angular/core';
import { TagsService } from '../../tags/tags.service';
import { Tag } from '../../models/tag.model';

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

  searchTerm: string = '';
  sortProperty: keyof Tag | 'usageCount' = 'name'; // 'name' or 'usageCount'
  sortDirection: 'asc' | 'desc' = 'asc';

  constructor(private tagsService: TagsService) { }

  ngOnInit(): void {
    this.loadTags();
  }

  loadTags(): void {
    this.isLoading = true;
    this.error = null;
    this.tagsService.getAllTags().subscribe({
      next: (data) => {
        this.tags = data;
        this.applyFiltersAndSorting(); // Apply initial filtering and sorting
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
      tempTags = tempTags.filter(tag =>
        tag.name.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }

    // Sorting
    tempTags.sort((a, b) => {
      let valA, valB;

      if (this.sortProperty === 'usageCount') {
        valA = a.usageCount ?? 0; // Default to 0 if undefined
        valB = b.usageCount ?? 0; // Default to 0 if undefined
      } else { // Default to 'name' or any other string property
        valA = (a[this.sortProperty] as string)?.toLowerCase() || '';
        valB = (b[this.sortProperty] as string)?.toLowerCase() || '';
      }

      let comparison = 0;
      if (valA > valB) {
        comparison = 1;
      } else if (valA < valB) {
        comparison = -1;
      }
      return this.sortDirection === 'asc' ? comparison : comparison * -1;
    });

    this.filteredTags = tempTags;
  }

  onSearchTermChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    this.searchTerm = inputElement.value;
    this.applyFiltersAndSorting();
  }

  changeSort(property: keyof Tag | 'usageCount'): void {
    if (this.sortProperty === property) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortProperty = property;
      this.sortDirection = 'asc';
    }
    this.applyFiltersAndSorting();
  }

  deleteTag(tagId: string): void {
    if (confirm('Are you sure you want to delete this tag? This action cannot be undone.')) {
      this.isLoading = true; // Indicate loading state during delete
      this.tagsService.deleteTag(tagId).subscribe({
        next: () => {
          // Optimistically update the UI
          this.tags = this.tags.filter(tag => tag._id !== tagId);
          this.applyFiltersAndSorting();
          this.isLoading = false;
        },
        error: (err) => {
          this.error = `Failed to delete tag: ${err.error?.message || 'Server error'}`;
          console.error('Error deleting tag:', err);
          this.isLoading = false;
        }
      });
    }
  }
}
