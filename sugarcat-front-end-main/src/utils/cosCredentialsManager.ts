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
  private refreshAttempts: number = 0;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY = 5000; // 5 seconds
  private readonly REFRESH_BUFFER = 300; // 5 minutes before expiry
  private initialized: boolean = false;

  private constructor() {}

  public static getInstance(): COSCredentialsManager {
    if (!COSCredentialsManager.instance) {
      COSCredentialsManager.instance = new COSCredentialsManager();
    }
    return COSCredentialsManager.instance;
  }

  public init(): void {
    if (this.initialized) {
      console.log('[COS] Already initialized');
      return;
    }

    console.log('[COS] Initializing COS Credentials Manager');
    
    if (typeof window !== 'undefined') {
      // 页面卸载时清理
      window.addEventListener('beforeunload', () => this.clearCredentials());
      
      // 页面可见性改变时处理
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          console.log('[COS] Page became visible, refreshing credentials');
          this.refreshCredentials();
        }
      });

      // 初始化时立即获取凭证
      console.log('[COS] Initial credentials refresh');
      this.refreshCredentials();
    }

    this.initialized = true;
  }

  public async getCredentials(): Promise<COSCredentials> {
    const now = Math.floor(Date.now() / 1000);
    
    // 如果凭证不存在或即将过期，获取新凭证
    if (!this.credentials || now >= this.expiredTime - this.REFRESH_BUFFER) {
      await this.refreshCredentials();
    }
    
    return this.credentials!;
  }

  private async refreshCredentials(isRetry: boolean = false): Promise<void> {
    try {
      console.log(`[COS] Refreshing credentials. Attempt ${this.refreshAttempts + 1}`);
      
      const response = await fetch('/api/cos/credentials', {
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        }
      });
      const data: CredentialsResponse = await response.json();

      if (!data.success || !data.credentials) {
        throw new Error(data.error || 'Failed to get credentials');
      }

      this.credentials = data.credentials.credentials;
      this.expiredTime = data.credentials.expiredTime;
      this.refreshAttempts = 0; // 重置重试次数

      console.log(`[COS] Credentials refreshed successfully. Expires at: ${new Date(this.expiredTime * 1000).toISOString()}`);

      // 设置下一次刷新的定时器
      this.scheduleNextRefresh();

    } catch (error) {
      console.error('[COS] Failed to refresh credentials:', error);
      
      // 重试逻辑
      if (this.refreshAttempts < this.MAX_RETRY_ATTEMPTS) {
        this.refreshAttempts++;
        console.log(`[COS] Retrying in ${this.RETRY_DELAY}ms... (Attempt ${this.refreshAttempts})`);
        
        setTimeout(() => {
          this.refreshCredentials(true);
        }, this.RETRY_DELAY);
      } else {
        this.refreshAttempts = 0;
        throw new Error('Max retry attempts reached for refreshing credentials');
      }
    }
  }

  private scheduleNextRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    const now = Math.floor(Date.now() / 1000);
    const refreshIn = (this.expiredTime - this.REFRESH_BUFFER - now) * 1000;
    
    // 确保刷新时间不会太短
    const minimumRefreshDelay = 1000; // 1 second minimum
    const actualRefreshIn = Math.max(refreshIn, minimumRefreshDelay);

    console.log(`[COS] Scheduling next refresh in ${actualRefreshIn / 1000} seconds`);

    this.refreshTimer = setTimeout(() => {
      console.log('[COS] Timer triggered, starting refresh');
      this.refreshCredentials();
    }, actualRefreshIn);
  }

  public clearCredentials(): void {
    console.log('[COS] Clearing credentials and canceling timer');
    this.credentials = null;
    this.expiredTime = 0;
    this.refreshAttempts = 0;
    
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // 添加用于测试的方法
  public getDebugInfo(): object {
    return {
      hasCredentials: !!this.credentials,
      expiredTime: this.expiredTime,
      refreshAttempts: this.refreshAttempts,
      hasActiveTimer: !!this.refreshTimer,
      timeUntilExpiry: this.expiredTime - Math.floor(Date.now() / 1000)
    };
  }
}

// 导出实例和初始化函数
const cosManager = COSCredentialsManager.getInstance();
export const initCOSManager = () => cosManager.init();
export default cosManager;
