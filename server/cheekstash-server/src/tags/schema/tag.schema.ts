// src/tags/schemas/tag.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TagDocument = HydratedDocument<Tag>;

@Schema({ timestamps: true })
export class Tag {
    @Prop({ required: true, unique: true, trim: true, lowercase: true, index: true })
    name: string;

    @Prop({ default: 0 })
    usageCount: number;
}

export const TagSchema = SchemaFactory.createForClass(Tag);