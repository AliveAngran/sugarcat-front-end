import COS from 'cos-js-sdk-v5';

// 初始化 COS 实例
const cos = new COS({
  getAuthorization: function (options, callback) {
    fetch('/api/cos/credentials')
      .then(response => response.json())
      .then(data => {
        console.log('Credentials response:', data);
        
        if (!data.success || !data.credentials) {
          throw new Error('Failed to get credentials');
        }

        const credentials = data.credentials;
        const startTime = Math.floor(Date.now() / 1000);
        callback({
          TmpSecretId: credentials.credentials.tmpSecretId,
          TmpSecretKey: credentials.credentials.tmpSecretKey,
          SecurityToken: credentials.credentials.sessionToken,
          StartTime: startTime,
          ExpiredTime: credentials.expiredTime,
        });
      })
      .catch(err => {
        console.error('获取临时密钥失败:', err);
        const startTime = Math.floor(Date.now() / 1000);
        callback({
          TmpSecretId: '',
          TmpSecretKey: '',
          SecurityToken: '',
          StartTime: startTime,
          ExpiredTime: startTime + 1800,
        });
      });
  }
});

// 生成文件名
const generateFileName = (spuId: string, isMainImage: boolean, index?: number): string => {
  // 统一使用jpg格式
  if (isMainImage) {
    return `pics_v2/pic_v2/${spuId}-ZT.jpg`;
  } else {
    return `pics_v2/pic_v2/${spuId}-${index || 0}.jpg`;
  }
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
export const uploadImageToCOS = async (file: File, spuId: string, isMainImage: boolean, index?: number): Promise<string> => {
  // 验证文件类型
  if (!validateFileType(file)) {
    throw new Error('不支持的文件类型，请上传 JPG、PNG、GIF 或 WebP 格式的图片');
  }

  const bucket = 'tangmao-1327435676';
  const region = 'ap-guangzhou';
  
  // 生成文件名
  const fileName = generateFileName(spuId, isMainImage, index);

  // 先删除已存在的图片
  await deleteExistingImage(bucket, region, fileName);

  return new Promise((resolve, reject) => {
    cos.putObject({
      Bucket: bucket,
      Region: region,
      Key: fileName,
      Body: file,
      // 添加缓存控制头
      Headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'PUT,POST,GET,DELETE,HEAD,OPTIONS',
      }
    }, function(err, data) {
      if(err) {
        console.error('上传失败:', err);
        reject(new Error('图片上传失败，请重试'));
      } else {
        console.log('上传成功:', data);
        // 添加时间戳参数来防止缓存
        const timestamp = Date.now();
        const imageUrl = `https://${bucket}.cos.${region}.tencentcos.cn/${fileName}?t=${timestamp}`;
        resolve(imageUrl);
      }
    });
  });
};