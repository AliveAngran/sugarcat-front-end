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
    maxDistance: 500,    // 300公里
    maxWorkHours: 9,    // 9小时
    maxStores: 30,      // 增加到30家店
    priority: 3         // 高优先级
  },
  {
    id: 'K3',
    name: '货车K3',
    type: 'truck',
    maxLoad: 5000,
    maxDistance: 500,
    maxWorkHours: 9,
    maxStores: 30,
    priority: 3
  },
  {
    id: '9676',
    name: '货车9676',
    type: 'truck',
    maxLoad: 5000,
    maxDistance: 500,
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
      
      // 计算未分配的店铺
      const assignedStoreIds = new Set(
        result.routes.flatMap(route => route.stops.map(stop => stop.store.id))
      );
      const unassignedStores = stores.filter(store => !assignedStoreIds.has(store.id));
      
      message.success({
        content: `路线规划完成: 共${result.routes.length}条路线，已分配${assignedStoreIds.size}家店铺，未分配${unassignedStores.length}家店铺`,
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

  // 渲染单个路线的详细信息
  const renderRouteDetail = (route: DeliveryRoute) => {
    // 计算实际总时间（行驶时间 + 停留时间）
    const totalStopDuration = route.stops.reduce((sum, stop) => sum + stop.estimatedDuration, 0);
    const totalDrivingDuration = Math.ceil(route.totalDuration);
    const actualTotalDuration = totalDrivingDuration + totalStopDuration;

    return (
      <Card className="mb-4">
        <Tabs
          defaultActiveKey="overview"
          items={[
            {
              key: 'overview',
              label: '路线概览',
              children: (
                <div className="space-y-4">
                  {/* 车辆信息 */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-lg font-medium mb-2">{route.vehicle.name}</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-gray-500">载重能力</div>
                        <div>{route.vehicle.maxLoad}kg</div>
                      </div>
                      <div>
                        <div className="text-gray-500">最大行驶</div>
                        <div>{route.vehicle.maxDistance}公里</div>
                      </div>
                      <div>
                        <div className="text-gray-500">工作时间</div>
                        <div>{route.vehicle.maxWorkHours}小时</div>
                      </div>
                      <div>
                        <div className="text-gray-500">最大店铺数</div>
                        <div>{route.vehicle.maxStores}家</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* 路线统计 */}
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-lg font-medium mb-2">路线统计</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-gray-500">总距离</div>
                        <div>{(route.totalDistance / 1000).toFixed(1)}公里</div>
                      </div>
                      <div>
                        <div className="text-gray-500">总时间</div>
                        <div>{actualTotalDuration}分钟</div>
                      </div>
                      <div>
                        <div className="text-gray-500">行驶时间</div>
                        <div>{totalDrivingDuration}分钟</div>
                      </div>
                      <div>
                        <div className="text-gray-500">停留时间</div>
                        <div>{totalStopDuration}分钟</div>
                      </div>
                      <div>
                        <div className="text-gray-500">店铺数量</div>
                        <div>{route.stops.length}家</div>
                      </div>
                      <div>
                        <div className="text-gray-500">平均停留</div>
                        <div>{Math.round(totalStopDuration / route.stops.length)}分钟/店</div>
                      </div>
                    </div>
                  </div>

                  {/* 完整路线导航 */}
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <div className="text-lg font-medium mb-2">一键导航</div>
                    <a 
                      href={route.navigationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                    >
                      打开完整路线导航
                    </a>
                  </div>
                </div>
              )
            },
            {
              key: 'stops',
              label: '店铺列表',
              children: (
                <div className="space-y-4">
                  {route.stops.map((stop, index) => (
                    <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-lg font-medium">{stop.store.name}</div>
                          <div className="text-gray-500">{stop.store.address}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-500">预计到达</div>
                          <div>{stop.estimatedArrival}</div>
                        </div>
                      </div>
                      
                      {stop.drivingInfo && (
                        <div className="mt-2 pt-2 border-t">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-gray-500">从</div>
                              <div>{stop.drivingInfo.from}</div>
                            </div>
                            <div>
                              <div className="text-gray-500">到</div>
                              <div>{stop.drivingInfo.to}</div>
                            </div>
                            <div>
                              <div className="text-gray-500">行驶距离</div>
                              <div>{(stop.drivingInfo.distance / 1000).toFixed(1)}公里</div>
                            </div>
                            <div>
                              <div className="text-gray-500">行驶时间</div>
                              <div>{Math.ceil(stop.drivingInfo.duration / 60)}分钟</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            },
            {
              key: 'navigation',
              label: '导航步骤',
              children: (
                <div className="space-y-4">
                  {route.navigationSteps.map((step, index) => (
                    <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{step.instruction}</div>
                          <div className="text-gray-500 mt-1">{step.road}</div>
                        </div>
                        <div className="text-right">
                          <div>{(step.distance / 1000).toFixed(1)}公里</div>
                          <div className="text-gray-500">约{Math.ceil(step.duration / 60)}分钟</div>
                        </div>
                      </div>
                      <div className="mt-2">
                        <a 
                          href={step.navigationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm inline-flex items-center"
                        >
                          打开导航 <span className="ml-1">→</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          ]}
        />
      </Card>
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center mb-4">
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

              <Button 
                type="link"
                href="/lucky-draw"
                className="float-right"
                style={{ 
                  background: 'linear-gradient(45deg, #e74c3c, #f39c12)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '20px',
                  padding: '4px 15px'
                }}
              >
                🎉 抽奖活动
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
      </div>

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
        <Card 
          title={
            <div className="flex justify-between items-center">
              <span>配送方案</span>
              <div className="text-right">
                <div className="text-gray-500">
                  共{planningResults.length}条路线，
                  {planningResults.reduce((sum, route) => sum + route.stops.length, 0)}家店铺
                </div>
                <div className="text-orange-500 text-sm">
                  {stores.length - planningResults.reduce((sum, route) => sum + route.stops.length, 0)}家店铺未分配
                </div>
              </div>
            </div>
          }
        >
          <div className="mb-4 bg-orange-50 p-4 rounded-lg">
            <div className="font-medium mb-2">规划说明</div>
            <div className="text-sm text-gray-600">
              • 车辆配置：
              <br />
              - 货车：建议配送30家店铺
              <br />
              - 金杯车：建议配送25家店铺
              <br />
              • 规划策略：
              <br />
              - 优先使用货车配送
              <br />
              - 优先处理远距离区域
              <br />
              - 确保所有店铺都被分配到路线中
            </div>
          </div>

          <Tabs
            defaultActiveKey="0"
            items={[
              ...planningResults.map((route, index) => ({
                key: String(index),
                label: `路线 ${index + 1} (${route.vehicle.name})`,
                children: renderRouteDetail(route)
              })),
              {
                key: 'unassigned',
                label: `未分配店铺 (${stores.length - planningResults.reduce((sum, route) => sum + route.stops.length, 0)})`,
                children: (
                  <div className="space-y-4">
                    <div className="bg-orange-50 p-4 rounded-lg">
                      以下店铺由于各种限制条件未能分配到路线中：
                    </div>
                    <Table
                      dataSource={stores.filter(store => 
                        !planningResults.some(route => 
                          route.stops.some(stop => stop.store.id === store.id)
                        )
                      )}
                      columns={[
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
                          title: '到配送中心距离',
                          key: 'distance',
                          render: (_, record: Store) => {
                            if (!record.location) return '-';
                            const distance = Math.sqrt(
                              Math.pow(record.location.latitude - 30.877369, 2) +
                              Math.pow(record.location.longitude - 120.093902, 2)
                            ) * 111; // 粗略计算公里数
                            return `${distance.toFixed(1)}公里`;
                          }
                        }
                      ]}
                      rowKey="id"
                      size="small"
                      pagination={false}
                    />
                  </div>
                )
              }
            ]}
          />
        </Card>
      )}
    </div>
  );
};

export default DeliveryPlanningPage; 