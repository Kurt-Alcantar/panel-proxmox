import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const client = jwksClient({
  jwksUri: 'http://keycloak:8080/realms/master/protocol/openid-connect/certs'
});

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  client.getSigningKey(header.kid as string, function (err, key) {
    if (err) {
      callback(err, undefined);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

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
          issuer: 'http://192.168.10.163:8080/realms/master'
        },
        (err, decoded) => {
          if (err || !decoded) {
            return reject(new UnauthorizedException('Invalid token'));
          }

          request.user = decoded;
          resolve(true);
        }
      );
    });
  }
}