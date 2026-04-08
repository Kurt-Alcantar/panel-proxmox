import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';

interface CreateKeycloakUserInput {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  enabled?: boolean;
}

@Injectable()
export class KeycloakAdminService {
  private readonly baseUrl = process.env.KEYCLOAK_INTERNAL_URL || 'http://keycloak:8080';
  private readonly adminRealm = process.env.KEYCLOAK_ADMIN_REALM || 'master';
  private readonly realm = process.env.KEYCLOAK_REALM || 'master';
  private readonly clientId = process.env.KEYCLOAK_ADMIN_CLIENT_ID || 'admin-cli';
  private readonly username = process.env.KEYCLOAK_ADMIN_USERNAME || process.env.KEYCLOAK_ADMIN || 'admin';
  private readonly password = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';

  private async getAdminAccessToken() {
    const params = new URLSearchParams();
    params.append('client_id', this.clientId);
    params.append('grant_type', 'password');
    params.append('username', this.username);
    params.append('password', this.password);

    try {
      const response = await axios.post(
        `${this.baseUrl}/realms/${this.adminRealm}/protocol/openid-connect/token`,
        params,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      return response.data.access_token as string;
    } catch (error: any) {
      throw new InternalServerErrorException(
        `No se pudo obtener token administrativo de Keycloak: ${
          error?.response?.data?.error_description || error?.message || 'error desconocido'
        }`
      );
    }
  }

  private async findUser(accessToken: string, username: string, email: string) {
    const headers = { Authorization: `Bearer ${accessToken}` };

    const [byUsername, byEmail] = await Promise.all([
      axios.get(`${this.baseUrl}/admin/realms/${this.realm}/users`, {
        headers,
        params: { username, exact: true },
      }),
      axios.get(`${this.baseUrl}/admin/realms/${this.realm}/users`, {
        headers,
        params: { email, exact: true },
      }),
    ]);

    const usernameMatch = Array.isArray(byUsername.data) ? byUsername.data[0] : null;
    const emailMatch = Array.isArray(byEmail.data) ? byEmail.data[0] : null;

    return usernameMatch || emailMatch || null;
  }

  private async resetPassword(accessToken: string, userId: string, password: string) {
    await axios.put(
      `${this.baseUrl}/admin/realms/${this.realm}/users/${userId}/reset-password`,
      {
        type: 'password',
        temporary: false,
        value: password,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  async createOrGetUser(input: CreateKeycloakUserInput) {
    const accessToken = await this.getAdminAccessToken();
    const existing = await this.findUser(accessToken, input.username, input.email);

    if (existing?.id) {
      if (input.password) {
        await this.resetPassword(accessToken, existing.id, input.password);
      }
      return { id: existing.id, created: false };
    }

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/admin/realms/${this.realm}/users`,
        {
          username: input.username,
          email: input.email,
          firstName: input.firstName || '',
          lastName: input.lastName || '',
          enabled: input.enabled ?? true,
          emailVerified: true,
        },
        { headers, validateStatus: (status) => status >= 200 && status < 400 }
      );

      const location = response.headers.location as string | undefined;
      const userId = location?.split('/').pop();

      if (!userId) {
        throw new Error('Keycloak no devolvió el identificador del usuario creado');
      }

      if (input.password) {
        await this.resetPassword(accessToken, userId, input.password);
      }

      return { id: userId, created: true };
    } catch (error: any) {
      throw new InternalServerErrorException(
        `No se pudo crear usuario en Keycloak: ${
          error?.response?.data?.errorMessage ||
          error?.response?.data?.error_description ||
          error?.message ||
          'error desconocido'
        }`
      );
    }
  }
}
