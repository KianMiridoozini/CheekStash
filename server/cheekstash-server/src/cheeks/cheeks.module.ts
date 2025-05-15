import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cheeks, CheeksSchema } from './schemas/cheek.schema';
import { CheeksService } from './cheeks.service';
import { CheeksController } from './cheeks.controller';
import { CategoriesModule } from '../categories/categories.module';
import { TagsModule } from '../tags/tags.module';
import { UsersModule } from '../users/users.module';
import { Review, ReviewSchema } from '../reviews/schemas/review.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cheeks.name, schema: CheeksSchema },
      { name: Review.name, schema: ReviewSchema },
    ]),
    CategoriesModule,
    TagsModule,
    UsersModule,
  ],
  providers: [CheeksService],
  controllers: [CheeksController],
  exports: [CheeksService, MongooseModule.forFeature([{ name: Cheeks.name, schema: CheeksSchema }])],
})
export class CheeksModule {}
