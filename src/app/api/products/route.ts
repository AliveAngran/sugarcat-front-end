import { NextResponse } from 'next/server';
import { cloudbase } from '@/utils/cloudbase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Product {
  _id: string;
  createTime: string;
  [key: string]: any;
}

export async function GET() {
  try {
    const db = cloudbase.database();
    // 使用offset分页方式获取所有商品
    let allProducts: Product[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const result = await db.collection('spu_db')
        .orderBy('createTime', 'asc')
        .skip(offset)
        .limit(1000)
        .get();
        
      console.log('本次获取商品数量:', result.data.length);
      
      allProducts = allProducts.concat(result.data);
      
      if (result.data.length < 1000) {
        hasMore = false;
      } else {
        offset += 1000;
      }
    }

    console.log('获取到的总商品列表:', allProducts.length);

    return NextResponse.json({ 
      success: true, 
      data: allProducts 
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