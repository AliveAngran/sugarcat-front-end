interface COSCredentials {
  tmpSecretId: string;
  tmpSecretKey: string;
  sessionToken: string;
}

interface CredentialsResponse {
  success: boolean;
  credentials: {
    credentials: COSCredentials;
    expiredTime: number;
    startTime: number;
  };
  error?: string;
}

class COSCredentialsManager {
  private static instance: COSCredentialsManager;
  private credentials: COSCredentials | null = null;
  private expiredTime: number = 0;
  private refreshTimer: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): COSCredentialsManager {
    if (!COSCredentialsManager.instance) {
      COSCredentialsManager.instance = new COSCredentialsManager();
    }
    return COSCredentialsManager.instance;
  }

  public async getCredentials(): Promise<COSCredentials> {
    const now = Math.floor(Date.now() / 1000);
    
    // 如果凭证不存在或即将过期，获取新凭证
    if (!this.credentials || now >= this.expiredTime - 300) {
      await this.refreshCredentials();
    }
    
    return this.credentials!;
  }

  private async refreshCredentials(): Promise<void> {
    try {
      const response = await fetch('/api/cos/credentials');
      const data: CredentialsResponse = await response.json();

      if (!data.success || !data.credentials) {
        throw new Error(data.error || 'Failed to get credentials');
      }

      this.credentials = data.credentials.credentials;
      this.expiredTime = data.credentials.expiredTime;

      // 设置定时器在凭证即将过期时刷新
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
      }

      const refreshIn = (this.expiredTime - 300 - Math.floor(Date.now() / 1000)) * 1000;
      this.refreshTimer = setTimeout(() => {
        this.refreshCredentials();
      }, refreshIn);

    } catch (error) {
      console.error('Failed to refresh COS credentials:', error);
      throw error;
    }
  }

  public clearCredentials(): void {
    this.credentials = null;
    this.expiredTime = 0;
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}

export default COSCredentialsManager;
