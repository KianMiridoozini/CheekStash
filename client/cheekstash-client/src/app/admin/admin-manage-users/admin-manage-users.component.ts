import { Component, OnInit } from '@angular/core';
import { User } from '../../models/user.model';
import { UsersService } from '../../users/users.service';
import { AuthService } from '../../auth/auth.service'; // Import AuthService

@Component({
  selector: 'app-admin-manage-users',
  templateUrl: './admin-manage-users.component.html',
  styleUrl: './admin-manage-users.component.css',
  standalone: false,
})
export class AdminManageUsersComponent implements OnInit {
  users: User[] = [];
  filteredUsers: User[] = [];
  isLoading = true;
  error: string | null = null;
  currentAdminId: string | null = null; // To store the current admin's ID

  searchTerm: string = '';
  sortProperty: keyof User | 'creationDate' | 'lastLogin' | 'profile.displayName' = 'username';
  sortDirection: 'asc' | 'desc' = 'asc';

  constructor(
    private usersService: UsersService,
    private authService: AuthService // Inject AuthService
  ) { }

  ngOnInit(): void {
    // Get the current admin user's ID
    const currentUser = this.authService.currentUserSignal();
    if (currentUser) {
      this.currentAdminId = currentUser.id;
    }
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading = true;
    this.error = null;
    this.usersService.getAllUsers().subscribe({
      next: (data) => {
        // Ensure all user objects have an 'id' property (map _id to id if necessary)
        this.users = data.map(user => ({ ...user, id: user.id || (user as any)._id }));
        this.applyFiltersAndSorting();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading users:', err);
        this.error = err.message || 'Failed to load users. Please try again.';
        this.isLoading = false;
      }
    });
  }

  applyFiltersAndSorting(): void {
    let tempUsers = [...this.users];

    // Exclude the current admin from the list
    if (this.currentAdminId) {
      tempUsers = tempUsers.filter(user => user.id !== this.currentAdminId);
    }

    // Filtering
    if (this.searchTerm) {
      const lowerSearchTerm = this.searchTerm.toLowerCase();
      tempUsers = tempUsers.filter(user =>
        (user.username && user.username.toLowerCase().includes(lowerSearchTerm)) ||
        (user.email && user.email.toLowerCase().includes(lowerSearchTerm)) ||
        (user.profile?.displayName && user.profile.displayName.toLowerCase().includes(lowerSearchTerm))
      );
    }

    // Sorting
    tempUsers.sort((a, b) => {
      let valA: any;
      let valB: any;

      if (this.sortProperty === 'profile.displayName') {
        valA = a.profile?.displayName?.toLowerCase() || '';
        valB = b.profile?.displayName?.toLowerCase() || '';
      } else if (this.sortProperty === 'creationDate') {
        valA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        valB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      } else if (this.sortProperty === 'lastLogin') {
        valA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0; // Assuming lastLogin maps to updatedAt
        valB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      }
      else {
        valA = (a[this.sortProperty as keyof User] as any)?.toString().toLowerCase() || '';
        valB = (b[this.sortProperty as keyof User] as any)?.toString().toLowerCase() || '';
      }

      let comparison = 0;
      if (valA > valB) {
        comparison = 1;
      } else if (valA < valB) {
        comparison = -1;
      }
      return this.sortDirection === 'asc' ? comparison : comparison * -1;
    });

    this.filteredUsers = tempUsers;
  }

  onSearchTermChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    this.searchTerm = inputElement.value;
    this.applyFiltersAndSorting();
  }

  changeSort(property: keyof User | 'creationDate' | 'lastLogin' | 'profile.displayName'): void {
    if (this.sortProperty === property) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortProperty = property;
      this.sortDirection = 'asc';
    }
    this.applyFiltersAndSorting();
  }

  deleteUser(userId: string, username: string): void {
    if (!userId) {
      this.error = 'Cannot delete user: User ID is missing.';
      console.error('Delete user error: userId is undefined or null', username);
      return;
    }
    if (confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
      this.isLoading = true;
      this.usersService.adminDeleteUser(userId).subscribe({
        next: () => {
          this.users = this.users.filter(user => user.id !== userId);
          this.applyFiltersAndSorting();
          this.isLoading = false;
          // Add success notification/toast: User ${username} deleted successfully.
        },
        error: (err) => {
          this.error = `Failed to delete user ${username}: ${err.message || 'Server error'}`;
          this.isLoading = false;
          // Add error notification/toast
        }
      });
    }
  }

  changeUserRole(userId: string, username: string, newRole: 'user' | 'admin'): void {
    if (!userId) {
      this.error = 'Cannot change role: User ID is missing.';
      console.error('Change role error: userId is undefined or null for user', username);
      return;
    }
  if (confirm(`Are you sure you want to change ${username}'s role to ${newRole}?`)) {
    this.isLoading = true;
    this.usersService.adminUpdateUserRole(userId, newRole).subscribe({
      next: (updatedUser) => {
        const index = this.users.findIndex(user => user.id === userId);
        if (index !== -1) {
          this.users[index] = { ...updatedUser, id: updatedUser.id };
        }
        this.applyFiltersAndSorting();
        this.isLoading = false;
        // Add success notification/toast: Role for ${username} updated to ${newRole}.
      },
      error: (err) => {
        this.error = `Failed to update ${username}'s role: ${err.message || 'Server error'}`;
        this.isLoading = false;
        // Add error notification/toast
      }
    });
  }
}
}
