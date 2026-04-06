import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const KEYCLOAK_BASE_URL = 'http://192.168.10.163:8080';
const REALM = 'master';

const client = jwksClient({
  jwksUri: `${KEYCLOAK_BASE_URL}/realms/${REALM}/protocol/openid-connect/certs`
});

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  client.getSigningKey(header.kid as string, function (err, key) {
    if (err || !key) {
      callback(err || new Error('Signing key not found'), undefined);
      return;
    }

    callback(null, key.getPublicKey());
  });
}

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    console.log('AUTH HEADER:', authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.split(' ')[1];

    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        {
          algorithms: ['RS256'],
          issuer: `${KEYCLOAK_BASE_URL}/realms/${REALM}`
        },
        (err, decoded) => {
          if (err || !decoded) {
            console.error('JWT verify error:', err);
            return reject(new UnauthorizedException('Invalid token'));
          }

          console.log('JWT OK sub:', (decoded as any).sub);
          request.user = decoded;
          resolve(true);
        }
      );
    });
  }
}