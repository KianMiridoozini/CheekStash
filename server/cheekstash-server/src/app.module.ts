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
import { CategoriesModule } from './categories/categories.module'; // Import CategoriesModule
import { TagsModule } from './tags/tags.module'; // Import TagsModule

@Module({
  imports: [
    ConfigModule.forRoot({
      // Load .env.test if NODE_ENV is 'test', otherwise load .env
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
      ignoreEnvFile: process.env.CI === 'true', // Ignore .env file in CI
      isGlobal: true, 
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const uri = configService.get<string>('DATABASE_URI');
        if (process.env.CI === 'true') {
          // console.log(`[CI LOG] Attempting to connect with DATABASE_URI: ${uri ? uri.replace(/:([^:@\/]+)@/, ':<password>@') : 'undefined'}`);
        }
        if (!uri) {
          throw new Error('DATABASE_URI is not defined. Check environment variables and .env file loading.');
        }
        return {
          uri: uri,
        };
      },
      inject: [ConfigService],
    }),
    UsersModule, 
    AuthModule, 
    CheeksModule, 
    ReviewsModule, 
    CategoriesModule,
    TagsModule,
    CronModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
