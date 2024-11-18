"use client";

import { useEffect, useState } from 'react';
import { Line, Pie, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { checkAuth } from '@/utils/auth';
import { useRouter } from 'next/navigation';

// 注册 ChartJS 组件
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface DashboardData {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  totalProducts: number;
  recentOrders: {
    dates: string[];
    values: number[];
  };
  productCategories: {
    labels: string[];
    data: number[];
  };
  topProducts: {
    names: string[];
    sales: number[];
    amounts: number[];
  };
  additionalMetrics: {
    hourlyDistribution: Array<{ hour: number; amount: number }>;
    topCombinations: Array<{ products: string[]; count: number }>;
    slowMovingProducts: Array<{ name: string; sales: number; available: number }>;
    customerValueRanges: Array<{ range: number; count: number }>;
    regionDistribution: Array<{ region: string; amount: number }>;
    topBrands: Array<{
      name: string;
      salesAmount: number;
      quantity: number;
      productCount: number;
    }>;
    slowMovingBrands: Array<{
      name: string;
      averageSales: number;
      productCount: number;
      totalSales: number;
    }>;
    customerGrowth: Array<{ date: string; new: number; total: number }>;
    categoryTrends: Array<{
      month: string;
      shares: Array<{
        category: string;
        share: number;
      }>;
    }>;
    topCategoryCombos: Array<{
      categories: string[];
      amount: number;
    }>;
    customerConcentration: Array<{
      customerPercentage: number;
      revenuePercentage: number;
    }>;
    storeAnalysis: {
      totalStores: number;
      storeStats: Array<{
        storeName: string;
        orderCount: number;
        totalAmount: number;
      }>;
    };
  };
}

export default function Dashboard() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  const { scrollYProgress } = useScroll();
  const headerOpacity = useTransform(scrollYProgress, [0, 0.1], [1, 0]);

  useEffect(() => {
    const auth = checkAuth();
    if (!auth) {
      router.push('/');
    }
  }, [router]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await fetch('/api/dashboard', {
          cache: 'no-store'
        });
        const result = await response.json();
        setData(result.data);
      } catch (error) {
        console.error('获取数据失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  const lineChartData = {
    labels: data.recentOrders.dates,
    datasets: [
      {
        label: '订单金额',
        data: data.recentOrders.values,
        fill: true,
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const pieChartData = {
    labels: data.productCategories.labels,
    datasets: [
      {
        data: data.productCategories.data,
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)',
        ],
      },
    ],
  };

  const barChartData = {
    labels: data.topProducts.names,
    datasets: [
      {
        label: '销售额',
        data: data.topProducts.amounts.map(amount => amount / 100),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
      }
    ],
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white p-6 relative overflow-hidden">
      <div className="fixed inset-0 opacity-20">
        <div className="absolute inset-0 bg-grid-pattern animate-pulse"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(14,165,233,0.1),transparent_50%)] animate-blob"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(236,72,153,0.1),transparent_50%)] animate-blob animation-delay-2000"></div>
      </div>

      <div className="max-w-7xl mx-auto relative">
        <motion.div 
          style={{ opacity: headerOpacity }}
          className="sticky top-0 z-50 backdrop-blur-sm bg-black/30 rounded-xl mb-8 p-4"
        >
          <motion.h1 
            className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 text-center"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            数据看板
            <div className="h-1 w-32 mx-auto bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 mt-2 rounded-full"></div>
          </motion.h1>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { title: '总订单数', value: data.totalOrders, icon: '📊', color: 'from-blue-900 to-blue-600' },
            { title: '总收入', value: `¥${(data.totalRevenue / 100).toFixed(2)}`, icon: '💰', color: 'from-purple-900 to-purple-600' },
            { title: '平均订单金额', value: `¥${(data.averageOrderValue / 100).toFixed(2)}`, icon: '📈', color: 'from-pink-900 to-pink-600' },
            { title: '商品数量', value: data.totalProducts, icon: '📦', color: 'from-indigo-900 to-indigo-600' }
          ].map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileHover={{ 
                scale: 1.05,
                rotateY: 5,
                rotateX: 5,
              }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                delay: index * 0.1,
                type: "spring",
                stiffness: 300
              }}
              className={`
                relative overflow-hidden rounded-xl p-6
                bg-gradient-to-br ${item.color}
                border border-gray-800/50 backdrop-blur-sm
                group transform perspective-1000
                hover:shadow-[0_0_30px_rgba(59,130,246,0.5)]
                transition-all duration-300 cursor-pointer
              `}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>
              </div>
              
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className="text-gray-100 text-sm font-medium">{item.title}</p>
                  <p className="text-2xl font-bold mt-2 text-white">{item.value}</p>
                </div>
                <span className="text-3xl group-hover:scale-110 transition-transform duration-300">{item.icon}</span>
              </div>
              
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-black/40 backdrop-blur-md rounded-xl p-6 border border-gray-800/50 hover:border-blue-900/50 transition-all duration-300 hover:shadow-[0_0_25px_rgba(59,130,246,0.2)]"
          >
            <h2 className="text-xl font-bold mb-4">订单趋势</h2>
            <div className="h-[300px]">
              <Line
                data={lineChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                      },
                      ticks: { color: 'rgba(255, 255, 255, 0.8)' },
                    },
                    x: {
                      grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                      },
                      ticks: { color: 'rgba(255, 255, 255, 0.8)' },
                    },
                  },
                  plugins: {
                    legend: {
                      labels: { color: 'rgba(255, 255, 255, 0.8)' },
                    },
                  },
                }}
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-black/40 backdrop-blur-md rounded-xl p-6 border border-gray-800/50 hover:border-blue-900/50 transition-all duration-300 hover:shadow-[0_0_25px_rgba(59,130,246,0.2)]"
          >
            <h2 className="text-xl font-bold mb-4">商品分类分布</h2>
            <div className="h-[300px] flex items-center justify-center">
              <Pie
                data={pieChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'right',
                      labels: { color: 'rgba(255, 255, 255, 0.8)' },
                    },
                  },
                }}
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 bg-black/40 backdrop-blur-md rounded-xl p-6 border border-gray-800/50 hover:border-blue-900/50 transition-all duration-300 hover:shadow-[0_0_25px_rgba(59,130,246,0.2)]"
          >
            <h2 className="text-xl font-bold mb-4">热销商品排行</h2>
            <div className="h-[300px]">
              <Bar
                data={barChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                      },
                      ticks: { 
                        color: 'rgba(255, 255, 255, 0.8)',
                        callback: (value) => `¥${value}`
                      },
                      title: {
                        display: true,
                        text: '销售额 (元)',
                        color: 'rgba(255, 255, 255, 0.8)'
                      }
                    },
                    x: {
                      grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                      },
                      ticks: { 
                        color: 'rgba(255, 255, 255, 0.8)',
                        maxRotation: 45,
                        minRotation: 45
                      }
                    },
                  },
                  plugins: {
                    legend: {
                      labels: { color: 'rgba(255, 255, 255, 0.8)' },
                    },
                    tooltip: {
                      callbacks: {
                        label: (context) => `销售额: ¥${context.raw}`
                      }
                    }
                  },
                }}
              />
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/40 backdrop-blur-md rounded-xl p-6 border border-gray-800/50 hover:border-blue-900/50 transition-all duration-300 hover:shadow-[0_0_25px_rgba(59,130,246,0.2)]"
          >
            <h2 className="text-xl font-bold mb-4">每日销售时段分布</h2>
            <div className="h-[300px]">
              <Bar
                data={{
                  labels: data.additionalMetrics.hourlyDistribution.map(d => `${d.hour}时`),
                  datasets: [{
                    label: '销售额',
                    data: data.additionalMetrics.hourlyDistribution.map(d => d.amount / 100),
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                  }]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      grid: { color: 'rgba(255, 255, 255, 0.1)' },
                      ticks: { color: 'rgba(255, 255, 255, 0.8)' }
                    },
                    x: {
                      grid: { color: 'rgba(255, 255, 255, 0.1)' },
                      ticks: { color: 'rgba(255, 255, 255, 0.8)' }
                    }
                  }
                }}
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/40 backdrop-blur-md rounded-xl p-6 border border-gray-800/50 hover:border-blue-900/50 transition-all duration-300 hover:shadow-[0_0_25px_rgba(59,130,246,0.2)]"
          >
            <h2 className="text-xl font-bold mb-4">热门商品组合</h2>
            <div className="h-[300px] overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="pb-2">组合商品</th>
                    <th className="pb-2">购买次数</th>
                  </tr>
                </thead>
                <tbody>
                  {data.additionalMetrics.topCombinations.map((combo, index) => (
                    <tr key={index} className="border-b border-gray-700">
                      <td className="py-2">{combo.products.join(' + ')}</td>
                      <td className="py-2 text-center">{combo.count}次</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/40 backdrop-blur-md rounded-xl p-6 border border-gray-800/50 hover:border-blue-900/50 transition-all duration-300 hover:shadow-[0_0_25px_rgba(59,130,246,0.2)]"
          >
            <h2 className="text-xl font-bold mb-4">滞销商品预警</h2>
            <div className="h-[300px] overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="pb-2">商品名称</th>
                    <th className="pb-2">30天销量</th>
                    <th className="pb-2">库存</th>
                  </tr>
                </thead>
                <tbody>
                  {data.additionalMetrics.slowMovingProducts.map((product, index) => (
                    <tr key={index} className="border-b border-gray-700">
                      <td className="py-2">{product.name}</td>
                      <td className="py-2 text-center">{product.sales}</td>
                      <td className="py-2 text-center">{product.available}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/40 backdrop-blur-md rounded-xl p-6 border border-gray-800/50 hover:border-blue-900/50 transition-all duration-300 hover:shadow-[0_0_25px_rgba(59,130,246,0.2)]"
          >
            <h2 className="text-xl font-bold mb-4">客户价值分布</h2>
            <div className="h-[300px]">
              <Bar
                data={{
                  labels: data.additionalMetrics.customerValueRanges.map(
                    range => `¥${(range.range / 100).toFixed(0)}-${((range.range + 10000) / 100).toFixed(0)}`
                  ),
                  datasets: [{
                    label: '客户数量',
                    data: data.additionalMetrics.customerValueRanges.map(range => range.count),
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                  }]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      grid: { color: 'rgba(255, 255, 255, 0.1)' },
                      ticks: { color: 'rgba(255, 255, 255, 0.8)' }
                    },
                    x: {
                      grid: { color: 'rgba(255, 255, 255, 0.1)' },
                      ticks: { 
                        color: 'rgba(255, 255, 255, 0.8)',
                        maxRotation: 45,
                        minRotation: 45
                      }
                    }
                  }
                }}
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/40 backdrop-blur-md rounded-xl p-6 border border-gray-800/50 hover:border-blue-900/50 transition-all duration-300 hover:shadow-[0_0_25px_rgba(59,130,246,0.2)]"
          >
            <h2 className="text-xl font-bold mb-4">地域销售分布</h2>
            <div className="h-[300px]">
              <Pie
                data={{
                  labels: data.additionalMetrics.regionDistribution.map(item => item.region),
                  datasets: [{
                    data: data.additionalMetrics.regionDistribution.map(item => item.amount / 100),
                    backgroundColor: [
                      'rgba(59, 130, 246, 0.8)',
                      'rgba(16, 185, 129, 0.8)',
                      'rgba(245, 158, 11, 0.8)',
                      'rgba(239, 68, 68, 0.8)',
                      'rgba(139, 92, 246, 0.8)',
                    ],
                  }]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'right',
                      labels: { color: 'rgba(255, 255, 255, 0.8)' }
                    },
                    tooltip: {
                      callbacks: {
                        label: (context) => `¥${context.raw}`
                      }
                    }
                  }
                }}
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/40 backdrop-blur-md rounded-xl p-6 border border-gray-800/50 hover:border-blue-900/50 transition-all duration-300 hover:shadow-[0_0_25px_rgba(59,130,246,0.2)]"
          >
            <h2 className="text-xl font-bold mb-4">热销品牌TOP10</h2>
            <div className="h-[300px]">
              <Bar
                data={{
                  labels: data.additionalMetrics.topBrands.map(brand => brand.name),
                  datasets: [
                    {
                      label: '销售额',
                      data: data.additionalMetrics.topBrands.map(brand => brand.salesAmount / 100),
                      backgroundColor: 'rgba(59, 130, 246, 0.8)',
                      yAxisID: 'y',
                    },
                    {
                      label: '商品数量',
                      data: data.additionalMetrics.topBrands.map(brand => brand.productCount),
                      backgroundColor: 'rgba(16, 185, 129, 0.8)',
                      yAxisID: 'y1',
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  interaction: {
                    mode: 'index' as const,
                    intersect: false,
                  },
                  scales: {
                    y: {
                      type: 'linear' as const,
                      display: true,
                      position: 'left' as const,
                      title: {
                        display: true,
                        text: '销售额 (元)',
                        color: 'rgba(255, 255, 255, 0.8)'
                      },
                      grid: { color: 'rgba(255, 255, 255, 0.1)' },
                      ticks: { color: 'rgba(255, 255, 255, 0.8)' }
                    },
                    y1: {
                      type: 'linear' as const,
                      display: true,
                      position: 'right' as const,
                      title: {
                        display: true,
                        text: '商品数量',
                        color: 'rgba(255, 255, 255, 0.8)'
                      },
                      grid: {
                        drawOnChartArea: false,
                      },
                      ticks: { color: 'rgba(255, 255, 255, 0.8)' }
                    },
                    x: {
                      ticks: { 
                        color: 'rgba(255, 255, 255, 0.8)',
                        maxRotation: 45,
                        minRotation: 45
                      }
                    }
                  },
                  plugins: {
                    legend: {
                      labels: { color: 'rgba(255, 255, 255, 0.8)' }
                    }
                  }
                }}
              />
            </div>
          </motion.div>

          <div className="bg-black/40 backdrop-blur-md rounded-lg p-6">
            <h3 className="text-xl font-semibold text-white mb-4">滞销品牌预警</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="pb-2 text-left">品牌</th>
                    <th className="pb-2 text-right">商品数量</th>
                    <th className="pb-2 text-right">平均销量</th>
                    <th className="pb-2 text-right">总销量</th>
                  </tr>
                </thead>
                <tbody>
                  {data.additionalMetrics.slowMovingBrands.map((brand) => (
                    <tr key={brand.name} className="border-b border-gray-700">
                      <td className="py-2 text-gray-300">{brand.name}</td>
                      <td className="py-2 text-gray-300 text-right">{brand.productCount}</td>
                      <td className="py-2 text-gray-300 text-right">
                        {brand.averageSales.toFixed(2)}
                      </td>
                      <td className="py-2 text-gray-300 text-right">
                        {brand.totalSales}
                      </td>
                    </tr>
                  ))}
                  {data.additionalMetrics.slowMovingBrands.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-gray-500">
                        暂无滞销品牌数据
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <motion.div className="lg:col-span-2 bg-black/40 backdrop-blur-md rounded-xl p-6 border border-gray-800/50 hover:border-blue-900/50 transition-all duration-300 hover:shadow-[0_0_25px_rgba(59,130,246,0.2)]">
            <h2 className="text-xl font-bold mb-4">品类市场份额趋势</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="pb-2">月份</th>
                    {data.additionalMetrics.categoryTrends[0]?.shares.map(({ category }) => (
                      <th key={category} className="pb-2">{category}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.additionalMetrics.categoryTrends.map(({ month, shares }) => (
                    <tr key={month} className="border-b border-gray-700">
                      <td className="py-2">{month}</td>
                      {shares.map(({ category, share }) => (
                        <td key={category} className="py-2 text-right">{share.toFixed(1)}%</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          <motion.div className="bg-black/40 backdrop-blur-md rounded-xl p-6 border border-gray-800/50 hover:border-blue-900/50 transition-all duration-300 hover:shadow-[0_0_25px_rgba(59,130,246,0.2)]">
            <h2 className="text-xl font-bold mb-4">新客户增长趋势</h2>
            <div className="overflow-auto h-[300px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="pb-2 sticky top-0 bg-gray-800">日期</th>
                    <th className="pb-2 text-right sticky top-0 bg-gray-800">新增客户</th>
                    <th className="pb-2 text-right sticky top-0 bg-gray-800">累计客户</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.additionalMetrics.customerGrowth]
                    .reverse() // 反转数组顺序
                    .map(({ date, new: newCount, total }) => (
                      <tr key={date} className="border-b border-gray-700 hover:bg-gray-700/50">
                        <td className="py-2">{date}</td>
                        <td className="py-2 text-right">{newCount}</td>
                        <td className="py-2 text-right">{total}</td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          <motion.div className="bg-black/40 backdrop-blur-md rounded-xl p-6 border border-gray-800/50 hover:border-blue-900/50 transition-all duration-300 hover:shadow-[0_0_25px_rgba(59,130,246,0.2)]">
            <h2 className="text-xl font-bold mb-4">客户集中度分析</h2>
            <div className="overflow-auto h-[300px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="pb-2">客户占比</th>
                    <th className="pb-2 text-right">收入占比</th>
                  </tr>
                </thead>
                <tbody>
                  {data.additionalMetrics.customerConcentration
                    .filter((_, i) => i % 5 === 0) // 每5%显示一次
                    .map(({ customerPercentage, revenuePercentage }) => (
                      <tr key={customerPercentage} className="border-b border-gray-700">
                        <td className="py-2">前{customerPercentage}%客户</td>
                        <td className="py-2 text-right">{revenuePercentage.toFixed(1)}%</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 bg-black/40 backdrop-blur-md rounded-xl p-6 border border-gray-800/50 hover:border-blue-900/50 transition-all duration-300 hover:shadow-[0_0_25px_rgba(59,130,246,0.2)]"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">店家订单分析</h2>
              <div className="text-sm text-blue-400">
                总店家数: {data.additionalMetrics.storeAnalysis.totalStores}
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 订单数量柱状图 */}
              <div className="h-[400px]">
                <Bar
                  data={{
                    labels: data.additionalMetrics.storeAnalysis.storeStats.map(store => store.storeName),
                    datasets: [{
                      label: '订单数量',
                      data: data.additionalMetrics.storeAnalysis.storeStats.map(store => store.orderCount),
                      backgroundColor: 'rgba(59, 130, 246, 0.8)',
                      borderRadius: 6,
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y' as const,
                    scales: {
                      x: {
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: 'rgba(255, 255, 255, 0.8)' }
                      },
                      y: {
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: 'rgba(255, 255, 255, 0.8)' }
                      }
                    },
                    plugins: {
                      legend: {
                        labels: { color: 'rgba(255, 255, 255, 0.8)' }
                      }
                    }
                  }}
                />
              </div>

              {/* 销售金额柱状图 */}
              <div className="h-[400px]">
                <Bar
                  data={{
                    labels: data.additionalMetrics.storeAnalysis.storeStats.map(store => store.storeName),
                    datasets: [{
                      label: '销售金额',
                      data: data.additionalMetrics.storeAnalysis.storeStats.map(store => store.totalAmount / 100),
                      backgroundColor: 'rgba(16, 185, 129, 0.8)',
                      borderRadius: 6,
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y' as const,
                    scales: {
                      x: {
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { 
                          color: 'rgba(255, 255, 255, 0.8)',
                          callback: (value) => `¥${value}`
                        }
                      },
                      y: {
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: 'rgba(255, 255, 255, 0.8)' }
                      }
                    },
                    plugins: {
                      legend: {
                        labels: { color: 'rgba(255, 255, 255, 0.8)' }
                      },
                      tooltip: {
                        callbacks: {
                          label: (context) => `销售额: ¥${context.raw}`
                        }
                      }
                    }
                  }}
                />
              </div>

              {/* 详细数据表格 */}
              <div className="lg:col-span-2 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-700">
                      <th className="pb-2 text-left">店家名称</th>
                      <th className="pb-2 text-right">订单数量</th>
                      <th className="pb-2 text-right">销售金额</th>
                      <th className="pb-2 text-right">平均订单金额</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.additionalMetrics.storeAnalysis.storeStats.map((store) => (
                      <tr key={store.storeName} className="border-b border-gray-700 hover:bg-gray-700/50">
                        <td className="py-2">{store.storeName}</td>
                        <td className="py-2 text-right">{store.orderCount}</td>
                        <td className="py-2 text-right">¥{(store.totalAmount / 100).toFixed(2)}</td>
                        <td className="py-2 text-right">
                          ¥{(store.totalAmount / (store.orderCount * 100)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .animate-blob {
          animation: blob 7s infinite;
        }

        .animate-shimmer {
          animation: shimmer 2s infinite;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .perspective-1000 {
          perspective: 1000px;
        }

        .bg-grid-pattern {
          background-image: 
            linear-gradient(to right, rgba(59,130,246,0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(59,130,246,0.1) 1px, transparent 1px);
          background-size: 40px 40px;
        }

        :root {
          color-scheme: dark        }

        .chartjs-render-monitor {
          filter: brightness(0.9) saturate(1.2);
        }
      `}</style>
    </div>
  );
}