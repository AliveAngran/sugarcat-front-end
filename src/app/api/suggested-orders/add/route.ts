import { NextResponse } from 'next/server';
import { cloudbase } from '@/utils/cloudbase-admin';

export async function POST(request: Request) {
  try {
    const db = cloudbase.database();
    const body = await request.json();

    const { customerId, salespersonId, productsList } = body;

    // Basic validation
    if (!customerId || !salespersonId || !productsList || !Array.isArray(productsList) || productsList.length === 0) {
      return NextResponse.json({
        success: false,
        error: '无效的请求参数'
      }, { status: 400 });
    }

    // Prepare data for insertion
    const newSuggestedOrder = {
      customerId,
      salespersonId,
      productsList,
      status: 'pending', // default status
      createTime: new Date(),
      updateTime: new Date(),
    };
    
    // Add to database
    const { id } = await db.collection('suggested_orders').add(newSuggestedOrder);

    return NextResponse.json({
      success: true,
      data: { suggestionId: id, ...newSuggestedOrder }
    });

  } catch (error) {
    console.error('创建建议订单失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json({
      success: false,
      error: `创建建议订单失败: ${errorMessage}`
    }, { status: 500 });
  }
} 