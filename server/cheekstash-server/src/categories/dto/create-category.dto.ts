import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateCategoryDto {
    @ApiProperty({
        example: 'Web Development',
        description: 'The name of the category',
        minLength: 3,
        maxLength: 100,
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    @MaxLength(100)
    name: string;

    @ApiProperty({
        example: 'Resources and tools for web developers.',
        description: 'An optional description for the category',
        required: false,
        maxLength: 255,
    })
    @IsString()
    @IsOptional()
    @MaxLength(255)
    description?: string;
}
