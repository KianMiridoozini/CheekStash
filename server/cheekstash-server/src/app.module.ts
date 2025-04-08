import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { CheeksModule } from './cheeks/cheeks.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AuthModule } from './auth/auth.module';
import { CronModule } from './devTools/cron.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      // Load .env.test if NODE_ENV is 'test', otherwise load .env
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
      isGlobal: true, // Make ConfigService available globally
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule], // Import ConfigModule here
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('DATABASE_URI'),
        // Add other Mongoose options if needed
      }),
      inject: [ConfigService], // Inject ConfigService
    }),
    UsersModule, 
    AuthModule, 
    CheeksModule, 
    ReviewsModule, 
    CronModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
