import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min, Max, MaxLength } from 'class-validator';

export class UpdateReviewDto {
  @ApiProperty({ example: 4, description: 'Updated rating (1-5)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiProperty({ example: 'Updated review text.', description: 'Updated review (optional)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  review?: string;
}
