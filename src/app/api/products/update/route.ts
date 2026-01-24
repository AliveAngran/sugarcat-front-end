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
    
    // 构建更新对象，只包含有值的字段
    const updateData: Record<string, any> = {
      updateTime: new Date()
    };

    // 基本信息
    if (product.title !== undefined) updateData.title = product.title;
    if (product.etitle !== undefined) updateData.etitle = product.etitle;
    if (product.desc !== undefined) updateData.desc = product.desc;
    if (product.brand !== undefined) updateData.brand = product.brand;
    if (product.unit !== undefined) updateData.unit = product.unit;
    if (product.shelfLife !== undefined) updateData.shelfLife = product.shelfLife;
    if (product.origin !== undefined) updateData.origin = product.origin;

    // 价格信息
    if (product.price !== undefined) {
      updateData.price = product.price;
      updateData.minSalePrice = product.price;
    }
    if (product.originPrice !== undefined) {
      updateData.originPrice = product.originPrice;
      updateData.maxLinePrice = product.originPrice;
    }
    if (product.minBuyNum !== undefined) updateData.minBuyNum = product.minBuyNum;

    // 图片 - 只有当明确提供时才更新
    if (product.primaryImage !== undefined) updateData.primaryImage = product.primaryImage;
    if (product.images !== undefined && Array.isArray(product.images)) {
      updateData.images = product.images;
    }

    // 状态和分类
    if (product.available !== undefined) updateData.available = product.available;
    if (product.isPutOnSale !== undefined) updateData.isPutOnSale = product.isPutOnSale;
    if (product.buyAtMultipleTimes !== undefined) updateData.buyAtMultipleTimes = product.buyAtMultipleTimes;
    if (product.categoryIds !== undefined) updateData.categoryIds = product.categoryIds;

    // 更新数据库
    await db.collection('spu_db')
      .doc(product._id)
      .update(updateData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新商品失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: '更新失败' 
    }, { status: 500 });
  }
} 