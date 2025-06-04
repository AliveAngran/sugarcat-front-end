import { NextResponse } from 'next/server';
import { cloudbase } from '@/utils/cloudbase-admin';
// import cloud from '@cloudbase/node-sdk'; // 不再需要单独的 cloud 初始化

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 10; // 增加最大执行时间到 60 秒

// // 初始化云开发 - 如果 cloudbase 实例已包含认证，则可能不再需要单独 init
// const app = cloud.init({
//   env: process.env.NEXT_PUBLIC_ENV_ID as string,
//   secretId: process.env.TCB_SECRET_ID as string,
//   secretKey: process.env.TCB_SECRET_KEY as string,
// });

export async function GET(request: Request) {
  try {
    const db = cloudbase.database();
    const _ = db.command;
    const limit = 200; // 固定查询最近 200 条
    
    console.log(`[Orders API] Fetching latest ${limit} orders...`);
    
    // 获取最近的 200 条订单数据
    const ordersResult = await db.collection('orders')
      .orderBy('createTime', 'desc')
      .limit(limit)
      .get();
    
    if (!ordersResult.data || ordersResult.data.length === 0) {
      console.log('[Orders API] No orders found.');
      return NextResponse.json({
        success: true,
        data: [],
        // pagination: { total: 0, current: 1, pageSize: limit, totalPages: 1 } // 可选，如果前端仍需要分页结构
      });
    }
    console.log(`[Orders API] Fetched ${ordersResult.data.length} orders.`);

    // 获取所有相关用户的 openid
    const openids = Array.from(new Set(ordersResult.data.map((order: any) => order._openid)));
    
    let allUsers: any[] = [];
    if (openids.length > 0) {
      console.log(`[Orders API] Found ${openids.length} unique openids. Fetching user data...`);
      // 一次性查询所有相关的用户信息 (假设数量可控，对于200条订单，关联用户数通常不会超限)
      const usersQueryResult = await db.collection('users')
        .where({
          _openid: _.in(openids)
        })
        .limit(1000) // 假设关联用户不会超过1000，Cloudbase单次查询上限
        .get();
      allUsers = usersQueryResult.data || [];
      console.log(`[Orders API] Fetched ${allUsers.length} user records.`);
    }

    // 创建用户信息映射
    const userMap = new Map(
      allUsers.map((user: any) => [
        user._openid,
        {
          userStoreName: user.userStoreName?.trim() || "未知店家", // 提供默认值
          userStoreNameLiankai: user.userStoreNameLiankai?.trim() || "",
          salesPerson: user.salesPerson?.trim() || "未知",
          phoneNumber: user.phoneNumber?.trim() || ""
        }
      ])
    );

    // 记录未找到用户信息的openid
    const missingUsers = openids.filter(openid => !userMap.has(openid));
    if (missingUsers.length > 0) {
      console.warn('[Orders API] The following openids did not find corresponding user information:', missingUsers);
    }

    // 处理订单数据
    const processedOrders = ordersResult.data.map((order: any) => {
      const userInfo = userMap.get(order._openid) || {
        userStoreName: "未知店家",
        userStoreNameLiankai: "",
        salesPerson: "未知",
        phoneNumber: ""
      }; // 如果没有找到用户信息，则使用默认值
      
      const processedGoodsList = (order.goodsList || []).map((goods: any) => {
        const parsedDesc = parseDescription(goods.desc || "");
        return {
          ...goods,
          ...parsedDesc
        };
      });

      return {
        ...order,
        userStoreName: userInfo.userStoreName,
        userStoreNameLiankai: userInfo.userStoreNameLiankai,
        salesPerson: userInfo.salesPerson,
        userPhoneNumber: userInfo.phoneNumber,
        goodsList: processedGoodsList,
        totalSalePrice: order.totalSalePrice
      };
    });

    return NextResponse.json({
      success: true,
      data: processedOrders,
      // 移除了复杂的分页，如果前端仍需要简单的分页信息可以按需添加
      // pagination: { total: ordersResult.data.length, current: 1, pageSize: limit, totalPages: 1 }
    });
  } catch (error) {
    console.error("[Orders API] Error fetching orders:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch orders" }, // 更通用的错误信息
      { status: 500 }
    );
  }
}

// 添加更新订单状态的 PATCH 方法
export async function PATCH(request: Request) {
  try {
    const { orderId, newStatus, isExported } = await request.json();
    
    // 获取数据库实例
    const db = cloudbase.database();
    
    // 验证必填字段
    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: '订单ID为必填项'
      }, { status: 400 });
    }

    // 构建更新对象
    const updateData: any = {
      updateTime: new Date()
    };

    // 如果提供了新状态,则更新状态
    if (typeof newStatus === 'number') {
      const validStatuses = [10, 40, 50, 80, 90];
      if (!validStatuses.includes(newStatus)) {
        return NextResponse.json({
          success: false,
          error: '无效的订单状态'
        }, { status: 400 });
      }
      updateData.orderStatus = newStatus;
    }

    // 如果提供了导出状态,则更新导出状态
    if (typeof isExported === 'boolean') {
      updateData.isExported = isExported;
    }

    // 检查订单是否存在
    const { data: existingOrders } = await db
      .collection('orders')
      .where({
        _id: orderId
      })
      .get();

    if (existingOrders.length === 0) {
      return NextResponse.json({
        success: false,
        error: '订单不存在'
      }, { status: 404 });
    }

    // 更新订单
    await db.collection('orders').doc(orderId).update(updateData);

    return NextResponse.json({
      success: true,
      data: {
        orderId,
        ...updateData
      }
    });

  } catch (error) {
    console.error('更新订单失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '更新订单失败'
    }, { status: 500 });
  }
}

// 辅助函数：解析商品描述
function parseDescription(desc: string) {
  const threePartMatch = desc.match(
    /(\d+)箱=(\d+)(盒|包|袋|板|大盒)=(\d+)(片|支|个|只|包|条|块|瓶|罐|袋|盒)/
  );
  if (threePartMatch) {
    const [, boxes, unitsPerBox, unitType, totalUnits, totalUnitType] = threePartMatch;
    const unitsPerUnit = unitsPerBox !== "0"
      ? parseInt(totalUnits, 10) / parseInt(unitsPerBox, 10)
      : null;
    return {
      formattedDesc: `${boxes}箱=${totalUnits}${totalUnitType}，1${unitType}=${unitsPerUnit}${totalUnitType}`,
      unitType,
      unitsPerUnit,
      totalUnitType,
    };
  }
  return {
    formattedDesc: desc,
    unitType: "",
    unitsPerUnit: null,
    totalUnitType: "",
  };
}