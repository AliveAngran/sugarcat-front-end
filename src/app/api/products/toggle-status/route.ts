import { NextResponse } from 'next/server';
import { cloudbase } from '@/utils/cloudbase-admin';

export async function POST(request: Request) {
  try {
    const { productId, newStatus } = await request.json();

    if (!productId || typeof newStatus !== 'number' || (newStatus !== 0 && newStatus !== 1)) {
      return NextResponse.json({
        success: false,
        error: '无效的请求参数：缺少 productId 或 newStatus 无效（必须为 0 或 1）',
      }, { status: 400 });
    }

    const db = cloudbase.database();
    const _ = db.command; // 获取命令对象

    // 更新数据库中的商品状态
    const updateResult = await db.collection('spu_db')
      .doc(productId)
      .update({
        isPutOnSale: newStatus,
        updateTime: new Date(), // 同时更新修改时间
      });

    if (updateResult.updated === 0) {
       return NextResponse.json({
        success: false,
        error: '未找到对应的商品或状态无需更新',
      }, { status: 404 });
    }


    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('切换商品状态失败:', error);
    // 检查是否是数据库错误或其他类型的错误
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json({
      success: false,
      error: `切换商品状态失败: ${errorMessage}`,
    }, { status: 500 });
  }
}
