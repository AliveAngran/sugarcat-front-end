import { NextResponse } from 'next/server';
import { cloudbase } from '@/utils/cloudbase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const db = cloudbase.database();
    const result = await db.collection('spu_db')
      .orderBy('createTime', 'asc')
      .limit(2000)
      .get();

    return NextResponse.json({ 
      success: true, 
      data: result.data 
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('获取商品列表失败:', error);
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 });
  }
} 