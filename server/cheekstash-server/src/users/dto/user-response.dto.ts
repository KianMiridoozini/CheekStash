import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: '60d5f48e9d3b8f0015a1b3c2', description: 'User ID' })
  id: string;

  @ApiProperty({ example: 'john_doe', description: 'Unique username' })
  username: string;

  @ApiProperty({ example: 'john@example.com', description: 'Email address' })
  email: string;

  @ApiProperty({ example: 'John Doe', description: 'User display name' })
  displayName?: string;

  @ApiProperty({ example: 'I love collecting links!', description: 'User bio' })
  bio?: string;

  @ApiProperty({ example: 'https://example.com/avatar.png', description: 'Profile image URL' })
  avatarUrl?: string;

  @ApiProperty({ example: 'user', description: 'User role (admin/user)' })
  role: string;
}
