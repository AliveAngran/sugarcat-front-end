import { NextResponse } from 'next/server';
import STS from 'qcloud-cos-sts';

const config = {
  secretId: process.env.COS_SECRET_ID,
  secretKey: process.env.COS_SECRET_KEY,
  proxy: '',
  durationSeconds: 1800, // 设置更长的有效期，30分钟
  bucket: 'tangmao-1327435676',
  region: 'ap-guangzhou',
  allowPrefix: 'pics_v2/pic_v2/*', // 按实际目录修改
  allowActions: [
    'name/cos:PutObject',
    'name/cos:PostObject',
    'name/cos:InitiateMultipartUpload',
    'name/cos:ListMultipartUploads',
    'name/cos:ListParts',
    'name/cos:UploadPart',
    'name/cos:CompleteMultipartUpload'
  ],
};

export async function GET() {
  try {
    const policy = {
      version: '2.0',
      statement: [{
        action: config.allowActions,
        effect: 'allow',
        resource: [
          `qcs::cos:${config.region}:uid/${process.env.COS_APP_ID}:${config.bucket}/${config.allowPrefix}`,
        ],
      }],
    };

    const result = await new Promise((resolve, reject) => {
      STS.getCredential(
        {
          secretId: config.secretId,
          secretKey: config.secretKey,
          proxy: config.proxy,
          durationSeconds: config.durationSeconds,
          policy: policy,
        },
        (err, credential) => {
          if (err) {
            reject(err);
          } else {
            resolve(credential);
          }
        },
      );
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取临时密钥失败:', error);
    return NextResponse.json(
      { error: '获取临时密钥失败' },
      { status: 500 }
    );
  }
} 