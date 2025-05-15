import { Component, EventEmitter, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../auth.service';
import { ConfirmPasswordPayload } from '../../models/user.model';
import { Router } from '@angular/router';
import { MessageComponent } from '../../shared/components/message/message.component';
import { LoadingIndicatorComponent } from '../../shared/components/loading-indicator/loading-indicator.component';

@Component({
    selector: 'app-delete-account-modal',
    templateUrl: './delete-account-modal.component.html',
    styleUrls: ['./delete-account-modal.component.css'],
    standalone: true,
    imports: [CommonModule, FormsModule, MessageComponent, LoadingIndicatorComponent]
})
export class DeleteAccountModalComponent {
    @Output() accountDeleted = new EventEmitter<void>();
    @Output() modalClosed = new EventEmitter<void>();

    private authService = inject(AuthService);
    private router = inject(Router);

    payload: ConfirmPasswordPayload = { password: '' };
    errorMessage: string | null = null;
    isLoading = false;

    onSubmit(): void {
        if (!this.payload.password) {
            this.errorMessage = 'Password is required to confirm deletion.';
            return;
        }
        this.isLoading = true;
        this.errorMessage = null;

        this.authService.deleteAccount(this.payload).subscribe({
            next: () => {
                this.isLoading = false;
                this.authService.logout();
                this.router.navigate(['/login']);
                this.accountDeleted.emit();
            },
            error: (err) => {
                this.isLoading = false;
                this.errorMessage = err.error?.message || 'Failed to delete account. Please check your password and try again.';
                console.error('Delete account error:', err);
            }
        });
    }

    close(): void {
        this.modalClosed.emit();
    }
}
