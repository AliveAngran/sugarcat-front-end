'use client';

import React, { useState, useEffect } from 'react';
import { Card, Input, DatePicker, Button, message, Form, InputNumber, Space, Modal, Spin, Typography, Tag } from 'antd';
import type { Dayjs } from 'dayjs';
import { useRouter } from 'next/navigation';
import { checkAuth } from '@/utils/auth';
import NavBar from '@/components/NavBar';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import styles from '../styles/DiscountRules.module.css';
import { RangePickerProps } from 'antd/es/date-picker';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

interface DiscountRule {
  totalAmount: number;
  discountAmount: number;
}

interface DiscountCampaign {
  _id?: string;
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
  const [existingCampaign, setExistingCampaign] = useState<DiscountCampaign | null>(null);
  const [fetchLoading, setFetchLoading] = useState(true);

  const fetchCampaign = async () => {
    setFetchLoading(true);
    try {
      const response = await fetch('/api/discount-rules');
      if (!response.ok) {
        throw new Error('获取活动信息失败');
      }
      const { data } = await response.json();
      if (data && data.length > 0) {
        setExistingCampaign(data[0]);
      } else {
        setExistingCampaign(null);
      }
    } catch (error) {
      console.error(error);
      message.error(error instanceof Error ? error.message : '获取活动信息失败');
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    const auth = checkAuth();
    if (!auth) {
      router.push('/');
    } else {
      fetchCampaign();
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

  const handleDeleteCampaign = () => {
    Modal.confirm({
      title: '确认删除活动',
      content: '您确定要删除当前的满减活动吗？此操作将无法撤销。',
      okText: '确认删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        setLoading(true);
        try {
          const deleteResponse = await fetch('/api/discount-rules', {
            method: 'DELETE',
          });

          if (!deleteResponse.ok) {
            const errorData = await deleteResponse.json().catch(() => ({ message: '删除现有活动失败' }));
            throw new Error(errorData.message || '删除现有活动失败');
          }
          message.success('活动删除成功');
          setExistingCampaign(null);
        } catch (error) {
          console.error('操作失败:', error);
          message.error(error instanceof Error ? error.message : '操作失败，请重试');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleSubmit = async (values: any) => {
    if (rules.length === 0) {
      message.warning('请至少添加一条满减规则');
      return;
    }

    const [startTime, endTime] = values.timeRange;
    
    const campaign: Omit<DiscountCampaign, '_id'> = {
      title: values.title,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      rules: rules,
    };

    setLoading(true);
    try {
      if (existingCampaign) {
        console.log('检测到现有活动，将先删除再创建');
        const deleteResponse = await fetch('/api/discount-rules', {
          method: 'DELETE',
        });

        if (!deleteResponse.ok) {
          const errorData = await deleteResponse.json().catch(() => ({ message: '删除现有活动失败' }));
          throw new Error(errorData.message || '删除现有活动失败');
        }
        console.log('现有活动删除成功');
      }

      console.log('开始保存新活动');
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

      console.log('新活动保存成功');
      message.success('满减活动已成功设置');
      form.resetFields();
      setRules([]);
      await fetchCampaign();
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
        {fetchLoading ? (
          <div className="text-center p-10"><Spin size="large" /></div>
        ) : existingCampaign ? (
          <Card title="当前活动" className="max-w-2xl mx-auto mb-6">
            <Title level={4}>{existingCampaign.title}</Title>
            <p className="mb-2">
              <Text strong>活动时间: </Text>
              {dayjs(existingCampaign.startTime).format('YYYY-MM-DD HH:mm:ss')} 至 {dayjs(existingCampaign.endTime).format('YYYY-MM-DD HH:mm:ss')}
            </p>
            <div className="mb-4">
              <Text strong>满减规则:</Text>
              <div className="mt-2 flex flex-wrap gap-2">
                {existingCampaign.rules.map((rule, index) => (
                  <Tag color="processing" key={index}>
                    满 ¥{rule.totalAmount} 减 ¥{rule.discountAmount}
                  </Tag>
                ))}
              </div>
            </div>
            <Button
              type="primary"
              danger
              onClick={handleDeleteCampaign}
              loading={loading}
            >
              删除活动
            </Button>
          </Card>
        ) : (
           <Card className="max-w-2xl mx-auto mb-6 text-center py-4">
             <Text type="secondary">当前没有进行中的满减活动。</Text>
          </Card>
        )}
        
        <Card title={existingCampaign ? "设置新的活动（将替换当前活动）" : "创建满减活动"} className="max-w-2xl mx-auto">
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
                      icon={<DeleteOutlined />}
                      onClick={() => setRules(rules.filter((_, i) => i !== index))}
                    />
                  </div>
                ))}
                
                <div className="flex items-center space-x-2">
                  <span className='whitespace-nowrap'>满</span>
                  <InputNumber
                    className='flex-1'
                    value={currentRule.totalAmount}
                    onChange={value => {
                      if (value !== null && value >= 0) {
                        setCurrentRule({ ...currentRule, totalAmount: value });
                      }
                    }}
                    min={0}
                    placeholder="总金额"
                    addonBefore="¥"
                  />
                  <span className='whitespace-nowrap'>减</span>
                  <InputNumber
                    className='flex-1'
                    value={currentRule.discountAmount}
                    onChange={value => {
                       if (value !== null && value >= 0) {
                        setCurrentRule({ ...currentRule, discountAmount: value });
                      }
                    }}
                    min={0}
                    placeholder="优惠金额"
                    addonBefore="¥"
                  />
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAddRule}>
                    添加
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
                {existingCampaign ? "保存并替换活动" : "创建活动"}
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