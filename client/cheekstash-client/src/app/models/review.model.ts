// Based on server/src/reviews/schemas/review.schema.ts
export interface Review {
    _id: string;
    cheekId: string;
    userId: string;
    rating: number;
    review?: string;
    createdAt?: string;
    updatedAt?: string;
}

// Based on server/src/reviews/dto/create-review.dto.ts
export interface CreateReviewPayload {
    cheekId: string;
    rating: number;
    review?: string;
}

// Based on server/src/reviews/dto/update-review.dto.ts
export interface UpdateReviewPayload {
    rating?: number;
    review?: string;
}
