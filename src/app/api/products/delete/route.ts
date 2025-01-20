import { NextResponse } from 'next/server';
import { cloudbase } from '@/utils/cloudbase-admin';

export async function POST(request: Request) {
  try {
    const { productId } = await request.json();
    
    if (!productId) {
      return NextResponse.json({ 
        success: false, 
        error: '商品ID不能为空' 
      }, { status: 400 });
    }

    const db = cloudbase.database();
    await db.collection('spu_db').doc(productId).remove();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除商品失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: '删除失败' 
    }, { status: 500 });
  }
} 