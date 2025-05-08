import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cheeks, CheeksSchema } from './schemas/cheek.schema';
import { CheeksService } from './cheeks.service';
import { CheeksController } from './cheeks.controller';
import { CategoriesModule } from '../categories/categories.module'; 
import { TagsModule } from '../tags/tags.module'; 

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cheeks.name, schema: CheeksSchema },
    ]),
    CategoriesModule, 
    TagsModule, 
  ],
  providers: [CheeksService],
  controllers: [CheeksController],
  exports: [CheeksService],
})
export class CheeksModule {}
