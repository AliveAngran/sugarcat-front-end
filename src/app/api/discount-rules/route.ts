import { NextResponse } from 'next/server';
import { db } from '@/utils/cloudbase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface DiscountRule {
  totalAmount: number;
  discountAmount: number;
}

interface DiscountCampaign {
  title: string;
  startTime: string;
  endTime: string;
  rules: DiscountRule[];
}

export async function POST(request: Request) {
  try {
    const campaign = await request.json() as DiscountCampaign;

    // 基础验证
    if (!campaign.title || !campaign.startTime || !campaign.endTime || !campaign.rules?.length) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 验证规则
    for (const rule of campaign.rules) {
      if (!rule.totalAmount || !rule.discountAmount || rule.discountAmount >= rule.totalAmount) {
        return NextResponse.json(
          { success: false, error: '满减规则无效' },
          { status: 400 }
        );
      }
    }

    // 构建满减活动数据
    const discountData = {
      title: campaign.title,
      startTime: new Date(campaign.startTime),
      endTime: new Date(campaign.endTime),
      rules: campaign.rules.map((rule: DiscountRule) => ({
        totalAmount: Number(rule.totalAmount),
        discountAmount: Number(rule.discountAmount)
      })),
      createTime: new Date(),
      status: 'active',
      isDeleted: false
    };

    // 保存到数据库
    const result = await db.collection('discount_coupons').add(discountData);

    return NextResponse.json({
      success: true,
      data: {
        id: result.id,
        ...discountData
      }
    });

  } catch (error) {
    console.error('创建满减活动失败:', error);
    return NextResponse.json(
      { success: false, error: '创建满减活动失败' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const now = new Date();
    
    // 获取当前有效的满减活动
    const { data } = await db.collection('discount_coupons')
      .where({
        status: 'active',
        isDeleted: false,
        startTime: db.command.lte(now),
        endTime: db.command.gte(now)
      })
      .orderBy('createTime', 'desc')
      .get();

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('获取满减活动失败:', error);
    return NextResponse.json(
      { success: false, error: '获取满减活动失败' },
      { status: 500 }
    );
  }
} 