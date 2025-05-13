import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; // Import CommonModule
import { CategoriesService } from '../categories.service';
import { Category } from '../../models/category.model';
import { LoadingIndicatorComponent } from '../../shared/components/loading-indicator/loading-indicator.component'; // Added

@Component({
  selector: 'app-categories-list',
  standalone: true, // Keep standalone if it was generated like that
  imports: [CommonModule, LoadingIndicatorComponent], // Add CommonModule here for *ngIf, *ngFor, Added LoadingIndicatorComponent
  templateUrl: './categories-list.component.html',
  styleUrl: './categories-list.component.css'
})
export class CategoriesListComponent implements OnInit {
  categories: Category[] = [];
  isLoading = true;
  error: string | null = null;

  constructor(private categoriesService: CategoriesService) { }

  ngOnInit(): void {
    this.categoriesService.getAllCategories().subscribe({
      next: (data) => {
        this.categories = data;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Failed to load categories. Please try again later.';
        console.error('Error fetching categories:', err);
        this.isLoading = false;
      }
    });
  }
}
