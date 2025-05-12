import { Component, EventEmitter, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../auth.service';
import { ChangePasswordPayload } from '../../models/user.model';
import { MessageComponent } from '../../shared/components/message/message.component';
import { LoadingIndicatorComponent } from '../../shared/components/loading-indicator/loading-indicator.component';

@Component({
    selector: 'app-change-password-modal',
    templateUrl: './change-password-modal.component.html',
    styleUrls: ['./change-password-modal.component.css'],
    standalone: true,
    imports: [CommonModule, FormsModule, MessageComponent, LoadingIndicatorComponent]
})
export class ChangePasswordModalComponent {
    @Output() passwordChanged = new EventEmitter<void>();
    @Output() modalClosed = new EventEmitter<void>();

    private authService = inject(AuthService);

    payload: ChangePasswordPayload = { oldPassword: '', newPassword: '' };
    confirmNewPassword = '';
    errorMessage: string | null = null;
    isLoading = false;

    onSubmit(): void {
        if (this.payload.newPassword !== this.confirmNewPassword) {
            this.errorMessage = 'New passwords do not match.';
            return;
        }
        if (!this.payload.oldPassword || !this.payload.newPassword) {
            this.errorMessage = 'All fields are required.';
            return;
        }
        if (this.payload.newPassword.length < 8) {
            this.errorMessage = 'New password must be at least 8 characters long.';
            return;
        }

        this.isLoading = true;
        this.errorMessage = null;

        this.authService.changePassword(this.payload).subscribe({
            next: () => {
                this.isLoading = false;
                this.passwordChanged.emit();
                this.payload = { oldPassword: '', newPassword: '' };
                this.confirmNewPassword = '';
            },
            error: (err) => {
                this.isLoading = false;
                this.errorMessage = err.error?.message || 'Failed to change password. Please try again.';
                console.error('Change password error:', err);
            }
        });
    }

    close(): void {
        this.modalClosed.emit();
    }
}
