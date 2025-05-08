import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category, CategoryDocument } from './schema/category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
    constructor(
        @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    ) { }

    async create(createCategoryDto: CreateCategoryDto): Promise<CategoryDocument> {
        try {
            const newCategory = new this.categoryModel(createCategoryDto);
            return await newCategory.save();
        } catch (error) {
            if (error.code === 11000) { // Duplicate key error
                throw new ConflictException('Category name already exists');
            }
            throw error;
        }
    }

    async findAll(): Promise<CategoryDocument[]> {
        return this.categoryModel.find().exec();
    }

    async findOne(id: string): Promise<CategoryDocument> {
        const category = await this.categoryModel.findById(id).exec();
        if (!category) {
            throw new NotFoundException(`Category with ID "${id}" not found`);
        }
        return category;
    }

    async findOneBySlug(slug: string): Promise<CategoryDocument> {
        const category = await this.categoryModel.findOne({ slug: slug }).exec();
        if (!category) {
            throw new NotFoundException(`Category with slug "${slug}" not found`);
        }
        return category;
    }

    async update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<CategoryDocument> {
        const existingCategory = await this.categoryModel.findById(id).exec();
        if (!existingCategory) {
            throw new NotFoundException(`Category with ID "${id}" not found`);
        }

        if (updateCategoryDto.name && updateCategoryDto.name !== existingCategory.name) {
            const categoryDocWithSameName: CategoryDocument | null = await this.categoryModel.findOne({ name: updateCategoryDto.name }).exec();

            if (categoryDocWithSameName && categoryDocWithSameName._id instanceof Types.ObjectId) {
                if (categoryDocWithSameName._id.toString() !== id) {
                    throw new ConflictException('Category name already exists');
                }
            }
        }
        
        Object.assign(existingCategory, updateCategoryDto);
        return existingCategory.save();
    }

    async remove(id: string): Promise<{ message: string }> {
        const result = await this.categoryModel.findByIdAndDelete(id).exec();
        if (!result) {
            throw new NotFoundException(`Category with ID "${id}" not found`);
        }
        return { message: 'Category deleted successfully' };
    }
}
