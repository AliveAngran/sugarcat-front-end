import { NextResponse } from 'next/server';
import { cloudbase } from '@/utils/cloudbase-admin';

export async function GET() {
  try {
    const db = cloudbase.database();
    const result = await db.collection('spu_db')
      .limit(1000)
      .get();

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('获取商品列表失败:', error);
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 });
  }
} 