import { NextResponse } from 'next/server';
import { uploadBufferToCOS } from '@/utils/cos-server';
import { db } from '@/utils/cloudbase-server';

export async function POST(request: Request) {
  try {
    const { productId, imageData } = await request.json();

    // 基础参数验证
    if (!productId || !imageData) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 验证图片数据格式
    if (!imageData.startsWith('data:image/')) {
      return NextResponse.json(
        { success: false, error: '无效的图片格式' },
        { status: 400 }
      );
    }

    try {
      // 从 base64 字符串转换为 Buffer
      const matches = imageData.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
      if (!matches) {
        return NextResponse.json(
          { success: false, error: '无效的图片数据' },
          { status: 400 }
        );
      }

      const [, imageType, base64Data] = matches;
      const buffer = Buffer.from(base64Data, 'base64');

      // 验证图片大小（最大 10MB）
      const maxSize = 10 * 1024 * 1024;
      if (buffer.length > maxSize) {
        return NextResponse.json(
          { success: false, error: '图片大小超过限制（最大10MB）' },
          { status: 400 }
        );
      }

      // 生成文件名和路径
      const fileName = `${productId}-JGG.png`;  // 使用大写的 JGG
      const filePath = `pics_v2/pic_JGG/${fileName}`;  // 新的文件路径格式

      // 上传到 COS，传入完整的文件路径
      const { url: imageUrl } = await uploadBufferToCOS(buffer, filePath);

      // 更新数据库
      const productsCollection = db.collection('spu_db');
      await productsCollection.doc(productId).update({
        marginImage: imageUrl,
        updatedAt: new Date()
      });

      return NextResponse.json({
        success: true,
        imageUrl
      });

    } catch (uploadError: any) {
      console.error('上传或处理图片失败:', uploadError);
      return NextResponse.json(
        {
          success: false,
          error: uploadError.message || '上传或处理图片失败'
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('处理请求失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '处理请求失败'
      },
      { status: 500 }
    );
  }
}