import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceController } from './maintenance.controller';
import { Tag, TagSchema } from '../tags/schema/tag.schema';
import { Cheeks, CheeksSchema } from '../cheeks/schemas/cheek.schema';
// import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Tag.name, schema: TagSchema },
            { name: Cheeks.name, schema: CheeksSchema },
        ]),
        // AuthModule, // if AuthModule provides JwtAuthGuard and RolesGuard globally or exports them.
    ],
    providers: [MaintenanceService],
    controllers: [MaintenanceController],
})
export class MaintenanceModule { }
