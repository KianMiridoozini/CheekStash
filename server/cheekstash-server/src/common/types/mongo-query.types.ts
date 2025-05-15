import { Types } from 'mongoose';

// Defines the possible leaf values in a MongoDB query
export type MongoLeafValue = string | number | boolean | Date | Types.ObjectId | RegExp | null;

// Defines the structure for MongoDB operators like $in, $regex, etc.
export interface MongoOperatorValue {
    $search?: string;
    $in?: MongoLeafValue[] | Types.ObjectId[];
    $ne?: MongoLeafValue | Types.ObjectId;
    $regex?: RegExp;
    $avg?: string;
    $sum?: number;
}

// Represents a MongoDB query object. It can be a simple field-value pair,
// an operator expression, or a logical combination of other queries.
export interface MongoQuery {
    [key: string]: MongoLeafValue | MongoLeafValue[] | MongoOperatorValue | MongoQuery[] | MongoQuery | undefined;
    $or?: MongoQuery[];
    $and?: MongoQuery[];
    $text?: { $search: string };
    // Allow specific schema fields for better type checking on top-level conditions
    title?: MongoLeafValue | MongoOperatorValue;
    description?: MongoLeafValue | MongoOperatorValue;
    isPublic?: boolean;
    owner?: Types.ObjectId;
    categoryId?: MongoLeafValue | MongoOperatorValue;
    tagIds?: MongoLeafValue | MongoOperatorValue;
    slug?: string;
    _id?: MongoLeafValue | MongoOperatorValue | null; // For $group _id in aggregations or general _id queries
    // For aggregation results if this type were reused for that
    averageRating?: MongoOperatorValue | number;
    reviewCount?: MongoOperatorValue | number;
}
