import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmPasswordDto {
  @ApiProperty({ example: 'SecurePass123!', description: 'User password for confirmation' })
  @IsString({ message: 'Password must be a string' }) 
  @IsNotEmpty({ message: 'Password should not be empty' })
  password: string;
}