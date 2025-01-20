import axios from 'axios';
import COS from 'cos-nodejs-sdk-v5';

interface COSCredentials {
  credentials: {
    tmpSecretId: string;
    tmpSecretKey: string;
    sessionToken: string;
  };
  expiredTime: number;
  startTime: number;
}

export const uploadBufferToCOS = async (buffer: Buffer, fileName: string): Promise<{ url: string }> => {
  try {
    // 1. 获取临时密钥
    const credentialsResponse = await axios.get('http://localhost:3000/api/cos/credentials');
    const { credentials } = credentialsResponse.data;

    if (!credentials || !credentials.credentials) {
      throw new Error('Failed to get COS credentials');
    }

    // 2. 初始化 COS 实例
    const cos = new COS({
      SecretId: credentials.credentials.tmpSecretId,
      SecretKey: credentials.credentials.tmpSecretKey,
      SecurityToken: credentials.credentials.sessionToken,
      FileParallelLimit: 3,
      ChunkParallelLimit: 8,
      ChunkSize: 1024 * 1024 * 8,
    });

    const bucket = process.env.NEXT_PUBLIC_COS_BUCKET || 'tangmao-1327435676';
    const region = process.env.NEXT_PUBLIC_COS_REGION || 'ap-guangzhou';

    // 3. 上传文件
    return new Promise((resolve, reject) => {
      cos.putObject(
        {
          Bucket: bucket,
          Region: region,
          Key: fileName,
          Body: buffer,
          ContentType: 'image/jpeg',
          onProgress: (progressData) => {
            console.log('上传进度:', JSON.stringify(progressData));
          }
        },
        (err, data) => {
          if (err) {
            console.error('COS上传错误:', err);
            reject(new Error(`COS上传失败: ${err.message}`));
            return;
          }

          // 4. 生成访问 URL
          const baseUrl = `https://${bucket}.cos.${region}.myqcloud.com/${fileName}`;
          const timestamp = Date.now();
          resolve({ url: `${baseUrl}?t=${timestamp}` });
        }
      );
    });
  } catch (error: any) {
    console.error('上传过程发生错误:', error);
    throw error; 
  }
};