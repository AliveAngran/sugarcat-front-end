'use client';

import React, { useState } from 'react';
import { Card, Button, Table, message, Descriptions, Collapse } from 'antd';
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
    maxStores: 20,      // 20家店
    priority: 3         // 高优先级
  },
  {
    id: 'K3',
    name: '货车K3',
    type: 'truck',
    maxLoad: 5000,
    maxDistance: 300,
    maxWorkHours: 9,
    maxStores: 20,
    priority: 3
  },
  {
    id: '9676',
    name: '货车9676',
    type: 'truck',
    maxLoad: 5000,
    maxDistance: 300,
    maxWorkHours: 9,
    maxStores: 20,
    priority: 3
  },
  // 金杯车
  {
    id: '509',
    name: '金杯车509',
    type: 'van',
    maxLoad: 1500,      // 1.5吨
    maxDistance: 200,    // 200公里
    maxWorkHours: 9,
    maxStores: 20,
    priority: 1         // 低优先级
  },
  {
    id: '790',
    name: '金杯车790',
    type: 'van',
    maxLoad: 1500,
    maxDistance: 200,
    maxWorkHours: 9,
    maxStores: 20,
    priority: 1
  },
  {
    id: '57',
    name: '金杯车57',
    type: 'van',
    maxLoad: 1500,
    maxDistance: 200,
    maxWorkHours: 9,
    maxStores: 20,
    priority: 1
  }
];

const DeliveryPlanningPage: React.FC = () => {
  // 状态管理
  const [loading, setLoading] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [planningResults, setPlanningResults] = useState<DeliveryRoute[]>([]);

  // 加载店铺数据
  const handleLoadStores = async () => {
    try {
      setLoading(true);
      const result = await parseStoreListJson();
      
      if (!result.success || !result.stores) {
        message.error(result.error || '加载失败');
        return;
      }

      setStores(result.stores);
      message.success(`数据加载完成: 总数${result.stores.length}, 已定位${result.stores.filter(s => s.location).length}`);
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
      const planner = new RoutePlanner(stores, VEHICLES, amapKey);
      const result = await planner.plan();

      if (!result.success || !result.routes) {
        message.error(result.error || '规划失败');
        return;
      }

      setPlanningResults(result.routes);
      message.success(`规划完成: 共${result.routes.length}条路线`);
    } catch (error) {
      console.error('规划错误:', error);
      message.error('规划失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
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
          </div>
        ))}
      </div>
    );
  };

  // 渲染停靠点列表
  const renderStops = (stops: RouteStop[]) => {
    return (
      <div className="space-y-2">
        {stops.map((stop, index) => (
          <div key={index} className="p-2 bg-gray-50 rounded">
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
      render: (_: unknown, record: DeliveryRoute) => (
        <div>
          <div>总距离: {(record.totalDistance / 1000).toFixed(1)}公里</div>
          <div>总时长: {record.totalDuration}分钟</div>
          <div>店铺数: {record.stops.length}家</div>
        </div>
      ),
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
      </Card>

      {stores.length > 0 && (
        <Card title="店铺列表">
          <Table
            dataSource={stores}
            columns={storeColumns}
            rowKey="id"
            pagination={false}
            size="small"
          />
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