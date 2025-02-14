import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  username: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ default: 'user' })
  role: string;

  @Prop({ type: Object, default: {} })
  profile: {
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
  };

  // Optional: for follow/subscribe functionality.
  @Prop({ type: [String], default: [] })
  followedUsers: string[];
}

export const UserSchema = SchemaFactory.createForClass(User);