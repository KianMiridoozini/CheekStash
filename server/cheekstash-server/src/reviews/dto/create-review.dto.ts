import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min, Max, MaxLength } from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ example: '65d5f48e9d3b8f0015a1b3c2', description: 'Cheek ID being reviewed' })
  @IsNotEmpty()
  cheekId: string;

  @ApiProperty({ example: 5, description: 'Rating (1-5)' })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ example: 'Great collection of AI tools!', description: 'Review text (optional)' })
  @IsString()
  @MaxLength(500)
  review?: string;
}
