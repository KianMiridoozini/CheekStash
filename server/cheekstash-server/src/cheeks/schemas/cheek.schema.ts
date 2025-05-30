import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CheeksDocument = Cheeks & Document;

@Schema({ collection: 'cheeks', timestamps: true })
export class Cheeks {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true, index: true })
  slug: string;

  @Prop()
  description: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Tag' }], default: [], index: true })
  tagIds: Types.ObjectId[]; 

  @Prop({ required: true, type: Types.ObjectId, ref: 'Category', index: true })
  categoryId: string | Types.ObjectId;

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

  @Prop({ default: 0 })
  averageRating: number;

  @Prop({ default: 0 })
  reviewCount: number;
}

export const CheeksSchema = SchemaFactory.createForClass(Cheeks);
