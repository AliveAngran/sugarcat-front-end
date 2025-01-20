import { NextResponse } from 'next/server';
import { cloudbase } from '@/utils/cloudbase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const db = cloudbase.database();
    
    // 获取所有用户数据
    const usersResult = await db.collection('users')
      .limit(2000)
      .get();

    return NextResponse.json({
      success: true,
      data: usersResult.data
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取用户列表失败' },
      { status: 500 }
    );
  }
} 