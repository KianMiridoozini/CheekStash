import { Category } from './category.model';
import { Tag } from './tag.model';
import { User } from './user.model'; // Import the User model

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
    slug: string; // Added slug field as it was added to the backend schema
    description?: string;
    tagIds?: string[];
    tags?: Tag[];
    categoryId: Category;
    owner: User | string; // Changed to User object or string (if only ID is present sometimes)
    isPublic: boolean;
    links: Link[];
    createdAt?: string;
    updatedAt?: string;
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
