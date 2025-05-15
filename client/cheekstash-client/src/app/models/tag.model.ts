// Based on server/src/tags/schema/tag.schema.ts
export interface Tag {
    _id: string;
    name: string;
    usageCount?: number;
    createdAt?: string;
    updatedAt?: string;
}

// Based on server/src/tags/dto/create-tag.dto.ts
export interface CreateTagPayload {
    name: string;
}