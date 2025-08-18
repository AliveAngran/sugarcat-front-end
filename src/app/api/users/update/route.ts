import { NextResponse } from 'next/server';
import { cloudbase } from '@/utils/cloudbase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PUT(request: Request) {
  try {
    const { userId, userStoreName, userStoreNameLiankai, salesPerson, phoneNumber, canPlaceOrder } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "用户ID不能为空" },
        { status: 400 }
      );
    }

    const db = cloudbase.database();

    // 构建更新对象，只包含提供的字段
    const updateData: any = {
      updateTime: new Date()
    };

    if (userStoreName !== undefined) updateData.userStoreName = userStoreName;
    if (userStoreNameLiankai !== undefined) updateData.userStoreNameLiankai = userStoreNameLiankai;
    if (salesPerson !== undefined) updateData.salesPerson = salesPerson;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (canPlaceOrder !== undefined) updateData.canPlaceOrder = canPlaceOrder;

    // 更新用户信息
    const userUpdate = await db
      .collection("users")
      .where({
        _openid: userId
      })
      .update(updateData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("更新用户信息失败:", error);
    return NextResponse.json(
      { error: "更新用户信息失败" },
      { status: 500 }
    );
  }
} 