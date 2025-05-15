import {
    Injectable,
    CanActivate,
    ExecutionContext,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { CheeksService } from '../../cheeks/cheeks.service'; // Adjust path as needed
import { Types } from 'mongoose';

@Injectable()
export class CheekVisibilityGuard implements CanActivate {
    constructor(private readonly cheeksService: CheeksService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user; // Populated by JwtAuthGuard
        const params = request.params;

        let cheek: { owner: any; isPublic: boolean } | null = null;

        if (params.id || params.cheekId) {
            const cheekId = params.id || params.cheekId;
            if (!Types.ObjectId.isValid(cheekId)) {
                throw new BadRequestException('Invalid Cheek ID format.');
            }
            cheek = await this.cheeksService.findCheekOwnerAndVisibility(cheekId);
        } else if (params.username && params.cheekSlug) {
            const { username, cheekSlug } = params;
            cheek = await this.cheeksService.findCheekOwnerAndVisibilityBySlug(username, cheekSlug);
        } else {
            throw new BadRequestException('Cheek identifier (ID or username/slug) not provided in request parameters.');
        }

        if (!cheek) {
            throw new NotFoundException('Cheek not found.');
        }

        if (cheek.isPublic) {
            return true;
        }

        // If private, only the owner can access
        if (!user || !user.id) {
            // Should not happen if JwtAuthGuard is applied before this guard
            throw new ForbiddenException('Authentication required to access this private cheek.');
        }

        // Ensure cheek.owner is populated and has an _id
        const ownerId = cheek.owner && (cheek.owner as any)._id
            ? (cheek.owner as any)._id.toString()
            : null;

        if (ownerId === user.id) {
            return true;
        }

        throw new ForbiddenException('You do not have permission to access this private cheek.');
    }
}
