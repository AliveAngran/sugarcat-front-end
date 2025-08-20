import { NextResponse } from 'next/server';
import { cloudbase } from '@/utils/cloudbase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST() {
  try {
    const db = cloudbase.database();
    const _ = db.command; // 获取数据库命令对象
    const usersCollection = db.collection('users');
    const ordersCollection = db.collection('orders');

    let updatedCount = 0;
    const allUsers: any[] = [];
    let skipUsers = 0;
    const userLimit = 1000; // 每次获取的用户数量

    // 1. 分批获取所有用户
    console.log('[MarkOrderedStatus] Starting to fetch all users...');
    while (true) {
      const usersBatch = await usersCollection.skip(skipUsers).limit(userLimit).get();
      if (usersBatch.data && usersBatch.data.length > 0) {
        allUsers.push(...usersBatch.data);
        skipUsers += usersBatch.data.length;
        if (usersBatch.data.length < userLimit) {
          break; // 已获取所有用户
        }
      } else {
        break; // 没有更多用户了
      }
    }
    console.log(`[MarkOrderedStatus] Fetched a total of ${allUsers.length} users.`);

    // 2. 分批获取所有订单的 _openid，用于快速查找哪些用户有订单
    console.log('[MarkOrderedStatus] Starting to fetch all order openids...');
    const allOrderOpenids = new Set<string>();
    let skipOrders = 0;
    const orderLimit = 1000; // 每次获取的订单数量

    while (true) {
      console.log(`[MarkOrderedStatus] Fetching orders batch: skip=${skipOrders}, limit=${orderLimit}`);
      const ordersBatch = await ordersCollection
        .field({ _openid: true }) // 只获取 _openid 字段，提高查询效率
        .skip(skipOrders)
        .limit(orderLimit)
        .get();
      
      if (ordersBatch.data && ordersBatch.data.length > 0) {
        ordersBatch.data.forEach((order: any) => {
          if (order._openid) {
            allOrderOpenids.add(order._openid);
          }
        });
        skipOrders += ordersBatch.data.length;
        console.log(`[MarkOrderedStatus] Processed ${ordersBatch.data.length} orders, skip now: ${skipOrders}, total unique openids: ${allOrderOpenids.size}`);
        
        if (ordersBatch.data.length < orderLimit) {
          console.log(`[MarkOrderedStatus] Last batch detected (${ordersBatch.data.length} < ${orderLimit}). Stopping.`);
          break; // 已获取所有订单
        }
      } else {
        console.log('[MarkOrderedStatus] No more orders found. Stopping.');
        break; // 没有更多订单了
      }
    }
    console.log(`[MarkOrderedStatus] Found ${allOrderOpenids.size} unique users with orders from ${skipOrders} total orders.`);

    // 3. 遍历每个用户，根据订单openid集合判断是否下过单
    for (const user of allUsers) {
      if (!user._openid) {
        console.warn(`[MarkOrderedStatus] User with _id ${user._id} is missing _openid. Skipping.`);
        continue;
      }

      try {
        const hasOrders = allOrderOpenids.has(user._openid);

        if (hasOrders) {
          // 如果该用户下过单，且当前 hasOrdered 不为 true，则更新
          if (user.hasOrdered !== true) {
            const updateUserResult = await usersCollection.doc(user._id).update({
              hasOrdered: true,
              lastCheckedOrderStatusTime: new Date()
            });
            if (updateUserResult.updated && updateUserResult.updated > 0) {
              updatedCount++;
              console.log(`[MarkOrderedStatus] Marked user ${user._openid} (ID: ${user._id}) as hasOrdered: true.`);
            }
          }
        } else {
          // 如果用户没有订单，且当前 hasOrdered 不为 false，则更新为 false
          if (user.hasOrdered !== false) {
            const updateUserResult = await usersCollection.doc(user._id).update({
              hasOrdered: false,
              lastCheckedOrderStatusTime: new Date()
            });
            // 我们可以选择是否将这种更新也计入 updatedCount，取决于需求
            // 如果从未设置过或之前是true，现在改为false，也算一种更新
            if (updateUserResult.updated && updateUserResult.updated > 0) {
               console.log(`[MarkOrderedStatus] Marked user ${user._openid} (ID: ${user._id}) as hasOrdered: false.`);
               // updatedCount++; // 如果需要将设置为false也计数
            }
          }
        }
      } catch (e) {
         console.error(`[MarkOrderedStatus] Error processing user ${user._openid} (ID: ${user._id}):`, e);
      }
    }

    console.log(`[MarkOrderedStatus] Finished processing. Total users updated: ${updatedCount}`);
    return NextResponse.json({
      success: true,
      updatedCount,
      totalUsersProcessed: allUsers.length
    });

  } catch (error) {
    console.error('[MarkOrderedStatus] Critical error in mark-ordered-status API:', error);
    return NextResponse.json(
      { success: false, error: '更新店铺下单状态失败' },
      { status: 500 }
    );
  }
} 