// Based on server/src/users/dto/user-response.dto.ts and server/src/users/schemas/user.schema.ts

export interface UserProfile {
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
    profileImagePublicId?: string; // Included for completeness, though primarily server-managed
}

export interface User {
    id: string; // Matches 'id' from UserResponseDto after server transformation from _id
    username: string;
    email: string;
    role: 'user' | 'admin';
    profile?: UserProfile; // Changed from flat properties to a nested object
    // followedUsers?: string[]; // Or User[] if populated
    createdAt?: string;
    updatedAt?: string;
}

// Based on server/src/users/dto/update-user.dto.ts
// This payload remains flat as the server endpoint for PATCH /users/profile expects displayName and bio directly.
export interface UpdateUserProfilePayload {
    displayName?: string;
    bio?: string;
    // avatarUrl is handled by a separate endpoint, so it's not part of this text-update payload.
}

// Based on server/src/users/dto/change-password.dto.ts
export interface ChangePasswordPayload {
    oldPassword: string;
    newPassword: string;
}

// Based on server/src/auth/dto/confirm-password.dto.ts
export interface ConfirmPasswordPayload {
    password: string;
}

export const USERNAME_REGEX = /^[a-zA-Z0-9-]+$/;
export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

// Type guard function to check if a value is a User object
export function isUser(value: any): value is User {
    return !!value && typeof value === 'object' && 'username' in value && 'id' in value;
}
