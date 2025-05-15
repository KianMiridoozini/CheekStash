import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateCheekVisibilityDto {
    @IsBoolean()
    @IsNotEmpty()
    isPublic: boolean;
}
