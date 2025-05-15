import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Review, ReviewSchema } from './schemas/review.schema';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { CheeksModule } from '../cheeks/cheeks.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Review.name, schema: ReviewSchema }]),
    CheeksModule,
    UsersModule,
  ],
  providers: [ReviewsService],
  controllers: [ReviewsController],
  exports: [ReviewsService]
})
export class ReviewsModule {}
