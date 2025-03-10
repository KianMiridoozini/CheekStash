import { PartialType } from '@nestjs/swagger';
import { CheeksDto } from './cheeks.dto';

export class UpdateCheeksDto extends PartialType(CheeksDto) {}
