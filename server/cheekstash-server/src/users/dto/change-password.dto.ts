import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPass123!', description: 'Current password' })
  @IsNotEmpty()
  oldPassword: string;

  @ApiProperty({ example: 'NewSecurePass456!', description: 'New password' })
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;
}
