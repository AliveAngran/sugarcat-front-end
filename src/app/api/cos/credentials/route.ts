import { NextResponse } from 'next/server';
import STS from 'qcloud-cos-sts';

// 如果 CredentialData 类型不可用，我们可以定义一个接口
interface CredentialData {
  credentials: {
    tmpSecretId: string;
    tmpSecretKey: string;
    sessionToken: string;
  };
  expiredTime: number;
  startTime: number;
  // 添加其他可能的字段
}

// COS配置
const cosConfig = {
  secretId: process.env.SECRET_ID,
  secretKey: process.env.SECRET_KEY,
  proxy: '',
  durationSeconds: 7200,
  refreshTimeInSeconds: 300, // 提前5分钟刷新
  bucket: process.env.COS_BUCKET || 'tangmao-1327435676',
  region: process.env.COS_REGION || 'ap-guangzhou',
  allowPrefix: '*',
  allowActions: [
    'name/cos:PutObject',
    'name/cos:PostObject',
    'name/cos:GetObject',
    'name/cos:HeadObject',
    'name/cos:OptionsObject',
  ],
} as const;

export async function GET() {
  try {
    // 配置检查
    if (!cosConfig.secretId || !cosConfig.secretKey) {
      return NextResponse.json({
        success: false,
        error: 'COS configuration is incomplete'
      }, { status: 500 });
    }

    // 配置临时密钥生成策略
    const policy = {
      'version': '2.0',
      'statement': [{
        'action': cosConfig.allowActions,
        'effect': 'allow',
        'principal': {'qcs': ['*']},
        'resource': [
          `qcs::cos:${cosConfig.region}:uid/1327435676:${cosConfig.bucket}/*`
        ],
      }],
    };

    // 获取临时密钥
    const result = await new Promise<CredentialData>((resolve, reject) => {
      STS.getCredential({
        secretId: cosConfig.secretId!,
        secretKey: cosConfig.secretKey!,
        proxy: cosConfig.proxy,
        durationSeconds: cosConfig.durationSeconds,
        policy: policy,
      }, (err: Object, data: CredentialData) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });

    // 检查凭证是否已过期
    const now = Math.floor(Date.now() / 1000);
    if (now >= result.expiredTime - cosConfig.refreshTimeInSeconds) {
      return NextResponse.json({ 
        success: false, 
        error: 'Credentials expired'
      }, { 
        status: 401,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      });
    }
    console.log("cos result", result);
    return NextResponse.json({ 
      success: true, 
      credentials: result
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error: unknown) {
    console.error('获取临时密钥失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  }
} 