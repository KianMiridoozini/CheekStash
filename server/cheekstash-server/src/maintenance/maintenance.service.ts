import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, AnyBulkWriteOperation } from 'mongoose';
import { Tag, TagDocument } from '../tags/schema/tag.schema';
import { Cheeks, CheeksDocument } from '../cheeks/schemas/cheek.schema';

@Injectable()
export class MaintenanceService {
    private readonly logger = new Logger(MaintenanceService.name);

    constructor(
        @InjectModel(Tag.name) private tagModel: Model<TagDocument>,
        @InjectModel(Cheeks.name) private cheeksModel: Model<CheeksDocument>,
    ) {}

    async recalculateTagUsageCounts(): Promise<{ message: string, details: any }> {
        this.logger.warn('Starting recalculation of tag usage counts. ENSURE DATABASE IS BACKED UP!');

        try {
            // Step 1: Reset all tag usageCounts to 0
            this.logger.log('Step 1: Resetting all tag usage counts to 0...');
            const resetResult = await this.tagModel.updateMany({}, { $set: { usageCount: 0 } });
            this.logger.log(`Reset ${resetResult.modifiedCount | 0} tags to 0 usage count.`);

            // Step 2: Fetch all cheeks and their tags
            this.logger.log('Step 2: Fetching all cheeks and their associated tagIds...');
            // Only select tagIds to minimize memory usage
            const allCheeks = await this.cheeksModel.find({}, 'tagIds').lean().exec();
            this.logger.log(`Found ${allCheeks.length} cheeks to process.`);

            // Step 3: Aggregate true counts
            this.logger.log('Step 3: Aggregating true tag usage counts...');
            const trueTagCounts = new Map<string, number>();

            for (const cheek of allCheeks) {
                if (cheek.tagIds && cheek.tagIds.length > 0) {
                    for (const tagIdObject of cheek.tagIds) {
                        if (tagIdObject) {
                            const tagId = tagIdObject.toString();
                            trueTagCounts.set(tagId, (trueTagCounts.get(tagId) || 0) + 1);
                        }
                    }
                }
            }
            this.logger.log(`Aggregated counts for ${trueTagCounts.size} unique tags.`);

            // Step 4: Update tags with true counts using bulkWrite for efficiency
            this.logger.log('Step 4: Updating tags with their new calculated usage counts...');
            const bulkOps: AnyBulkWriteOperation[] = []; // Explicitly typed bulkOps with AnyBulkWriteOperation
            for (const [tagId, count] of trueTagCounts.entries()) {
                if (!Types.ObjectId.isValid(tagId)) {
                    this.logger.warn(`Skipping invalid ObjectId for tag during bulk op preparation: ${tagId}`);
                    continue;
                }
                bulkOps.push({
                    updateOne: {
                        filter: { _id: new Types.ObjectId(tagId) },
                        update: { $set: { usageCount: count } },
                    },
                });
            }

            let updatedCount = 0;
            if (bulkOps.length > 0) {
                const bulkWriteResult = await this.tagModel.bulkWrite(bulkOps);
                updatedCount = bulkWriteResult.modifiedCount;
                this.logger.log(`Bulk updated ${updatedCount} tags with new counts.`);
            } else {
                this.logger.log('No tags needed updates based on current cheek data, or no valid tags found to update.');
            }

            const summary = {
                tagsReset: resetResult.modifiedCount | 0,
                cheeksProcessed: allCheeks.length,
                uniqueTagsFoundInCheeks: trueTagCounts.size,
                tagsUpdatedWithNewCounts: updatedCount,
            };
            this.logger.log('Tag usage count recalculation completed successfully.');
            return { message: 'Tag usage counts recalculated successfully.', details: summary };

        } catch (error) {
            this.logger.error('Error during tag usage count recalculation:', error.stack);
            throw new InternalServerErrorException('Failed to recalculate tag usage counts.', error.message);
        }
    }
}
