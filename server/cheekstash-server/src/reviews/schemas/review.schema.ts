import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReviewDocument = Review & Document;

@Schema({ timestamps: true })
export class Review {
  @Prop({ type: Types.ObjectId, ref: 'Cheeks', required: true, index: true })
  cheekId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  username: string;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ required: false, trim: true })
  review: string;

  createdAt: Date;
  updatedAt: Date;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

ReviewSchema.index({ cheekId: 1, userId: 1 }, { unique: true });
