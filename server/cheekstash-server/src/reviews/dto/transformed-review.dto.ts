// c:\Users\kianj\OneDrive\Documents\EASV\WEB-DEVELOPMENT\2. SEMESTER\project\cheekstash\server\cheekstash-server\src\reviews\dto\transformed-review.dto.ts
export class UserResponseDto {
    _id: string;
    username: string;
}

export class TransformedReviewDto {
    _id: string;
    cheekId: string;
    rating: number;
    review: string;
    createdAt: string;
    updatedAt?: string;
    user: UserResponseDto;
}
