import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsArray, IsMongoId, IsNumber, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryCheeksDto {
    @ApiPropertyOptional({ description: 'Search keyword for title or description' })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    searchKeyword?: string;

    @ApiPropertyOptional({
        description: 'Array of category IDs to filter by (can be comma-separated string)',
        type: [String],
    })
    @IsOptional()
    @Transform(({ value }) => {
        if (Array.isArray(value)) {
            return value.filter(
                (item) => typeof item === 'string' && item.trim().length > 0,
            );
        }
        if (typeof value === 'string') {
            return value
                .split(',')
                .map((item) => item.trim())
                .filter((item) => item.length > 0);
        }
        return undefined; // Return undefined if no valid input to allow IsOptional to work as expected
    })
    @IsArray() // Validates that the transformed value is an array
    @IsMongoId({ each: true, message: 'Each categoryId must be a valid Mongo ID' })
    categoryIds?: string[];

    @ApiPropertyOptional({
        description: 'Array of tag IDs to filter by (can be comma-separated string)',
        type: [String],
    })
    @IsOptional()
    @Transform(({ value }) => {
        if (Array.isArray(value)) {
            return value.filter(
                (item) => typeof item === 'string' && item.trim().length > 0,
            );
        }
        if (typeof value === 'string') {
            return value
                .split(',')
                .map((item) => item.trim())
                .filter((item) => item.length > 0);
        }
        return undefined;
    })
    @IsArray()
    @IsMongoId({ each: true, message: 'Each tagId must be a valid Mongo ID' })
    tagIds?: string[];

    @ApiPropertyOptional({ description: 'Page number for pagination', type: Number, default: 1 })
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsNumber()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({ description: 'Number of items per page', type: Number, default: 10 })
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsNumber()
    @Min(1)
    limit?: number;
}
