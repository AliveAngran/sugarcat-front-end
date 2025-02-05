import { NextResponse } from 'next/server';
import { cloudbase } from '@/utils/cloudbase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Order {
  _openid: string;
  orderStatus: number;
  payStatus: string;
  paymentAmount: number;
  createTime: Date;
  _id: string;
}

interface User {
  _openid: string;
  userStoreName: string;
}

export async function GET(request: Request) {
  try {
    // 获取startDate参数
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    
    // 如果未选择日期，返回空数据
    if (!startDate) {
      return NextResponse.json({
        success: true,
        participants: [],
        stats: {
          totalStores: 0,
          totalOrders: 0,
          totalAmount: 0
        }
      });
    }

    const startTimestamp = parseInt(startDate);
    console.log('API收到的时间戳:', startTimestamp);
    console.log('对应的日期:', new Date(startTimestamp).toISOString());
    
    const db = cloudbase.database();
    const _ = db.command;
    
    // 使用分页查询获取订单数据
    let allOrders: any[] = [];
    let lastOrderId: string | null = null;
    const limit = 1000;

    while (true) {
      console.log(`正在获取订单数据，当前总数：${allOrders.length}`);
      
      // 构建查询条件
      let query: any = {
        orderStatus: _.in([10, 40, 50]),
        payStatus: 'PAID',
        createTime: _.gte(new Date(startTimestamp)),
        isDeleted: _.or(_.eq(false), _.exists(false))
      };

      // 如果有上一次查询的最后一条记录ID，则从该ID之后开始查询
      if (lastOrderId) {
        query._id = _.gt(lastOrderId);
      }

      const ordersResult = await db.collection('orders')
        .where(query)
        .orderBy('_id', 'asc')
        .limit(limit)
        .get();

      const currentPageOrders = ordersResult.data || [];
      console.log(`当前页获取到${currentPageOrders.length}条订单`);
      
      if (currentPageOrders.length === 0) {
        break;
      }

      allOrders = allOrders.concat(currentPageOrders);
      
      // 记录最后一条记录的ID
      lastOrderId = currentPageOrders[currentPageOrders.length - 1]._id;
    }

    console.log('订单查询结果总数量:', allOrders.length);

    if (allOrders.length === 0) {
      return NextResponse.json({
        success: true,
        participants: [],
        stats: {
          totalStores: 0,
          totalOrders: 0,
          totalAmount: 0
        }
      });
    }

    // 获取所有相关用户的 openid
    const openids = Array.from(new Set(
      allOrders.map(order => order._openid)
    ));

    console.log('唯一用户数量:', openids.length);
    
    // 一次性获取用户信息
    let allUsers: any[] = [];
    const usersResult = await db.collection('users')
      .where({
        _openid: _.in(openids)
      })
      .limit(1000)  // 限制最多获取1000个用户
      .get();

    allUsers = usersResult.data || [];
    console.log('查询到的用户总数量:', allUsers.length);

    // 创建用户信息映射
    const userMap = new Map<string, string>();
    allUsers.forEach((user: User) => {
      if (user._openid && user.userStoreName) {
        userMap.set(user._openid, user.userStoreName);
      }
    });

    console.log('有效用户映射数量:', userMap.size);

    // 按店铺统计订单
    const storeStats = new Map<string, {
      orderCount: number;
      totalAmount: number;
    }>();

    // 处理订单数据
    allOrders.forEach(order => {
      const storeName = userMap.get(order._openid) || '未知店家';
      
      if (!storeStats.has(storeName)) {
        storeStats.set(storeName, {
          orderCount: 0,
          totalAmount: 0
        });
      }

      const stats = storeStats.get(storeName)!;
      stats.orderCount += 1;
      stats.totalAmount += order.paymentAmount || 0;
    });

    console.log('统计店铺数量:', storeStats.size);

    // 转换为参与者列表格式
    const participants = Array.from(storeStats.entries())
      .map(([storeName, stats]) => ({
        userStoreName: storeName,
        orderCount: stats.orderCount,
        totalAmount: stats.totalAmount
      }))
      .sort((a, b) => {
        // 首先按订单数量降序排序
        if (b.orderCount !== a.orderCount) {
          return b.orderCount - a.orderCount;
        }
        // 如果订单数量相同，按总金额降序排序
        return b.totalAmount - a.totalAmount;
      })
      // 过滤掉"未知店家"
      .filter(p => p.userStoreName !== '未知店家');

    console.log('最终有效参与者数量:', participants.length);

    // 计算总体统计数据
    const totalStats = {
      totalStores: participants.length,
      totalOrders: participants.reduce((sum, p) => sum + p.orderCount, 0),
      totalAmount: participants.reduce((sum, p) => sum + p.totalAmount, 0)
    };

    console.log('统计数据:', totalStats);

    return NextResponse.json({
      success: true,
      participants,
      stats: totalStats
    });

  } catch (error) {
    console.error('获取参与者数据失败:', error);
    return NextResponse.json(
      { success: false, error: '获取参与者数据失败' },
      { status: 500 }
    );
  }
} 