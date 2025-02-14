import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CollectionDocument = Collection & Document;

@Schema({ timestamps: true })
export class Collection {
  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ required: true })
  category: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  owner: Types.ObjectId;

  @Prop({ default: true })
  isPublic: boolean;

  @Prop({
    type: [
      {
        url: { type: String, required: true },
        title: { type: String, required: true },
        description: { type: String },
        order: { type: Number, default: 0 },
      },
    ],
    default: [],
  })
  links: {
    url: string;
    title: string;
    description?: string;
    order: number;
  }[];
}

export const CollectionSchema = SchemaFactory.createForClass(Collection);
