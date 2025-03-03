import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, ArrayMinSize , ValidateNested , IsBoolean, IsArray, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { LinkDto } from './link.dto';

export class CollectionDto {
  @ApiProperty({
    example: 'Best AI Tools',
    description: 'Title of the collection',
  })
  @IsString()
  title: string;

  @ApiProperty({
    example: 'A curated list of useful AI tools for startups',
    description: 'Collection description',
  })
  @IsString()
  description: string;

  @ApiProperty({
    example: ['AI', 'Machine Learning', 'Productivity'],
    description: 'Tags for the collection',
  })
  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @ApiProperty({
    example: 'Tech',
    description: 'Category of the collection',
  })
  @IsString()
  category: string;

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
  @ArrayMinSize(2, { message: 'A collection must contain at least 2 links.' })
  @ValidateNested({ each: true })
  @Type(() => LinkDto)
  links: LinkDto[];
}
