import { NextResponse } from 'next/server';
import { cloudbase } from '@/utils/cloudbase-admin';

export async function POST(request: Request) {
  try {
    const product = await request.json();
    
    // 使用管理员权限的 SDK
    const db = cloudbase.database();
    
    // 更新商品信息
    await db.collection('spu_db')
      .doc(product._id)
      .update({
        title: product.title,
        price: product.price,
        originPrice: product.originPrice,
        desc: product.desc,
        minBuyNum: product.minBuyNum,
        unit: product.unit,
        shelfLife: product.shelfLife,
        origin: product.origin,
        brand: product.brand,
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新商品失败:', error);
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 });
  }
} 