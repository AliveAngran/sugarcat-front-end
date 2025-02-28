'use client';

import React, { useState, useEffect } from 'react';
import { Card, Input, DatePicker, Button, message, Form } from 'antd';
import type { Dayjs } from 'dayjs';
import { useRouter } from 'next/navigation';
import { checkAuth } from '@/utils/auth';
import NavBar from '@/components/NavBar';

const { RangePicker } = DatePicker;

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

export default function DiscountRulesPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<DiscountRule[]>([]);
  const [currentRule, setCurrentRule] = useState<DiscountRule>({
    totalAmount: 0,
    discountAmount: 0,
  });

  useEffect(() => {
    const auth = checkAuth();
    if (!auth) {
      router.push('/');
    }
  }, [router]);

  const handleAddRule = () => {
    if (!currentRule.totalAmount || !currentRule.discountAmount) {
      message.warning('请完成输入');
      return;
    }

    if (currentRule.discountAmount >= currentRule.totalAmount) {
      message.error('优惠金额必须小于总金额');
      return;
    }

    setRules([...rules, currentRule]);
    setCurrentRule({ totalAmount: 0, discountAmount: 0 });
  };

  const handleSubmit = async (values: any) => {
    if (rules.length === 0) {
      message.warning('请至少添加一条满减规则');
      return;
    }

    const [startTime, endTime] = values.timeRange;
    
    const campaign: DiscountCampaign = {
      title: values.title,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      rules: rules,
    };

    setLoading(true);
    try {
      const response = await fetch('/api/discount-rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(campaign),
      });

      if (!response.ok) {
        throw new Error('保存失败');
      }

      message.success('满减活动创建成功');
      form.resetFields();
      setRules([]);
    } catch (error) {
      message.error('保存失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8 pt-6">
        <Card title="满减活动设置" className="max-w-2xl mx-auto">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
          >
            <Form.Item
              label="活动标题"
              name="title"
              rules={[{ required: true, message: '请输入活动标题' }]}
            >
              <Input placeholder="请输入活动标题" />
            </Form.Item>

            <Form.Item
              label="活动时间"
              name="timeRange"
              rules={[{ required: true, message: '请选择活动时间' }]}
            >
              <RangePicker
                showTime
                className="w-full"
                placeholder={['开始时间', '结束时间']}
              />
            </Form.Item>

            <div className="mb-4">
              <h3 className="text-lg font-medium mb-2">满减规则</h3>
              <div className="space-y-4">
                {rules.map((rule, index) => (
                  <div key={index} className="flex items-center space-x-4 p-2 bg-gray-50 rounded">
                    <span>满 ¥{rule.totalAmount} 减 ¥{rule.discountAmount}</span>
                    <Button
                      type="text"
                      danger
                      onClick={() => setRules(rules.filter((_, i) => i !== index))}
                    >
                      删除
                    </Button>
                  </div>
                ))}
                
                <div className="flex items-center space-x-4">
                  <span>满</span>
                  <Input
                    type="number"
                    style={{ width: 120 }}
                    value={currentRule.totalAmount}
                    onChange={e => setCurrentRule({
                      ...currentRule,
                      totalAmount: Number(e.target.value)
                    })}
                    placeholder="总金额"
                  />
                  <span>减</span>
                  <Input
                    type="number"
                    style={{ width: 120 }}
                    value={currentRule.discountAmount}
                    onChange={e => setCurrentRule({
                      ...currentRule,
                      discountAmount: Number(e.target.value)
                    })}
                    placeholder="优惠金额"
                  />
                  <Button type="primary" onClick={handleAddRule}>
                    添加规则
                  </Button>
                </div>
              </div>
            </div>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                className="w-full"
              >
                保存活动
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
} 