// src/categories/schemas/category.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose'; // Import HydratedDocument

export type CategoryDocument = HydratedDocument<Category>; // Use HydratedDocument

@Schema({ timestamps: true })
export class Category {
    @Prop({ required: true, unique: true, trim: true, index: true })
    name: string;

    @Prop({ trim: true })
    description?: string;

    @Prop({ unique: true, trim: true, lowercase: true })
    slug?: string; 
}

export const CategorySchema = SchemaFactory.createForClass(Category);

CategorySchema.pre<CategoryDocument>('save', function (next) {
    if (this.isModified('name')) { 
        this.slug = this.name
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w-]+/g, '');
    }
    next();
});