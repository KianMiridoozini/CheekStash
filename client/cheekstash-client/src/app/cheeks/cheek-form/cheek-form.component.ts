import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CheeksService } from '../cheeks.service';
import { CategoriesService } from '../../categories/categories.service';
import { UsersService } from '../../users/users.service';
import { TagsService } from '../../tags/tags.service';
import { Category } from '../../models/category.model';
import { CreateCheekPayload, UpdateCheekPayload, Link, Cheek } from '../../models/cheek.model';
import { LoadingIndicatorComponent } from '../../shared/components/loading-indicator/loading-indicator.component';
import { switchMap, catchError, tap, map } from 'rxjs/operators';
import { of, Observable } from 'rxjs';

@Component({
  selector: 'app-cheek-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LoadingIndicatorComponent],
  templateUrl: './cheek-form.component.html',
  styleUrls: ['./cheek-form.component.css']
})
export class CheekFormComponent implements OnInit {
  cheekForm: FormGroup;
  categories: Category[] = [];
  isLoading: boolean = false;
  error: string | null = null;
  submitted: boolean = false;
  isEditMode: boolean = false;
  currentCheekId: string | null = null;
  pageTitle: string = 'Create New Cheek';

  constructor(
    private fb: FormBuilder,
    private cheeksService: CheeksService,
    private categoriesService: CategoriesService,
    private usersService: UsersService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.cheekForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      categoryId: ['', Validators.required],
      tagNames: [''],
      isPublic: [true, Validators.required],
      links: this.fb.array([], [Validators.required, Validators.minLength(2)])
    });
  }

  ngOnInit(): void {
    this.loadCategories();

    this.route.paramMap.pipe(
      switchMap(params => {
        const username = params.get('username');
        const cheekSlug = params.get('cheekSlug');

        if (username && cheekSlug) {
          return this.initializeFormForEditMode(username, cheekSlug);
        } else {
          this.initializeFormForCreateMode();
          return of(null);
        }
      })
    ).subscribe();
  }

  private initializeFormForEditMode(username: string, cheekSlug: string): Observable<Cheek | null> {
    this.isEditMode = true;
    this.pageTitle = 'Edit Cheek';
    this.isLoading = true;

    return this.cheeksService.getCheekByUsernameAndSlug(username, cheekSlug).pipe(
      switchMap(cheekData => {
        if (!cheekData) {
          this.error = 'Cheek not found for editing.';
          this.isLoading = false;
          return of(null);
        }
        this.currentCheekId = cheekData._id;

        cheekData.tagIds = cheekData.tagIds || [];
        return of(cheekData);
      }),
      tap(finalCheekData => {
        this.isLoading = false;
        if (finalCheekData) {
          this.populateForm(finalCheekData);
        } else {
          if (!this.error) {
            this.error = 'Failed to process cheek data for editing.';
          }
        }
      }),
      catchError(err => {
        this.isLoading = false;
        console.error('Error fetching cheek for edit:', err);
        this.error = `Failed to load cheek data: ${err.error?.message || err.message}`;
        return of(null);
      })
    );
  }

  private initializeFormForCreateMode() {
    this.isEditMode = false;
    this.pageTitle = 'Create New Cheek';
    this.addLinkField();
    this.addLinkField();
  }

  loadCategories(): void {
    this.isLoading = true;
    this.categoriesService.getAllCategories().subscribe({
      next: (data) => {
        this.categories = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching categories:', err);
        this.error = 'Failed to load categories. Please try again later.';
        this.isLoading = false;
      }
    });
  }

  populateForm(cheekData: Cheek): void {
    this.cheekForm.patchValue({
      title: cheekData.title,
      description: cheekData.description,
      categoryId: cheekData.categoryId?._id || cheekData.categoryId,
      tagNames: cheekData.tagIds && Array.isArray(cheekData.tagIds)
        ? cheekData.tagIds.map(tag => tag.name).join(', ')
        : '',
      isPublic: cheekData.isPublic
    });

    const linksArray = this.cheekForm.get('links') as FormArray;
    linksArray.clear();
    if (cheekData.links && cheekData.links.length > 0) {
      cheekData.links.forEach(link => {
        linksArray.push(this.createLinkFormGroupWithValue(link));
      });
    }
    while (linksArray.length < 2) {
      this.addLinkField();
    }
  }

  get linksFormArray(): FormArray {
    return this.cheekForm.get('links') as FormArray;
  }

  createLinkFormGroup(): FormGroup {
    return this.fb.group({
      title: ['', Validators.required],
      url: ['', [Validators.required, Validators.pattern(/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/)]],
      description: ['']
    });
  }

  createLinkFormGroupWithValue(link: Link): FormGroup {
    return this.fb.group({
      title: [link.title, Validators.required],
      url: [link.url, [Validators.required, Validators.pattern(/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/)]],
      description: [link.description || '']
    });
  }

  addLinkField(): void {
    this.linksFormArray.push(this.createLinkFormGroup());
  }

  removeLinkField(index: number): void {
    if (this.linksFormArray.length > 2) {
      this.linksFormArray.removeAt(index);
    } else {
      alert('A cheek must have at least two links.');
    }
  }

  private handleFormValidation(): boolean {
    this.submitted = true;
    this.error = null;

    if (this.cheekForm.invalid) {
      console.warn('Form is invalid:', this.cheekForm.value);
      this.cheekForm.markAllAsTouched();
      this.error = "Please correct the form errors. Ensure all required fields are filled and links are valid.";
      return false;
    }
    return true;
  }

  private buildCheekPayload(): CreateCheekPayload | UpdateCheekPayload {
    const formValue = this.cheekForm.value;
    const tagNamesArray = formValue.tagNames 
      ? formValue.tagNames.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag) 
      : [];
    const linksPayload = formValue.links.map((link: Link, index: number) => ({ ...link, order: index }));

    return {
      title: formValue.title,
      description: formValue.description,
      categoryId: formValue.categoryId,
      tagNames: tagNamesArray,
      isPublic: formValue.isPublic,
      links: linksPayload
    };
  }

  private navigateToCheek(cheek: Cheek): void {
    if (cheek.owner && typeof cheek.owner === 'object' && 'username' in cheek.owner) {
      this.router.navigate(['/cheeks', cheek.owner.username, cheek.slug]);
    } else if (typeof cheek.owner === 'string') {
      this.usersService.getUserById(cheek.owner).subscribe({
        next: (user: any) => { this.router.navigate(['/cheeks', user.username, cheek.slug]); },
        error: () => { this.router.navigate(['/cheeks', cheek._id]); }
      });
    } else {
      this.router.navigate(['/cheeks', cheek._id]);
    }
  }

  onSubmit(): void {
    if (!this.handleFormValidation()) {
      return;
    }

    this.isLoading = true;
    const payload = this.buildCheekPayload();

    if (this.isEditMode && this.currentCheekId) {
      this.cheeksService.updateCheek(this.currentCheekId, payload as UpdateCheekPayload).subscribe({
        next: (updatedCheek) => {
          this.isLoading = false;
          this.navigateToCheek(updatedCheek);
        },
        error: (err: any) => {
          console.error('Error updating cheek:', err);
          this.error = `Failed to update cheek: ${err.error?.message || err.message || 'Please try again later.'}`;
          this.isLoading = false;
        }
      });
    } else {
      this.cheeksService.createCheek(payload as CreateCheekPayload).subscribe({
        next: (newCheek) => {
          this.isLoading = false;
          this.navigateToCheek(newCheek);
        },
        error: (err: any) => {
          console.error('Error creating cheek:', err);
          this.error = `Failed to create cheek: ${err.error?.message || err.message || 'Please try again later.'}`;
          this.isLoading = false;
        }
      });
    }
  }

  public formatLinkUrl(url: string | null | undefined): string {
    if (!url) {
      return '#';
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `https://${url}`;
  }
}
