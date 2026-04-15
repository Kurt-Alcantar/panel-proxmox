import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import * as jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'

const KEYCLOAK_INTERNAL_URL = process.env.KEYCLOAK_INTERNAL_URL || 'http://keycloak:8080'
const REALM = process.env.KEYCLOAK_REALM || 'master'

const client = jwksClient({
  jwksUri: `${KEYCLOAK_INTERNAL_URL}/realms/${REALM}/protocol/openid-connect/certs`,
})

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  client.getSigningKey(header.kid as string, function (err, key) {
    if (err || !key) {
      callback(err || new Error('Signing key not found'), undefined)
      return
    }
    callback(null, key.getPublicKey())
  })
}

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const authHeader = request.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token')
    }

    const token = authHeader.split(' ')[1]

    return new Promise((resolve, reject) => {
      jwt.verify(token, getKey, { algorithms: ['RS256'] }, (err, decoded) => {
        if (err || !decoded) {
          return reject(new UnauthorizedException('Invalid token'))
        }
        request.user = decoded
        resolve(true)
      })
    })
  }
}
