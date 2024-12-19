import { NextResponse } from "next/server";
import { cloudbase } from "@/utils/cloudbase-admin";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PUT(request: Request) {
  try {
    const { userId, storeName, orderId } = await request.json();

    if (!userId || !storeName || !orderId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const db = cloudbase.database();

    // 更新用户表中的连凯名称
    const userUpdate = await db
      .collection("users")
      .where({
        _openid: userId
      })
      .update({
        userStoreNameLiankai: storeName,
      });

    console.log("User update result:", userId);

    // // 更新当前订单中的连凯名称
    // const orderUpdate = await db
    //   .collection("orders")
    //   .doc(orderId)‘
    //   .update({
    //     userStoreNameLiankai: storeName
    //   });

    // console.log("Order update result:", orderUpdate);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating store name:", error);
    return NextResponse.json(
      { error: "Failed to update store name" },
      { status: 500 }
      
    );
  }
}
