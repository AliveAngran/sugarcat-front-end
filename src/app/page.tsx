'use client';

import { useEffect, useState } from 'react';
import { db } from '@/utils/cloudbase';
import type { Order } from '@/types/order';

const formatMoney = (amount: number) => {
  return (amount / 100).toFixed(2);
};

// 修改时间格式化函数
const formatDate = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Shanghai'
    });
  } catch (error) {
    console.error('时间格式化错误:', error);
    return '时间格式错误';
  }
};

function OrderList() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const toggleOrder = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    const fetchOrders = async () => {
      if (!db) {
        setError('数据库连接未初始化');
        setLoading(false);
        return;
      }

      try {
        console.log('开始获取订单数据...');
        const result = await db
          .collection('orders')
          .orderBy('createTime', 'desc')
          .limit(100)
          .get();
        
        console.log('获取到的数据:', result);
        setOrders(result.data);
        setError(null);
      } catch (err) {
        console.error('获取订单失败:', err);
        setError(err instanceof Error ? err.message : '获取数据失败');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-red-600">错误: {error}</div>
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">订单列表</h1>
        <div className="text-center text-gray-500">暂无订单数据</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">订单列表</h1>

        <div className="space-y-4">
          {orders.map((order) => (
            <div 
              key={order._id}
              className="bg-white rounded-lg shadow-sm overflow-hidden"
            >
              <div 
                className="p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleOrder(order._id)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-gray-900">订单号: {order.orderNo}</span>
                      <span className={`px-2 py-0.5 text-sm rounded ${
                        order.payStatus === 'PAID' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {order.payStatus === 'PAID' ? '已支付' : '未支付'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      <p>收货人: {order.receiverName} {order.receiverPhone}</p>
                      <p>地址: {order.receiverAddress}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-medium text-green-600">¥{formatMoney(order.paymentAmount)}</div>
                    <div className="text-sm text-gray-500">
                      {formatDate(order.createTime)}
                    </div>
                  </div>
                </div>

                {/* 展开的商品列表 */}
                {expandedOrders.has(order._id) && (
                  <div className="mt-4 space-y-3">
                    {order.goodsList.map((goods) => (
                      <div key={goods.spuId} className="flex justify-between items-center text-sm">
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <span className="text-gray-900">{goods.goodsName}</span>
                            <span className="text-gray-500">× {goods.quantity}</span>
                          </div>
                          <div className="text-gray-500">SPU: {goods.spuId}</div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-gray-900">¥{formatMoney(goods.price * goods.quantity)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <OrderList />;
} 