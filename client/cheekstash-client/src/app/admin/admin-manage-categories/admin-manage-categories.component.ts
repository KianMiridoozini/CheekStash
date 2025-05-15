import { Component, OnInit, ViewChild } from '@angular/core'; // Added ViewChild
import { NgForm } from '@angular/forms'; // Added NgForm
import { CategoriesService } from '../../categories/categories.service'; // Corrected path
import { Category, CreateCategoryPayload, UpdateCategoryPayload } from '../../models/category.model'; // Corrected path

@Component({
  selector: 'app-admin-manage-categories',
  templateUrl: './admin-manage-categories.component.html',
  styleUrl: './admin-manage-categories.component.css', // Corrected to styleUrl from styleUrls if it was plural
  standalone: false
})
export class AdminManageCategoriesComponent implements OnInit {
  categories: Category[] = [];
  filteredCategories: Category[] = [];
  isLoading = true;
  error: string | null = null;

  currentCategory: Category | null = null; // For editing
  categoryForm: CreateCategoryPayload | UpdateCategoryPayload = { name: '', description: '' };
  isEditing = false;
  formError: string | null = null;

  @ViewChild('catForm') catForm!: NgForm; // Add ViewChild for the form

  searchTerm: string = '';
  sortProperty: 'name' = 'name'; // Only allow sorting by name
  sortDirection: 'asc' | 'desc' = 'asc';

  constructor(private categoriesService: CategoriesService) { }

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.isLoading = true;
    this.error = null;
    this.categoriesService.getAllCategories().subscribe({
      next: (data) => this._handleLoadCategoriesSuccess(data),
      error: (err) => this._handleLoadCategoriesError(err)
    });
  }

  private _handleLoadCategoriesSuccess(data: Category[]): void {
    this.categories = data;
    this.applyFiltersAndSorting(); // Apply initial filtering and sorting
    this.isLoading = false;
  }

  private _handleLoadCategoriesError(err: any): void {
    this.error = 'Failed to load categories.';
    console.error('Error fetching categories:', err);
    this.isLoading = false;
  }

  applyFiltersAndSorting(): void {
    let tempCategories = [...this.categories];

    // Filtering
    if (this.searchTerm) {
      tempCategories = tempCategories.filter(category =>
        category.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (category.description && category.description.toLowerCase().includes(this.searchTerm.toLowerCase()))
      );
    }

    // Sorting - Simplified for 'name' only
    tempCategories.sort((a, b) => {
      const valA = a.name?.toLowerCase() || '';
      const valB = b.name?.toLowerCase() || '';

      let comparison = 0;
      if (valA > valB) {
        comparison = 1;
      } else if (valA < valB) {
        comparison = -1;
      }
      return this.sortDirection === 'asc' ? comparison : comparison * -1;
    });

    this.filteredCategories = tempCategories;
  }

  onSearchTermChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    this.searchTerm = inputElement.value;
    this.applyFiltersAndSorting();
  }

  changeSort(property: 'name'): void { // Ensure property is strictly 'name'
    if (this.sortProperty === property) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortProperty = property;
      this.sortDirection = 'asc';
    }
    this.applyFiltersAndSorting();
  }

  selectCategoryForEdit(category: Category): void {
    this.currentCategory = { ...category }; // Clone to avoid modifying the list directly
    this.categoryForm = { name: category.name, description: category.description || '' };
    this.isEditing = true;
    this.formError = null;
    // Scroll to form for better UX if needed
    // window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit(): void {
    this.initNewCategoryForm();
  }

  initNewCategoryForm(): void {
    this.currentCategory = null;
    this.categoryForm = { name: '', description: '' };
    this.isEditing = false;
    this.formError = null;
    if (this.catForm) { // Check if catForm is initialized
      this.catForm.resetForm(); // Reset the form state, including validation
    }
  }

  saveCategory(): void {
    this.formError = null;
    // Ensure form is valid before proceeding (catForm might not be available on initial load)
    if (this.catForm && this.catForm.invalid) {
      // Mark all fields as touched to display validation messages
      Object.values(this.catForm.controls).forEach(control => {
        control.markAsTouched();
      });
      this.formError = 'Please correct the errors in the form.';
      return;
    }

    if (!this.categoryForm.name || this.categoryForm.name.trim() === '') {
      this.formError = 'Category name is required.';
      // It might be redundant if catForm.invalid check is robust
      return;
    }

    const validatedName = this.categoryForm.name.trim();
    const validatedDescription = (this.categoryForm.description || '').trim();
    this.isLoading = true; // Indicate loading for save operation

    if (this.isEditing && this.currentCategory && this.currentCategory._id) {
      const updatePayload: UpdateCategoryPayload = {
        name: validatedName,
        description: validatedDescription
      };
      this._handleUpdateCategory(this.currentCategory._id, updatePayload);
    } else {
      const createPayload: CreateCategoryPayload = {
        name: validatedName,
        description: validatedDescription
      };
      this._handleCreateCategory(createPayload);
    }
  }

  private _handleUpdateCategory(categoryId: string, payload: UpdateCategoryPayload): void {
    this.categoriesService.updateCategory(categoryId, payload).subscribe({
      next: (updatedCategory) => {
        // Optimistically update the specific category in the main list
        const index = this.categories.findIndex(cat => cat._id === categoryId);
        if (index !== -1) {
          this.categories[index] = { ...this.categories[index], ...updatedCategory };
        }
        this.applyFiltersAndSorting(); // Re-apply filters and sorting
        this.initNewCategoryForm(); // Reset form and editing state
        this.isLoading = false;
        console.log('Category updated successfully', updatedCategory);
      },
      error: (err) => {
        this.formError = `Failed to update category: ${err.error?.message || 'Server error'}`;
        console.error('Error updating category:', err);
        this.isLoading = false;
      }
    });
  }

  private _handleCreateCategory(payload: CreateCategoryPayload): void {
    this.categoriesService.createCategory(payload).subscribe({
      next: (newCategory) => {
        // Optimistically add to the main list
        this.categories.push(newCategory);
        this.applyFiltersAndSorting(); // Re-apply filters and sorting
        this.initNewCategoryForm(); // Call after everything, including isLoading = false
        this.isLoading = false;
        console.log('Category created successfully', newCategory);
      },
      error: (err) => {
        this.formError = `Failed to create category: ${err.error?.message || 'Server error'}`;
        console.error('Error creating category:', err);
        this.isLoading = false;
      }
    });
  }

  deleteCategory(categoryId: string): void {
    if (confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      this.isLoading = true;
      this.categoriesService.deleteCategory(categoryId).subscribe({
        next: () => {
          // Optimistically remove from the main list
          this.categories = this.categories.filter(cat => cat._id !== categoryId);
          this.applyFiltersAndSorting(); // Re-apply filters and sorting
          this.isLoading = false;
          // If the deleted category was being edited, reset the form
          if (this.currentCategory && this.currentCategory._id === categoryId) {
            this.initNewCategoryForm();
          }
        },
        error: (err) => {
          this.error = `Failed to delete category: ${err.error?.message || 'Server error'}`;
          console.error('Error deleting category:', err);
          this.isLoading = false;
        }
      });
    }
  }
}
