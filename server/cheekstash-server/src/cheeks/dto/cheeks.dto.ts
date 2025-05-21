import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, ArrayMinSize , ValidateNested , IsBoolean, IsArray, IsOptional, IsMongoId, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { LinkDto } from './link.dto';

export class CheeksDto {
  @ApiProperty({
    example: 'Best AI Tools',
    description: 'Title of the Cheeks',
  })
  @IsString()
  title: string;

  @ApiProperty({
    example: 'A curated list of useful AI tools for startups',
    description: 'Cheeks description',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: '647f1a2e3c4d5e6f7g8h9i0j',
    description: 'Category ID of the Cheeks',
  })
  @IsMongoId()
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty({
    example: ['artificial-intelligence', 'machine-learning'],
    description: 'Tag names for the Cheeks. Tags will be created if they don\'t exist.',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagNames?: string[];

  @ApiProperty({
    example: true,
    description: 'Privacy setting: true for public, false for private',
  })
  @IsBoolean()
  isPublic: boolean;

  @ApiProperty({
    type: [LinkDto],
    description: 'Array of link objects. Must contain at least 2 links.',
    example: [
      {
        url: 'https://chat.openai.com',
        title: 'ChatGPT',
        description: 'AI-powered chatbot',
        order: 0,
      },
      {
        url: 'https://huggingface.co',
        title: 'Hugging Face',
        description: 'Repository of ML models',
        order: 1,
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(2, { message: 'A Cheeks must contain at least 2 links.' })
  @ValidateNested({ each: true })
  @Type(() => LinkDto)
  links: LinkDto[];
}
