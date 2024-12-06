import COS from 'cos-js-sdk-v5';

// 初始化 COS 实例
const cos = new COS({
  getAuthorization: async function (options, callback) {
    const fetchCredentials = async (retryCount = 0) => {
      try {
        const response = await fetch('/api/cos/credentials');
        const data = await response.json();
        
        if (!data.success || !data.credentials) {
          throw new Error('Failed to get credentials');
        }

        const credentials = data.credentials;
        const startTime = Math.floor(Date.now() / 1000);
        
        return {
          TmpSecretId: credentials.credentials.tmpSecretId,
          TmpSecretKey: credentials.credentials.tmpSecretKey,
          SecurityToken: credentials.credentials.sessionToken,
          StartTime: startTime,
          ExpiredTime: credentials.expiredTime,
        };
      } catch (err) {
        console.error('获取临时密钥失败:', err);
        
        // 最多重试3次
        if (retryCount < 3) {
          console.log(`重试获取临时密钥 (${retryCount + 1}/3)...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒后重试
          return fetchCredentials(retryCount + 1);
        }
        
        throw err;
      }
    };

    try {
      const credentials = await fetchCredentials();
      callback(credentials);
    } catch (err) {
      console.error('所有重试都失败:', err);
      const startTime = Math.floor(Date.now() / 1000);
      callback({
        TmpSecretId: '',
        TmpSecretKey: '',
        SecurityToken: '',
        StartTime: startTime,
        ExpiredTime: startTime + 1800,
      });
    }
  }
});

// 生成文件名
const generateFileName = (spuId: string, isMainImage: boolean): string => {
  // 统一使用jpg格式
  const fileName = isMainImage 
    ? `pics_v2/pic_v2/${spuId}-ZT.jpg`
    : `pics_v2/pic_v2/${spuId}-${Date.now()}.jpg`;
  
  console.log('Generated fileName:', fileName);
  return fileName;
};

// 验证文件类型
const validateFileType = (file: File): boolean => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  return allowedTypes.includes(file.type);
};

// 删除已存在的图片
const deleteExistingImage = async (bucket: string, region: string, fileName: string): Promise<void> => {
  try {
    await new Promise((resolve, reject) => {
      cos.deleteObject({
        Bucket: bucket,
        Region: region,
        Key: fileName,
      }, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  } catch (error) {
    console.log('删除旧图片失败或图片不存在，继续上传新图片');
  }
};

// 上传图片到COS
export const uploadImageToCOS = async (
  file: File, 
  spuId: string, 
  isPrimary: boolean = false,
  onProgress?: (progress: number) => void
) => {
  // 验证文件类型
  if (!validateFileType(file)) {
    throw new Error('不支持的文件类型，请上传 JPG、PNG、GIF 或 WebP 格式的图片');
  }

  // 使用硬编码的值作为后备
  const bucket = process.env.NEXT_PUBLIC_COS_BUCKET || 'tangmao-1327435676';
  const region = process.env.NEXT_PUBLIC_COS_REGION || 'ap-guangzhou';
  
  // 生成文件名
  const fileName = generateFileName(spuId, isPrimary);
  
  console.log('Upload details:', {
    bucket,
    region,
    fileName,
    spuId,
    isPrimary
  });

  // 先删除已存在的图片
  await deleteExistingImage(bucket, region, fileName);

  return new Promise((resolve, reject) => {
    cos.putObject(
      {
        Bucket: bucket,
        Region: region,
        Key: fileName,
        Body: file,
        onProgress: (info) => {
          // 计算上传进度百分比
          const percent = Math.round((info.loaded / info.total) * 100);
          console.log('Upload progress:', {
            fileName,
            loaded: info.loaded,
            total: info.total,
            percent
          });
          onProgress?.(percent);
        },
      },
      (err, data) => {
        if (err) {
          console.error('Upload error:', err);
          reject(err);
          return;
        }
        
        // 添加时间戳参数来防止缓存
        const timestamp = Date.now();
        const imageUrl = `https://${bucket}.cos.${region}.myqcloud.com/${fileName}?t=${timestamp}`;
        
        console.log('Upload success:', {
          data,
          generatedUrl: imageUrl
        });
        
        resolve(imageUrl);
      }
    );
  });
};