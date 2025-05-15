import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsIn } from 'class-validator';

export class UpdateUserRoleDto {
    @ApiProperty({ enum: ['user', 'admin'], example: 'admin', description: 'The new role for the user' })
    @IsString()
    @IsIn(['user', 'admin'])
    role: 'user' | 'admin';
}