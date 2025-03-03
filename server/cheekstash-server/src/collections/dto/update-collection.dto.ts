import { PartialType } from '@nestjs/swagger';
import { CollectionDto } from './collection.dto';

export class UpdateCollectionDto extends PartialType(CollectionDto) {}
