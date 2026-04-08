import { Controller, Post, Body } from '@nestjs/common';
import axios from 'axios';

@Controller('auth')
export class AuthController {
  @Post('login')
  async login(@Body() body: any) {
    const params = new URLSearchParams();

    params.append('client_id', 'admin-cli');
    params.append('grant_type', 'password');
    params.append('username', body.username);
    params.append('password', body.password);

    const response = await axios.post(
      'http://keycloak:8080/realms/master/protocol/openid-connect/token',
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    return response.data;
  }
  @Post('refresh')
  async refresh(@Body() body: any) {
    const params = new URLSearchParams()
    params.append('client_id', 'admin-cli')
    params.append('grant_type', 'refresh_token')
    params.append('refresh_token', body.refresh_token)

    const response = await axios.post(
      'http://keycloak:8080/realms/master/protocol/openid-connect/token',
      params,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )
    return response.data
  }
}