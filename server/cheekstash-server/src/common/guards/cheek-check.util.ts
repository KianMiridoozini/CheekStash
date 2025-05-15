import { NotFoundException } from '@nestjs/common';
import { CheeksDocument } from '../../cheeks/schemas/cheek.schema';

export function assertCheekFound(
    cheek: CheeksDocument | null | undefined,
    message?: string
): asserts cheek is CheeksDocument {
    if (!cheek) {
        throw new NotFoundException(message || 'Cheek not found.');
    }
}
