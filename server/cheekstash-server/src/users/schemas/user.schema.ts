import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema({
  timestamps: true, 
  toJSON: { 
    transform: function (doc, ret, options) {
      delete ret.passwordHash; 
      delete ret.__v;          
      // ret.id = ret._id;    
      // delete ret._id;
      return ret; 
    },
  },

})
export class User {
  @Prop({ required: true, unique: true, trim: true, index: true })
  username: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true, index: true })
  email: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ type: String, enum: ['user', 'admin'], default: 'user' })
  role: string;

  @Prop({ type: Object, default: {} })
  profile: {
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
  };

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  followedUsers: Types.ObjectId[];
}

export const UserSchema = SchemaFactory.createForClass(User);

