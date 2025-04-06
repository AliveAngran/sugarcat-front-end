'use client';

import React, { useState, useEffect } from 'react';
import { Card, Input, DatePicker, Button, message, Form, InputNumber, Space } from 'antd';
import type { Dayjs } from 'dayjs';
import { useRouter } from 'next/navigation';
import { checkAuth } from '@/utils/auth';
import NavBar from '../../../components/NavBar';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import styles from '../styles/DiscountRules.module.css';
import { RangePickerProps } from 'antd/es/date-picker';
import moment from 'moment';

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

function DiscountRules() {
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

    if (currentRule.totalAmount <= 0 || currentRule.discountAmount <= 0) {
      message.error('金额必须大于0');
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
      // 1. 先检查是否存在满减活动
      const checkResponse = await fetch('/api/discount-rules', {
        method: 'GET',
      });

      if (!checkResponse.ok) {
        throw new Error('检查现有活动失败');
      }

      const { data: existingCampaigns } = await checkResponse.json();
      console.log('现有活动:', existingCampaigns); // 调试日志

      // 2. 如果存在活动，先删除现有活动
      if (existingCampaigns && existingCampaigns.length > 0) {
        console.log('开始删除现有活动'); // 调试日志
        const deleteResponse = await fetch('/api/discount-rules', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (!deleteResponse.ok) {
          const errorData = await deleteResponse.json().catch(() => ({ message: '删除现有活动失败' }));
          throw new Error(errorData.message || '删除现有活动失败');
        }
        console.log('现有活动删除成功'); // 调试日志
      }

      // 3. 保存新活动
      console.log('开始保存新活动'); // 调试日志
      const saveResponse = await fetch('/api/discount-rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(campaign),
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json().catch(() => ({ message: '保存失败' }));
        throw new Error(errorData.message || '保存失败');
      }

      console.log('新活动保存成功'); // 调试日志
      message.success('满减活动创建成功');
      form.resetFields();
      setRules([]);
    } catch (error) {
      console.error('操作失败:', error);
      message.error(error instanceof Error ? error.message : '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
                    onChange={e => {
                      const value = Number(e.target.value);
                      if (value >= 0) {
                        setCurrentRule({
                          ...currentRule,
                          totalAmount: value
                        });
                      }
                    }}
                    min={0}
                    placeholder="总金额"
                  />
                  <span>减</span>
                  <Input
                    type="number"
                    style={{ width: 120 }}
                    value={currentRule.discountAmount}
                    onChange={e => {
                      const value = Number(e.target.value);
                      if (value >= 0) {
                        setCurrentRule({
                          ...currentRule,
                          discountAmount: value
                        });
                      }
                    }}
                    min={0}
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

export default function Page() {
  return (
    <>
      <NavBar />
      <DiscountRules />
    </>
  );
} 