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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '100');
    const skip = (page - 1) * pageSize;

    const db = cloudbase.database();
    const _ = db.command;
    
    // 获取总记录数
    const countResult = await db.collection('orders')
      .where({})
      .count();
    
    const total = countResult.total || 0;
    
    // 获取当前页的订单数据
    const ordersResult = await db.collection('orders')
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();
    
    // 获取所有相关用户的 openid
    const openids = Array.from(new Set(ordersResult.data.map((order: any) => order._openid)));
    
    // 分批查询用户数据
    const BATCH_SIZE = 100; // 降低批次大小以提高稳定性
    const userBatches = [];
    const MAX_RETRIES = 3; // 最大重试次数
    
    // 将openids分成多个批次
    for (let i = 0; i < openids.length; i += BATCH_SIZE) {
      const batchOpenids = openids.slice(i, i + BATCH_SIZE);
      userBatches.push(batchOpenids);
    }

    // 带重试机制的用户查询函数
    async function queryUsersWithRetry(batchOpenids: string[], retryCount = 0): Promise<any> {
      try {
        const result = await db.collection('users')
          .where({
            _openid: _.in(batchOpenids)
          })
          .get();
        return result;
      } catch (error) {
        console.error(`[Orders API] 批次用户查询失败 (第${retryCount + 1}次尝试):`, error);
        console.error('失败的openids:', batchOpenids);
        
        if (retryCount < MAX_RETRIES - 1) {
          // 等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return queryUsersWithRetry(batchOpenids, retryCount + 1);
        }
        
        // 超过最大重试次数，返回空结果
        console.error(`[Orders API] 批次用户查询在${MAX_RETRIES}次尝试后仍然失败`);
        return { data: [] };
      }
    }

    // 并发查询所有批次
    const userResults = await Promise.all(
      userBatches.map(batch => queryUsersWithRetry(batch))
    );
    
    // 合并所有批次的结果并过滤无效记录
    const allUsers = userResults.reduce((acc: any[], result) => {
      const validUsers = result.data.filter((user: any) => {
        const isValid = user && user.userStoreName;
        if (!isValid) {
          console.warn('[Orders API] 发现无效用户记录:', {
            openid: user._openid,
            rawData: {
              userStoreName: user.userStoreName,
              userStoreNameLiankai: user.userStoreNameLiankai,
              salesPerson: user.salesPerson,
              phoneNumber: user.phoneNumber
            }
          });
        }
        return isValid;
      });
      return [...acc, ...validUsers];
    }, [] as any[]);

    // 记录查询结果统计
    console.log(`[Orders API] 用户查询统计:
      - 总订单数: ${ordersResult.data.length}
      - 不同openid数: ${openids.length}
      - 查询到的用户数: ${allUsers.length}
      - 无效用户数: ${openids.length - allUsers.length}`);

    // 创建用户信息映射
    const userMap = new Map(
      allUsers.map((user: any) => [
        user._openid,
        {
          userStoreName: user.userStoreName.trim(),
          userStoreNameLiankai: user.userStoreNameLiankai?.trim() || "",
          salesPerson: user.salesPerson?.trim() || "未知",
          phoneNumber: user.phoneNumber?.trim() || ""
        }
      ])
    );

    // 记录未找到用户信息的openid
    const missingUsers = openids.filter(openid => !userMap.has(openid));
    if (missingUsers.length > 0) {
      console.warn('[Orders API] 以下openid未找到对应用户信息:', missingUsers);
    }

    // 处理订单数据
    const processedOrders = ordersResult.data.map((order: any) => {
      const userInfo = userMap.get(order._openid);
      
      // 记录显示为未知店家的订单信息
      if (!userInfo || userInfo.userStoreName === "未知店家") {
        console.warn('[Orders API] 订单显示为未知店家:', {
          orderId: order._id,
          openid: order._openid,
          createTime: order.createTime,
          userInfo: userInfo || null
        });
      }
      
      const finalUserInfo = userInfo || {
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
        userStoreName: finalUserInfo.userStoreName,
        userStoreNameLiankai: finalUserInfo.userStoreNameLiankai,
        salesPerson: finalUserInfo.salesPerson,
        userPhoneNumber: finalUserInfo.phoneNumber,
        goodsList: processedGoodsList
      };
    });

    return NextResponse.json({
      success: true,
      data: processedOrders,
      pagination: {
        total,
        current: page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) + 1
      }
    });
  } catch (error) {
    console.error("[Orders API] Error fetching orders:", error);
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