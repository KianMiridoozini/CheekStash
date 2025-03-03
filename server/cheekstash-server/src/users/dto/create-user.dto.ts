import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Test_Bunny', description: 'Unique username' })
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(20)
  username: string;

  @ApiProperty({ example: 'test@bunny.com', description: 'Valid email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass123!', description: 'User password' })
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}
