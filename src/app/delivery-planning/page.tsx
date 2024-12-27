'use client';

import React, { useState } from 'react';
import { Card, Button, Table, message, Descriptions, Collapse, Progress, Tabs } from 'antd';
import type { Store, Vehicle, DeliveryRoute, NavigationStep, RouteStop } from './types';
import { parseStoreListJson } from './utils/fileParser';
import { RoutePlanner } from './utils/routePlanner';
import AMapContainer from './components/AMapContainer';

// 车辆配置
const VEHICLES: Vehicle[] = [
  // 货车
  {
    id: 'W56',
    name: '货车W56',
    type: 'truck',
    maxLoad: 5000,      // 5吨
    maxDistance: 300,    // 300公里
    maxWorkHours: 9,    // 9小时
    maxStores: 30,      // 增加到30家店
    priority: 3         // 高优先级
  },
  {
    id: 'K3',
    name: '货车K3',
    type: 'truck',
    maxLoad: 5000,
    maxDistance: 300,
    maxWorkHours: 9,
    maxStores: 30,
    priority: 3
  },
  {
    id: '9676',
    name: '货车9676',
    type: 'truck',
    maxLoad: 5000,
    maxDistance: 300,
    maxWorkHours: 9,
    maxStores: 30,
    priority: 3
  },
  // 金杯车
  {
    id: '509',
    name: '金杯车509',
    type: 'van',
    maxLoad: 1500,      // 1.5吨
    maxDistance: 500,    // 500公里
    maxWorkHours: 9,
    maxStores: 25,      // 增加到25家店
    priority: 1         // 低优先级
  },
  {
    id: '790',
    name: '金杯车790',
    type: 'van',
    maxLoad: 1500,
    maxDistance: 500,
    maxWorkHours: 9,
    maxStores: 25,
    priority: 1
  },
  {
    id: '57',
    name: '金杯车57',
    type: 'van',
    maxLoad: 1500,
    maxDistance: 500,
    maxWorkHours: 9,
    maxStores: 25,
    priority: 1
  }
];

const DeliveryPlanningPage: React.FC = () => {
  // 状态管理
  const [loading, setLoading] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [unlocatedStores, setUnlocatedStores] = useState<Store[]>([]);
  const [planningResults, setPlanningResults] = useState<DeliveryRoute[]>([]);
  const [planningProgress, setPlanningProgress] = useState<{
    current: number;
    total: number;
    status: string;
  }>({ current: 0, total: 0, status: '' });

  // 加载店铺数据
  const handleLoadStores = async () => {
    try {
      setLoading(true);
      const result = await parseStoreListJson();
      
      if (!result.success) {
        message.error(result.error || '加载失败');
        return;
      }

      setStores(result.stores || []);
      setUnlocatedStores(result.unlocatedStores || []);
      message.success(
        `数据加载完成: 总数${(result.stores || []).length + (result.unlocatedStores || []).length}, ` +
        `已定位${result.stores?.length || 0}, ` +
        `未定位${result.unlocatedStores?.length || 0}`
      );
    } catch (error) {
      message.error('数据加载失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
    }
  };

  // 规划路线
  const handlePlanRoutes = async () => {
    try {
      setLoading(true);
      setPlanningProgress({ current: 0, total: 0, status: '初始化路线规划...' });
      
      // 验证数据
      if (!stores.length) {
        message.error('请先加载店铺数据');
        return;
      }

      // 验证API密钥
      const amapKey = process.env.NEXT_PUBLIC_AMAP_WEB_API_KEY;
      if (!amapKey) {
        message.error('未配置高德地图API密钥');
        return;
      }

      // 创建规划器
      const planner = new RoutePlanner(
        stores, 
        VEHICLES, 
        amapKey,
        // 添加进度回调
        (progress) => {
          setPlanningProgress(progress);
        }
      );
      
      const result = await planner.plan();

      if (!result.success || !result.routes) {
        message.error(result.error || '规划失败');
        return;
      }

      setPlanningResults(result.routes);
      message.success({
        content: `路线规划完成: 共${result.routes.length}条路线`,
        duration: 5,
        style: {
          marginTop: '20vh',
        },
      });
    } catch (error) {
      console.error('规划错误:', error);
      message.error('规划失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
      setPlanningProgress({ current: 0, total: 0, status: '' });
    }
  };

  // 渲染导航步骤
  const renderNavigationSteps = (steps: NavigationStep[]) => {
    return (
      <div className="space-y-2">
        {steps.map((step, index) => (
          <div key={index} className="p-2 bg-gray-50 rounded">
            <div className="font-medium">{step.instruction}</div>
            <div className="text-sm text-gray-500">
              {step.road} ({(step.distance / 1000).toFixed(1)}公里, 约{Math.ceil(step.duration / 60)}分钟)
            </div>
            <div className="mt-1">
              <a 
                href={step.navigationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                打开高德地图导航 →
              </a>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // 渲染停靠点列表
  const renderStops = (stops: RouteStop[]) => {
    return (
      <div className="space-y-4">
        {stops.map((stop, index) => (
          <div key={index} className="p-3 bg-gray-50 rounded">
            {/* 行驶信息 */}
            {stop.drivingInfo && (
              <div className="mb-2 text-sm text-blue-600">
                <div>从 {stop.drivingInfo.from}</div>
                <div>到 {stop.drivingInfo.to}</div>
                <div>行驶距离: {(stop.drivingInfo.distance / 1000).toFixed(1)}公里</div>
                <div>行驶时间: {Math.ceil(stop.drivingInfo.duration / 60)}分钟</div>
              </div>
            )}
            {/* 店铺信息 */}
            <div className="font-medium">{stop.store.name}</div>
            <div className="text-sm text-gray-500">
              预计到达: {stop.estimatedArrival}
              <br />
              停留时间: {stop.estimatedDuration}分钟
              <br />
              地址: {stop.store.address}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // 表格列配置
  const storeColumns = [
    {
      title: '店铺名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
    },
    {
      title: '状态',
      key: 'status',
      render: (_: unknown, record: Store) => (
        record.location ? '已定位' : '未定位'
      ),
    },
  ];

  const routeColumns = [
    {
      title: '路线编号',
      key: 'index',
      render: (_: unknown, __: unknown, index: number) => `路线 ${index + 1}`,
    },
    {
      title: '配送车辆',
      key: 'vehicle',
      render: (_: unknown, record: DeliveryRoute) => (
        <div>
          <div className="font-medium">{record.vehicle.name}</div>
          <div className="text-sm text-gray-500">
            载重: {record.vehicle.maxLoad}kg
            <br />
            最大行驶: {record.vehicle.maxDistance}公里
          </div>
        </div>
      ),
    },
    {
      title: '配送信息',
      key: 'delivery',
      render: (_: unknown, record: DeliveryRoute) => {
        // 计算实际总时间（行驶时间 + 停留时间）
        const totalStopDuration = record.stops.reduce((sum, stop) => sum + stop.estimatedDuration, 0);
        const totalDrivingDuration = Math.ceil(record.totalDuration);
        const actualTotalDuration = totalDrivingDuration + totalStopDuration;
        
        return (
          <div>
            <div>总距离: {(record.totalDistance / 1000).toFixed(1)}公里</div>
            <div>行驶时间: {totalDrivingDuration}分钟</div>
            <div>停留时间: {totalStopDuration}分钟</div>
            <div className="text-blue-600">实际总时间: {actualTotalDuration}分钟</div>
            <div>店铺数: {record.stops.length}家</div>
          </div>
        );
      },
    },
    {
      title: '详细信息',
      key: 'details',
      render: (_: unknown, record: DeliveryRoute) => (
        <Collapse ghost>
          <Collapse.Panel header="查看详情" key="1">
            <Descriptions title="配送路线详情" column={1} bordered size="small">
              <Descriptions.Item label="车辆信息">
                <div>
                  名称: {record.vehicle.name}
                  <br />
                  类型: {record.vehicle.type}
                  <br />
                  最大载重: {record.vehicle.maxLoad}kg
                  <br />
                  最大行驶距离: {record.vehicle.maxDistance}公里
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="路线概况">
                <div>
                  总距离: {(record.totalDistance / 1000).toFixed(1)}公里
                  <br />
                  总时长: {record.totalDuration}分钟
                  <br />
                  店铺数量: {record.stops.length}家
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="停靠点">
                {renderStops(record.stops)}
              </Descriptions.Item>
              <Descriptions.Item label="导航步骤">
                {renderNavigationSteps(record.navigationSteps)}
              </Descriptions.Item>
            </Descriptions>
          </Collapse.Panel>
        </Collapse>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <Card title="配送规划">
        <div className="space-y-4">
          <div className="space-x-4">
            <Button 
              type="primary" 
              onClick={handleLoadStores}
              loading={loading}
            >
              加载店铺数据
            </Button>
            <Button 
              onClick={handlePlanRoutes}
              loading={loading}
              disabled={!stores.length}
            >
              开始路线规划
            </Button>
          </div>
          
          {/* 进度显示 */}
          {loading && planningProgress.total > 0 && (
            <div className="mt-4">
              <div className="text-sm text-gray-600 mb-2">
                {planningProgress.status}
              </div>
              <Progress 
                percent={Math.round((planningProgress.current / planningProgress.total) * 100)}
                status="active"
                format={(percent) => `${planningProgress.current}/${planningProgress.total} (${percent}%)`}
              />
            </div>
          )}
        </div>
      </Card>

      {(stores.length > 0 || unlocatedStores.length > 0) && (
        <Card title="店铺列表">
          <Tabs defaultActiveKey="located" items={[
            {
              key: 'located',
              label: `已定位店铺 (${stores.length})`,
              children: (
                <Table
                  dataSource={stores}
                  columns={storeColumns}
                  rowKey="id"
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total) => `共 ${total} 条`
                  }}
                  size="small"
                />
              )
            },
            {
              key: 'unlocated',
              label: `未定位店铺 (${unlocatedStores.length})`,
              children: (
                <Table
                  dataSource={unlocatedStores}
                  columns={storeColumns}
                  rowKey="id"
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total) => `共 ${total} 条`
                  }}
                  size="small"
                />
              )
            }
          ]} />
        </Card>
      )}

      <Card title="地图显示">
        <div className="h-[600px]">
          <AMapContainer stores={stores} routes={planningResults} />
        </div>
      </Card>
      
      {planningResults && planningResults.length > 0 && (
        <Card title="分配方案">
          <Table
            dataSource={planningResults}
            columns={routeColumns}
            rowKey={(_, index) => `route-${index}`}
            pagination={false}
            size="small"
          />
        </Card>
      )}
    </div>
  );
};

export default DeliveryPlanningPage; 