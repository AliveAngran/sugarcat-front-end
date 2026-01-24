"use client";

import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { checkAuth } from '@/utils/auth';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface TrendItem {
  date: string;
  orderCount: number;
  salesAmount: number;
}

interface TrendData {
  trendData: TrendItem[];
  summary: {
    totalOrders: number;
    totalSales: number;
    avgDailyOrders: number;
    avgDailySales: number;
  };
}

export default function TrendsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<TrendData | null>(null);
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  useEffect(() => {
    const auth = checkAuth();
    if (!auth) {
      router.push('/');
    }
  }, [router]);

  useEffect(() => {
    const fetchTrendData = async () => {
      try {
        const response = await fetch('/api/trends', { cache: 'no-store' });
        const result = await response.json();
        if (result.success && result.data) {
          setData(result.data);
        }
      } catch (error) {
        console.error('获取趋势数据失败:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTrendData();
  }, []);

  const aggregateData = (trendData: TrendItem[], mode: 'daily' | 'weekly' | 'monthly') => {
    if (mode === 'daily') return trendData;

    const aggregated: Record<string, { orderCount: number; salesAmount: number }> = {};
    
    trendData.forEach(item => {
      let key: string;
      const date = new Date(item.date);
      
      if (mode === 'weekly') {
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(date.setDate(diff));
        key = monday.toISOString().split('T')[0];
      } else {
        key = item.date.slice(0, 7);
      }
      
      if (!aggregated[key]) {
        aggregated[key] = { orderCount: 0, salesAmount: 0 };
      }
      aggregated[key].orderCount += item.orderCount;
      aggregated[key].salesAmount += item.salesAmount;
    });

    return Object.entries(aggregated)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({ date, ...stats }));
  };

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="w-5 h-5 border border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
      </div>
    );
  }

  const displayData = aggregateData(data.trendData, viewMode);

  const chartConfig = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    scales: {
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: 'rgba(0, 0, 0, 0.04)', drawTicks: false },
        ticks: { 
          color: 'rgba(0, 0, 0, 0.4)',
          font: { size: 11, family: 'system-ui' },
          padding: 8
        }
      },
      x: {
        border: { display: false },
        grid: { display: false },
        ticks: { 
          color: 'rgba(0, 0, 0, 0.4)',
          font: { size: 10, family: 'system-ui' },
          maxTicksLimit: viewMode === 'daily' ? 12 : 20,
          maxRotation: 0
        }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        titleColor: 'rgba(0, 0, 0, 0.8)',
        bodyColor: 'rgba(0, 0, 0, 0.6)',
        borderColor: 'rgba(0, 0, 0, 0.08)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 4,
        titleFont: { size: 12, weight: 'normal' as const },
        bodyFont: { size: 11 },
        displayColors: false
      }
    }
  };

  const orderChartData = {
    labels: displayData.map(d => d.date),
    datasets: [{
      data: displayData.map(d => d.orderCount),
      borderColor: 'rgba(0, 0, 0, 0.7)',
      backgroundColor: 'rgba(0, 0, 0, 0.02)',
      borderWidth: 1.5,
      fill: true,
      tension: 0.3,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: 'rgba(0, 0, 0, 0.8)',
      pointHoverBorderColor: '#fff',
      pointHoverBorderWidth: 2,
    }]
  };

  const salesChartData = {
    labels: displayData.map(d => d.date),
    datasets: [{
      data: displayData.map(d => d.salesAmount / 100),
      borderColor: 'rgba(0, 0, 0, 0.7)',
      backgroundColor: 'rgba(0, 0, 0, 0.02)',
      borderWidth: 1.5,
      fill: true,
      tension: 0.3,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: 'rgba(0, 0, 0, 0.8)',
      pointHoverBorderColor: '#fff',
      pointHoverBorderWidth: 2,
    }]
  };

  const salesChartOptions = {
    ...chartConfig,
    scales: {
      ...chartConfig.scales,
      y: {
        ...chartConfig.scales.y,
        ticks: { 
          ...chartConfig.scales.y.ticks,
          callback: (value: number | string) => `¥${value}` 
        }
      }
    }
  };

  return (
    <>
      <NavBar />
      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-6xl mx-auto px-6 py-16">
          
          {/* Header */}
          <header className="mb-16">
            <p className="text-xs tracking-widest text-neutral-400 uppercase mb-3">Analytics</p>
            <h1 className="text-4xl font-light text-neutral-800 tracking-tight">
              180 天趋势
            </h1>
          </header>

          {/* Metrics */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-x-12 gap-y-8 mb-20">
            {[
              { label: '总订单', value: data.summary.totalOrders.toLocaleString() },
              { label: '总销售额', value: `¥${(data.summary.totalSales / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` },
              { label: '日均订单', value: data.summary.avgDailyOrders.toFixed(1) },
              { label: '日均销售', value: `¥${(data.summary.avgDailySales / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` }
            ].map((item, i) => (
              <div key={i} className="group">
                <p className="text-xs text-neutral-400 mb-2">{item.label}</p>
                <p className="text-2xl md:text-3xl font-light text-neutral-800 tracking-tight 
                             transition-colors duration-300 group-hover:text-neutral-600">
                  {item.value}
                </p>
              </div>
            ))}
          </section>

          {/* View Toggle */}
          <div className="flex gap-6 mb-10 border-b border-neutral-200">
            {[
              { key: 'daily', label: '日' },
              { key: 'weekly', label: '周' },
              { key: 'monthly', label: '月' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setViewMode(key as 'daily' | 'weekly' | 'monthly')}
                className={`pb-3 text-sm transition-all duration-200 relative
                  ${viewMode === key 
                    ? 'text-neutral-800' 
                    : 'text-neutral-400 hover:text-neutral-600'
                  }`}
              >
                {label}
                {viewMode === key && (
                  <span className="absolute bottom-0 left-0 right-0 h-px bg-neutral-800" />
                )}
              </button>
            ))}
          </div>

          {/* Charts */}
          <div className="space-y-16">
            
            {/* Orders Chart */}
            <section>
              <div className="flex items-baseline justify-between mb-6">
                <h2 className="text-lg font-normal text-neutral-700">订单数</h2>
                <span className="text-xs text-neutral-400">
                  {displayData.length} 个数据点
                </span>
              </div>
              <div className="h-72 md:h-80">
                <Line data={orderChartData} options={chartConfig} />
              </div>
            </section>

            {/* Sales Chart */}
            <section>
              <div className="flex items-baseline justify-between mb-6">
                <h2 className="text-lg font-normal text-neutral-700">销售金额</h2>
                <span className="text-xs text-neutral-400">单位：元</span>
              </div>
              <div className="h-72 md:h-80">
                <Line data={salesChartData} options={salesChartOptions} />
              </div>
            </section>

          </div>

          {/* Footer */}
          <footer className="mt-20 pt-8 border-t border-neutral-100">
            <p className="text-xs text-neutral-300">
              数据更新于 {new Date().toLocaleDateString('zh-CN')}
            </p>
          </footer>

        </div>
      </div>
    </>
  );
}
