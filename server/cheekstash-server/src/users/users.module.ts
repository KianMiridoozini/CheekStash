import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { Collection, CollectionSchema } from '../collections/schemas/collection.schema';
import { Review, ReviewSchema } from '../reviews/schemas/review.schema';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { JwtModule } from '@nestjs/jwt';


@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Collection.name, schema: CollectionSchema },
      { name: Review.name, schema: ReviewSchema },
      
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'defaultSecretKey', // Replace with env variable in production
      signOptions: { expiresIn: '1d' },
    }),
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService], 
})
export class UsersModule {}
