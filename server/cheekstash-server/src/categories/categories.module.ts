import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { Category, CategorySchema } from './schema/category.schema';
import { AuthModule } from '../auth/auth.module'; 

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Category.name, schema: CategorySchema }]),
        AuthModule, 
    ],
    controllers: [CategoriesController],
    providers: [CategoriesService],
    exports: [CategoriesService], 
})
export class CategoriesModule { }
