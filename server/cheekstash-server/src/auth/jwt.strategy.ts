import { Injectable, Logger } from '@nestjs/common'; // Import Logger
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'defaultSecretKey', // Reverted to original
    });
    // this.logger.log('JwtStrategy initialized.');
    // Log the source of the secret key, but not the key itself for security in production.
    if (process.env.JWT_SECRET) {
      // this.logger.debug('JWT secret key loaded from environment variable.');
    } else {
      // this.logger.debug('JWT secret key using default fallback (ensure this is secure for your environment).');
    }
  }

  async validate(payload: any): Promise<any> {
    // Minimal logging for validation attempt
    // this.logger.debug('Validating JWT payload:', JSON.stringify(payload)); // Can be enabled for deep debugging

    if (!payload || !payload.id || !payload.username || !payload.role) {
      // this.logger.warn('JWT validation failed: Payload missing essential fields (id, username, role).');
      return null; // Or throw an UnauthorizedException
    }

    // Ensure all necessary fields for req.user are returned, especially 'role'
    const userToReturn = {
      id: payload.id,
      username: payload.username,
      email: payload.email,
      role: payload.role, // This was the crucial addition
    };
    // this.logger.debug('JWT payload validated successfully. Returning user object.'); // Can be enabled for deep debugging
    return userToReturn;
  }
}
