import { NextResponse } from 'next/server';
import { cloudbase } from '@/utils/cloudbase-admin';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const db = cloudbase.database();
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '1000', 10);
    const skip = parseInt(url.searchParams.get('skip') || '0', 10);

    console.log(`[API] Fetching users: skip=${skip}, limit=${limit}`); // 后端日志

    const usersResult = await db.collection('users')
      .skip(skip)
      .limit(limit)
      .get();

    // 添加详细日志，记录实际从数据库返回的数量
    const actualCount = usersResult.data ? usersResult.data.length : 0;
    console.log(`[API] Cloudbase returned ${actualCount} users for skip=${skip}`);

    return NextResponse.json({
      success: true,
      data: usersResult.data,
      pagination: {
        limit,
        skip,
        returned: actualCount // 使用实际返回的数量
      }
    });
  } catch (error) {
    console.error('[API] 获取用户列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取用户列表失败' },
      { status: 500 }
    );
  }
} 