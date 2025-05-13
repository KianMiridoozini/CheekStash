import { ChangeDetectionStrategy, Component, OnInit, WritableSignal, computed, inject, signal, DestroyRef } from '@angular/core';
import { AuthService } from '../../auth/auth.service';
import { User } from '../../models/user.model';
import { UsersService } from '../users.service';
import { CommonModule } from '@angular/common'; // AsyncPipe is part of CommonModule
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { Cheek } from '../../models/cheek.model';
import { CheeksService } from '../../cheeks/cheeks.service';
import { catchError, finalize, of, switchMap, tap, Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChangePasswordModalComponent } from '../../auth/change-password-modal/change-password-modal.component';
import { DeleteAccountModalComponent } from '../../auth/delete-account-modal/delete-account-modal.component';
import { LoadingIndicatorComponent } from '../../shared/components/loading-indicator/loading-indicator.component'; // Added

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule, ChangePasswordModalComponent, DeleteAccountModalComponent, LoadingIndicatorComponent], // Added LoadingIndicatorComponent
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileComponent implements OnInit {
  // --- Dependencies ---
  private authService = inject(AuthService);
  private usersService = inject(UsersService);
  private cheeksService = inject(CheeksService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef); // For takeUntilDestroyed

  // --- State Signals ---
  readonly currentUser = this.authService.currentUserSignal;
  readonly profileUser = signal<User | null>(null);
  readonly userCheeks = signal<Cheek[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);

  // Modal visibility signals
  readonly showChangePasswordModal = signal(false);
  readonly showDeleteAccountModal = signal(false);

  // --- Computed Signals ---
  readonly isOwnProfile = computed(() => {
    const current = this.currentUser();
    const profile = this.profileUser();
    return !!current && !!profile && current.id === profile.id;
  });

  readonly cheeksTitle = computed(() => {
    const user = this.profileUser();
    if (!user) {
      return 'Cheeks';
    }
    if (this.isOwnProfile()) {
      return 'Your Cheeks';
    }
    const username = user.username;
    return username.endsWith('s') ? `${username}' Cheeks` : `${username}'s Cheeks`;
  });

  // --- Lifecycle ---
  ngOnInit(): void {
    const usernameFromRoute = this.route.snapshot.paramMap.get('username');

    if (usernameFromRoute) {
      this._loadProfileByUsername(usernameFromRoute);
    } else {
      this._loadCurrentUsersProfile();
    }
  }

  // --- Private Data Loading Methods ---

  private _loadProfileByUsername(username: string): void {
    this._initiateProfileLoad(
      this.usersService.getUserByUsername(username),
      false
    );
  }

  private _loadCurrentUsersProfile(): void {
    const currentAuthUser = this.currentUser();
    if (currentAuthUser?.username) {
      this._initiateProfileLoad(
        this.usersService.getUserByUsername(currentAuthUser.username).pipe(
          tap(user => {
            if (user) {
              this.authService.currentUserSignal.set(user);
            }
          })
        ),
        true // This is definitively the user's own profile
      );
    } else {
      this.isLoading.set(false);
      this.error.set('You must be logged in to view your profile.');
      this.router.navigate(['/auth/login']);
    }
  }

  private _initiateProfileLoad(user$: Observable<User | null>, isAssumedOwnProfile: boolean): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.userCheeks.set([]);
    this.profileUser.set(null);

    user$.pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap(user => {
        if (!user || !user.id) {
          this.error.set('User not found or error loading profile.');
          this.profileUser.set(null);
          console.error('Error loading profile: User data is invalid or missing ID.', user);
          return of(null);
        }
        this.profileUser.set(user);
        // If it was assumed to be own profile, this.isOwnProfile() computed signal will update.
        // If loading by username, this.isOwnProfile() will re-evaluate once profileUser is set.
        return this._fetchUserCheeks(user.id).pipe(
          switchMap(() => of(user)),
          catchError(cheeksError => {
            console.error('Error loading user cheeks, but profile data was loaded:', cheeksError);
            return of(user);
          })
        );
      }),
      catchError(err => {
        console.error('Error in profile loading pipeline:', err);
        this.error.set('An unexpected error occurred while loading the profile.');
        this.profileUser.set(null);
        this.userCheeks.set([]);
        return of(null);
      }),
      finalize(() => {
        this.isLoading.set(false);
      })
    ).subscribe();
  }

  private _fetchUserCheeks(userId: string): Observable<Cheek[]> {
    return this.cheeksService.getCheeksByUserId(userId).pipe(
      tap((cheeks: Cheek[]) => {
        this.userCheeks.set(cheeks);
      }),
      catchError(err => {
        console.error('Error loading user cheeks:', err);
        this.userCheeks.set([]); // Set to empty on error
        this.error.set((this.error() ? this.error() + ' ' : '') + 'Could not load cheeks.'); // Append to existing error or set new
        return of([]);
      })
    );
  }

  // --- Template Helper Methods ---
  // Type guard for template, remains useful
  isUser(owner: any): owner is User {
    return !!owner && typeof owner === 'object' && 'username' in owner;
  }


  getOwnerUsername(owner: User | string): string {
    if (this.isUser(owner)) {
      return owner.username;
    }
    const pUser = this.profileUser();
    if (pUser) {
      return pUser.username;
    }
    return 'Unknown';
  }

  // --- Modal Control Methods ---
  openChangePasswordModal(): void {
    this.showChangePasswordModal.set(true);
  }

  closeChangePasswordModal(): void {
    this.showChangePasswordModal.set(false);
  }

  handlePasswordChanged(): void {
    this.closeChangePasswordModal();
  }

  openDeleteAccountModal(): void {
    this.showDeleteAccountModal.set(true);
  }

  closeDeleteAccountModal(): void {
    this.showDeleteAccountModal.set(false);
  }

  handleAccountDeleted(): void {
    this.closeDeleteAccountModal();
  }
}