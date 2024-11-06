import { NextResponse } from 'next/server';
import { cloudbase } from '@/utils/cloudbase-admin';

export async function POST(request: Request) {
  try {
    const product = await request.json();
    
    if (!product._id) {
      return NextResponse.json({ 
        success: false, 
        error: '商品ID不能为空' 
      }, { status: 400 });
    }

    const db = cloudbase.database();
    
    await db.collection('spu_db')
      .doc(product._id)
      .update({
        title: product.title,
        etitle: product.etitle,
        price: product.price,
        originPrice: product.originPrice,
        desc: product.desc,
        minBuyNum: product.minBuyNum,
        unit: product.unit,
        shelfLife: product.shelfLife,
        origin: product.origin,
        brand: product.brand,
        primaryImage: product.primaryImage,
        images: product.images,
        available: product.available,
        isPutOnSale: product.isPutOnSale,
        buyAtMultipleTimes: product.buyAtMultipleTimes,
        categoryIds: product.categoryIds,
        updateTime: new Date()
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新商品失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: '更新失败' 
    }, { status: 500 });
  }
} 