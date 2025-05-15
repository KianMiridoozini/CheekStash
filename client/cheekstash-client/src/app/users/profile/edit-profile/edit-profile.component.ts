import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../auth/auth.service';
import { UsersService } from '../../users.service';
import { User, UpdateUserProfilePayload } from '../../../models/user.model';
import { MessageComponent } from '../../../shared/components/message/message.component';
import { Observable, of, throwError } from 'rxjs';
import { catchError, tap, finalize, concatMap } from 'rxjs/operators';

@Component({
    selector: 'app-edit-profile',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, MessageComponent],
    templateUrl: './edit-profile.component.html',
    styleUrls: ['./edit-profile.component.css']
})
export class EditProfileComponent implements OnInit {
    editProfileForm: FormGroup;
    currentUser: User | null = null;
    isLoading = false;
    errorMessage: string | null = null;
    selectedFile: File | null = null;
    selectedFilePreview: string | ArrayBuffer | null = null;

    constructor(
        private fb: FormBuilder,
        public authService: AuthService,
        private usersService: UsersService,
        private router: Router
    ) {
        this.editProfileForm = this.fb.group({
            displayName: ['', [Validators.maxLength(50)]],
            bio: ['', [Validators.maxLength(250)]]
        });
    }

    ngOnInit(): void {
        const userSignal = this.authService.currentUserSignal();
        if (userSignal) {
            this.currentUser = userSignal;
            this.editProfileForm.patchValue({
                displayName: this.currentUser.profile?.displayName || '',
                bio: this.currentUser.profile?.bio || ''
            });
        } else {
            // Fallback if signal is not immediately available (e.g. initial load, direct navigation)
            this.authService.getCurrentUser().subscribe(user => {
                if (user) {
                    this.currentUser = user;
                    this.editProfileForm.patchValue({
                        displayName: this.currentUser.profile?.displayName || '',
                        bio: this.currentUser.profile?.bio || ''
                    });
                } else {
                    // Should not happen if route guards are effective, but good practice
                    this.router.navigate(['/login']);
                }
            });
        }
    }

    onFileSelected(event: any): void {
        const file: File = event.target.files[0];
        if (file) {
            this.selectedFile = file;
            this.errorMessage = null;

            // Create a preview
            const reader = new FileReader();
            reader.onload = () => {
                this.selectedFilePreview = reader.result;
            };
            reader.readAsDataURL(file);
        } else {
            this.selectedFile = null;
            this.selectedFilePreview = null;
        }
    }

    private _processTextUpdate(formValues: any, isTextFormDirty: boolean): Observable<User | null> {
        if (isTextFormDirty && this.editProfileForm.valid) {
            const payload: UpdateUserProfilePayload = {};
            if (this.editProfileForm.controls['displayName'].dirty) {
                payload.displayName = formValues.displayName;
            }
            if (this.editProfileForm.controls['bio'].dirty) {
                payload.bio = formValues.bio;
            }
            if (Object.keys(payload).length > 0) {
                return this.usersService.updateUserProfile(payload).pipe(
                    catchError(err => {
                        this.errorMessage = err.error?.message || 'Failed to update profile details.';
                        console.error('Profile text update error:', err);
                        return throwError(() => err);
                    })
                );
            } else {
                return of(null); // No changes to submit
            }
        } else if (this.editProfileForm.invalid && isTextFormDirty) {
            this.errorMessage = 'Please correct the errors in the form for display name and bio.';
            return throwError(() => new Error('Form invalid'));
        } else {
            return of(null); // Not dirty or no payload
        }
    }

    private _processImageUpload(isFileSelected: boolean): Observable<User | null> {
        if (isFileSelected && this.selectedFile) {
            return this.usersService.uploadProfileImage(this.selectedFile).pipe(
                tap(() => {
                    this.selectedFile = null;
                }),
                catchError(err => {
                    const imageError = err.error?.message || 'Failed to upload profile image.';
                    this.errorMessage = this.errorMessage ? `${this.errorMessage} And ${imageError}` : imageError;
                    console.error('Profile image upload error:', err);
                    return throwError(() => err);
                })
            );
        } else {
            return of(null); // No file selected or no file to upload
        }
    }

    onSubmit(): void {
        if (!this.currentUser) {
            this.errorMessage = 'User data not found. Cannot update profile.';
            return;
        }

        this.isLoading = true;
        this.errorMessage = null;

        const formValues = this.editProfileForm.value;
        const isTextFormDirty = this.editProfileForm.controls['displayName'].dirty || this.editProfileForm.controls['bio'].dirty;
        const isFileSelected = !!this.selectedFile;

        if (!isTextFormDirty && !isFileSelected) {
            this.isLoading = false;
            this.router.navigate(['/profile']);
            return;
        }

        const textUpdate$ = this._processTextUpdate(formValues, isTextFormDirty);
        const imageUpload$ = this._processImageUpload(isFileSelected);

        textUpdate$.pipe(
            concatMap(() => imageUpload$), 
            tap(() => {
                if (!this.errorMessage) { 
                    this.authService.refreshUserProfile();
                    this.selectedFilePreview = null;
                    this.router.navigate(['/profile']);
                }
            }),
            catchError(err => {
                console.error('Overall submission error:', err);
                return of(null); // Prevent the error from propagating further and breaking the stream if not re-thrown
            }),
            finalize(() => {
                this.isLoading = false;
            })
        ).subscribe();
    }

    onCancel(): void {
        this.selectedFile = null;
        this.selectedFilePreview = null;
        this.router.navigate(['/profile']);
    }
}
