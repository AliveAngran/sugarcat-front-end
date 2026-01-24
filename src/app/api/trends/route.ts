import { NextResponse } from 'next/server';
import { cloudbase } from '@/utils/cloudbase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 30;

export async function GET() {
  try {
    const db = cloudbase.database();
    const _ = db.command;
    
    // 计算180天前的日期
    const now = new Date();
    const days180AgoTimestamp = now.getTime() - 180 * 24 * 60 * 60 * 1000;
    
    console.log('[Trends API] 开始获取180天订单数据...');
    
    // 分页获取所有订单数据
    const PAGE_SIZE = 200;
    let allOrders: any[] = [];
    let hasMore = true;
    let currentPage = 0;

    while (hasMore) {
      const ordersResult = await db.collection('orders')
        .where({
          orderStatus: _.in([10, 40, 50])
        })
        .skip(currentPage * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .get();

      if (ordersResult.data.length === 0) {
        hasMore = false;
      } else {
        allOrders = allOrders.concat(ordersResult.data);
        currentPage++;
        console.log(`[Trends API] 已获取 ${allOrders.length} 条订单...`);
      }

      // 安全检查，防止无限循环
      if (currentPage > 100) {
        break;
      }
    }
    
    console.log(`[Trends API] 总共获取 ${allOrders.length} 条订单`);
    
    // 过滤180天内的订单
    allOrders = allOrders.filter(order => {
      const orderTime = new Date(order.createTime).getTime();
      return orderTime >= days180AgoTimestamp;
    });
    
    console.log(`[Trends API] 180天内订单: ${allOrders.length} 条`);

    // 生成180天的日期数组
    const dates: string[] = [];
    for (let i = 179; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      dates.push(date.toISOString().split('T')[0]);
    }

    // 按日期统计订单数和销售金额
    const dailyStats = allOrders.reduce((acc, order) => {
      const date = new Date(order.createTime).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { orderCount: 0, salesAmount: 0 };
      }
      acc[date].orderCount += 1;
      acc[date].salesAmount += order.paymentAmount || 0;
      return acc;
    }, {} as Record<string, { orderCount: number; salesAmount: number }>);

    // 格式化数据
    const trendData = dates.map(date => ({
      date,
      orderCount: dailyStats[date]?.orderCount || 0,
      salesAmount: dailyStats[date]?.salesAmount || 0
    }));

    // 计算汇总数据
    const totalOrders = trendData.reduce((sum, d) => sum + d.orderCount, 0);
    const totalSales = trendData.reduce((sum, d) => sum + d.salesAmount, 0);
    const avgDailyOrders = totalOrders / 180;
    const avgDailySales = totalSales / 180;

    return NextResponse.json({
      success: true,
      data: {
        trendData,
        summary: {
          totalOrders,
          totalSales,
          avgDailyOrders: Math.round(avgDailyOrders * 100) / 100,
          avgDailySales: Math.round(avgDailySales)
        }
      }
    });
  } catch (error) {
    console.error('获取趋势数据失败:', error);
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 });
  }
}
