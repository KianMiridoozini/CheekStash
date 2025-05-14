import { Category } from './category.model';
import { Tag } from './tag.model';
import { User } from './user.model';

// Based on server/src/cheeks/dto/link.dto.ts
export interface Link {
    url: string;
    title: string;
    description?: string;
    order?: number;
    _id?: string;
}

// Based on server/src/cheeks/schemas/cheek.schema.ts and server/src/cheeks/dto/cheeks.dto.ts
export interface Cheek {
    _id: string;
    title: string;
    slug: string;
    description?: string;
    tagIds?: string[];
    tags?: Tag[];
    categoryId: Category;
    owner: User | string;
    isPublic: boolean;
    links: Link[];
    createdAt?: string;
    updatedAt?: string;
    averageRating?: number;
    reviewCount?: number;
}

export interface CreateCheekPayload {
    title: string;
    description?: string;
    categoryId: string;
    tagNames?: string[];
    isPublic: boolean;
    links: Link[];
}

// Based on server/src/cheeks/dto/update-cheeks.dto.ts
export interface UpdateCheekPayload {
    title?: string;
    description?: string;
    categoryId?: string;
    tagNames?: string[];
    isPublic?: boolean;
    links?: Link[];
}

export interface CheekQueryParams {
    searchKeyword?: string;
    categoryIds?: string[];
    tagIds?: string[];
    requestingUserId?: string; 
    // For URL construction with names, not directly sent to backend API
    categoryNames?: string[]; 
    tagNames?: string[];
    page?: number;
    limit?: number; 
}

export interface PaginatedCheeksResponse {
    cheeks: Cheek[];
    totalItems: number;
}
