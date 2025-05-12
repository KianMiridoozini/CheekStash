import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateTagDto {
    @ApiProperty({
        example: 'artificial-intelligence',
        description: 'The name of the tag. Should be lowercase and hyphenated if multiple words.',
        minLength: 2,
        maxLength: 50,
        pattern: '/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(2)
    @MaxLength(50)
    @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message: 'Tag name must be lowercase, alphanumeric, and can contain hyphens but not start/end with them or have consecutive hyphens.',
    })
    name: string;
}
