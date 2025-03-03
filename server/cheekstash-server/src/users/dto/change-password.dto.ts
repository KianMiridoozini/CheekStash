import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'SecurePass123!', description: 'Current password' })
  @IsNotEmpty()
  oldPassword: string;

  @ApiProperty({ example: 'NewSecurePass123!', description: 'New password' })
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;
}
