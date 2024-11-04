'use client';

import { useEffect, useState } from 'react';
import { db, dbPromise } from '@/utils/cloudbase';
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

type User = {
  userStoreName: string;
  // 其他属性...
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
    const testConnection = async () => {
      try {
        // 等待数据库初始化
        const database = await dbPromise;
        console.log('数据库实例:', database);
        
        if (!database) {
          throw new Error('数据库初始化失败');
        }

        // 先不要指定具体的 openid，而是获取所有用户数据
        const userResult = await database
          .collection('users')
          .limit(10)  // 限制返回10条数据
          .get();
        
        console.log('测试查询用户结果:', userResult);
        
        if (userResult && userResult.data && userResult.data.length > 0) {
          // 打印所有用户的商店名称
          userResult.data.forEach((user: User, index) => {
            console.log(`第${index + 1}个用户的商店名称:`, user.userStoreName);
          });
        } else {
          console.log('未找到用户数据');
        }
        
      } catch (err) {
        console.error('数据库测试失败:', err);
      }
    };

    testConnection();
  }, []);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        // 等待数据库初始化
        const database = await dbPromise;
        
        if (!database) {
          throw new Error('数据库初始化失败');
        }

        console.log('开始获取订单数据...');
        
        const result = await database
          .collection('orders')
          .orderBy('createTime', 'desc')
          .limit(100)
          .get();
        
        if (!result || !result.data) {
          throw new Error('返回数据格式异常');
        }
        
        // 获取每个订单的店家名和商品描述
        const ordersWithDetails = await Promise.all(result.data.map(async (order: any) => {
          try {
            // 获取用户商店名称
            const userResult = await database
              .collection('users')
              .where({
                '_openid': order._openid
              })
              .get();

            const userStoreName = userResult.data && userResult.data.length > 0 
              ? userResult.data[0].userStoreName || '未知店家'
              : '未知店家';

            // 获取商品描述
            const goodsWithDesc = await Promise.all(order.goodsList.map(async (goods: any) => {
              try {
                const spuResult = await database
                  .collection('spu_db')
                  .where({
                    'spuId': goods.spuId
                  })
                  .get();

                const spuDesc = spuResult.data && spuResult.data.length > 0 
                  ? spuResult.data[0].desc || '无描述'
                  : '无描述';

                return { ...goods, desc: spuDesc };
              } catch (err) {
                console.error(`获取商品 ${goods.spuId} 描述失败:`, err);
                return { ...goods, desc: '无描述' };
              }
            }));

            return { 
              ...order, 
              userStoreName,
              goodsList: goodsWithDesc
            };
          } catch (err) {
            console.error(`获取订单 ${order._id} 详情失败:`, err);
            return { ...order, userStoreName: '未知店家', goodsList: order.goodsList };
          }
        }));

        setOrders(ordersWithDetails);
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
        <h1 className="text-4xl font-bold text-gray-800 mb-8">订单列表</h1>

        <div className="space-y-4">
          {orders.map((order, index) => (
            <div 
              key={order._id}
              className="bg-white rounded-lg shadow-md p-6 border border-gray-300"
            >
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-900 text-lg font-semibold"> {orders.length - index}. 订单号: {order.orderNo}</span>
                <span className={`px-3 py-1 text-sm rounded-full ${
                  order.payStatus === 'PAID' 
                    ? 'bg-green-200 text-green-800' 
                    : 'bg-yellow-200 text-yellow-800'
                }`}>
                  {order.payStatus === 'PAID' ? '已支付' : '未支付'}
                </span>
              </div>
              <div className="text-sm text-gray-600 mb-4">
                <p>店家名: {order.userStoreName || '未知店家'}</p>
                <p>收货人: {order.receiverName} {order.receiverPhone}</p>
                <p>地址: {order.receiverAddress}</p>
              </div>
              <div className="text-lg font-medium text-green-700">¥{formatMoney(order.paymentAmount)}</div>
              <div className="text-sm text-gray-500">
                {formatDate(String(order.createTime))}
              </div>
              <button 
                className="mt-4 bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 transition duration-200"
                onClick={() => toggleOrder(order._id)}
              >
                {expandedOrders.has(order._id) ? '收起' : '展开'}
              </button>

              {/* 展开的商品列表 */}
              {expandedOrders.has(order._id) && (
                <table className="mt-4 w-full bg-gray-100 rounded-lg">
                  <thead>
                    <tr className="border-b border-gray-300">
                      <th className="py-3 px-4 text-left text-gray-900">商品名称</th>
                      <th className="py-3 px-4 text-center text-gray-900">数量</th>
                      <th className="py-3 px-4 text-left text-gray-900">描述</th>
                      <th className="py-3 px-4 text-right text-gray-900">价格</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.goodsList.map((goods, index) => (
                      <tr key={goods.spuId} className="border-b border-gray-300">
                        <td className="py-2 text-gray-900">{goods.goodsName}</td>
                        <td className="py-2 text-center text-gray-500">× {goods.quantity}</td>
                        <td className="py-2 text-gray-500">{goods.desc}</td>
                        <td className="py-2 text-right text-gray-900">¥{formatMoney(goods.price * goods.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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