
import { GPS51ApiResponse } from './types.ts';

export class GPS51Auth {
  private apiUrl: string;
  private username: string;
  private password: string;

  constructor(apiUrl: string, username: string, password: string) {
    this.apiUrl = apiUrl;
    this.username = username;
    this.password = password;
  }

  async login(): Promise<string> {
    console.log("=== GPS51 LOGIN ATTEMPT ===");
    console.log("Login URL:", this.apiUrl);

    const loginPayload = {
      action: 'login',
      username: this.username,
      password: this.password, // Should already be MD5 hashed
      from: 'WEB',
      type: 'USER'
    };

    console.log("Login payload validation:", {
      username: loginPayload.username,
      passwordLength: loginPayload.password.length,
      isValidMD5: /^[a-f0-9]{32}$/.test(loginPayload.password),
      from: loginPayload.from,
      type: loginPayload.type
    });

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginPayload)
    });

    const responseText = await response.text();
    console.log(`GPS51 Login Response:`, {
      status: response.status,
      statusText: response.statusText,
      bodyLength: responseText.length,
      bodyPreview: responseText.substring(0, 200)
    });

    if (!response.ok) {
      throw new Error(`GPS51 login HTTP error: ${response.status} ${response.statusText} - ${responseText}`);
    }

    let loginData: GPS51ApiResponse;
    try {
      loginData = JSON.parse(responseText);
      console.log('GPS51 Login Success:', {
        status: loginData.status,
        message: loginData.message,
        hasToken: !!loginData.token,
        tokenLength: loginData.token?.length || 0
      });
    } catch (parseError) {
      console.error('Failed to parse GPS51 login response:', parseError);
      throw new Error(`Failed to parse login response: ${responseText}`);
    }

    if (loginData.status !== 0 || !loginData.token) {
      const errorMsg = loginData.message || `Login failed with status: ${loginData.status}`;
      console.error('GPS51 login failed:', { status: loginData.status, message: loginData.message });
      throw new Error(errorMsg);
    }

    console.log('GPS51 login successful, token acquired');
    return loginData.token;
  }
}
