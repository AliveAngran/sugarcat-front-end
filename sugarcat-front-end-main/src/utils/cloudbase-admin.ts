import tcb from '@cloudbase/node-sdk';

// 初始化管理员 SDK
export const cloudbase = tcb.init({
  env: process.env.NEXT_PUBLIC_ENV_ID as string,
  secretId: process.env.SECRET_ID as string,
  secretKey: process.env.SECRET_KEY as string,
}); 