import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cheeks, CheeksSchema } from './schemas/cheeks.schema';
import { CheeksService } from './cheeks.service';
import { CheeksController } from './cheeks.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Cheeks.name, schema: CheeksSchema }]),
  ],
  providers: [CheeksService],
  controllers: [CheeksController],
})
export class CheeksModule {}
