import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { CollectionsModule } from './collections/collections.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot(),  // Loads .env file
    MongooseModule.forRoot(process.env.MONGO_URI as string),
    UsersModule, 
    AuthModule, 
    CollectionsModule, 
    ReviewsModule, 
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
