// Based on server/src/categories/schema/category.schema.ts
export interface Category {
    _id: string;
    name: string;
    description?: string;
    slug?: string;
    createdAt?: string;
    updatedAt?: string;
}

// Based on server/src/categories/dto/create-category.dto.ts
export interface CreateCategoryPayload {
    name: string;
    description?: string;
}

// Based on server/src/categories/dto/update-category.dto.ts
export interface UpdateCategoryPayload {
    name?: string;
    description?: string;
}
