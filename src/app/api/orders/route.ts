import { NextResponse } from 'next/server';
import { cloudbase } from '@/utils/cloudbase-admin';
import cloud from '@cloudbase/node-sdk';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 初始化云开发
const app = cloud.init({
  env: process.env.NEXT_PUBLIC_ENV_ID as string,
  secretId: process.env.TCB_SECRET_ID as string,
  secretKey: process.env.TCB_SECRET_KEY as string,
});

export async function GET() {
  try {
    // console.log("[Orders API] Starting to fetch orders");
    const db = cloudbase.database();
    const _ = db.command;
    
    // console.log("[Orders API] Fetching orders from database");
    // 获取订单数据
    const ordersResult = await db.collection('orders')
      .orderBy('createTime', 'desc')
      .limit(2000)
      .get();
    
    // console.log("[Orders API] Orders count:", ordersResult.data.length);

    // 获取所有相关用户的 openid
    const openids = Array.from(new Set(ordersResult.data.map((order: any) => order._openid)));
    // console.log("[Orders API] Unique openids count:", openids.length);
    
    // console.log("[Orders API] Fetching users information");
    // 批量获取用户信息
    const usersResult = await db.collection('users')
      .where({
        _openid: _.in(openids)
      })
      .limit(2000)
      .get();

    // console.log("[Orders API] Users found:", usersResult.data.length);

    // 创建用户信息映射
    const userMap = new Map(
      usersResult.data.map((user: any) => [
        user._openid,
        {
          userStoreName: user.userStoreName || "未知店家",
          userStoreNameLiankai: user.userStoreNameLiankai || "",
          salesPerson: user.salesPerson || "未知",
          phoneNumber: user.phoneNumber || ""
        }
      ])
    );

    // 处理订单数据
    const processedOrders = ordersResult.data.map((order: any) => {
      const userInfo = userMap.get(order._openid) || {
        userStoreName: "未知店家",
        userStoreNameLiankai: "",
        salesPerson: "未知",
        phoneNumber: ""
      };

      // 处理商品列表
      const processedGoodsList = order.goodsList.map((goods: any) => {
        // 解析商品描述
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
        goodsList: processedGoodsList
      };
    });

    return NextResponse.json({
      success: true,
      data: processedOrders
    });
  } catch (error) {
    // console.error("[Orders API] Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

// 添加更新订单状态的 PATCH 方法
export async function PATCH(request: Request) {
  try {
    const { orderId, newStatus, isExported } = await request.json();
    
    // 获取数据库实例
    const db = app.database();
    
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