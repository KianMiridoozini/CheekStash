import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber } from 'class-validator';

export class LinkDto {
  @ApiProperty({ example: 'https://chat.openai.com', description: 'The URL of the link' })
  @IsString()
  url: string;

  @ApiProperty({ example: 'ChatGPT', description: 'The title of the link' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'AI-powered chatbot', description: 'A short description for the link', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 0, description: 'Order/index of the link', required: false })
  @IsOptional()
  @IsNumber()
  order?: number;
}