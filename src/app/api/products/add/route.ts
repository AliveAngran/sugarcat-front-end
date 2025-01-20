import { NextResponse } from 'next/server';
import cloud from '@cloudbase/node-sdk';

// 初始化云开发
const app = cloud.init({
  env: process.env.NEXT_PUBLIC_ENV_ID as string,
  secretId: process.env.TCB_SECRET_ID as string,
  secretKey: process.env.TCB_SECRET_KEY as string,
});

// 打印环境变量以进行调试（之后可以删除）
console.log('ENV_ID:', process.env.NEXT_PUBLIC_ENV_ID);
console.log('SECRET_ID exists:', !!process.env.TCB_SECRET_ID);
console.log('SECRET_KEY exists:', !!process.env.TCB_SECRET_KEY);

export async function POST(request: Request) {
  try {
    const product = await request.json();
    
    // 获取数据库实例
    const db = app.database();
    
    // 验证必填字段
    if (!product.title || !product.spuId) {
      return NextResponse.json({
        success: false,
        error: '商品名称和编码为必填项'
      }, { status: 400 });
    }

    // 检查商品编码是否已存在
    const { data: existingProducts } = await db
      .collection('spu_db')
      .where({
        spuId: product.spuId
      })
      .get();

    if (existingProducts.length > 0) {
      return NextResponse.json({
        success: false,
        error: '商品编码已存在'
      }, { status: 400 });
    }

    // 设置默认值
    const newProduct = {
      ...product,
      available: product.available || 1000000,
      isPutOnSale: product.isPutOnSale || 1,
      buyAtMultipleTimes: product.buyAtMultipleTimes ?? true,
      createTime: new Date(),
      updateTime: new Date(),
      soldNum: 0,
      priority: 0
    };

    // 添加到数据库
    const { id } = await db.collection('spu_db').add(newProduct);

    return NextResponse.json({
      success: true,
      data: { _id: id, ...newProduct }
    });

  } catch (error) {
    console.error('添加商品失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '添加商品失败'
    }, { status: 500 });
  }
} 