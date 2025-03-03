import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class ConfirmPasswordDto {
  @ApiProperty({ example: 'SecurePass123!', description: 'User password for confirmation' })
  @IsNotEmpty()
  password: string;
}
