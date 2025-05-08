import { NotFoundException } from '@nestjs/common';

export function assertUserFound<T>(user: T | null | undefined): asserts user is T {
    if (!user) throw new NotFoundException('User not found');
}