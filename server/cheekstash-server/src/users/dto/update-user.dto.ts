import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, MinLength, MaxLength, IsString, IsUrl } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'John Doe', description: 'Display name' })
  @IsOptional()
  @MinLength(3)
  @MaxLength(50)
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ example: 'I love collecting links!', description: 'User bio' })
  @IsOptional()
  @MaxLength(250)
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png', description: 'Profile image URL' })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}
