import { DeliveryRoute } from '../types';
import { Card, List, Typography, Space, Button } from 'antd';
import { CarOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface RouteDetailsProps {
  route: DeliveryRoute;
}

export default function RouteDetails({ route }: RouteDetailsProps) {
  return (
    <Card 
      title={
        <Space>
          <CarOutlined />
          <span>车辆: {route.vehicle.name}</span>
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      <List
        size="small"
        header={
          <div>
            <Text strong>总距离: {(route.totalDistance / 1000).toFixed(1)}公里</Text>
            <br />
            <Text strong>总时间: {route.totalDuration}分钟</Text>
            <br />
            <Button type="link" href={route.navigationUrl} target="_blank">
              查看完整导航路线
            </Button>
          </div>
        }
        dataSource={route.navigationSteps}
        renderItem={(step, index) => (
          <List.Item>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text>{index + 1}. {step.instruction}</Text>
              <Space>
                <Text type="secondary">距离: {(step.distance / 1000).toFixed(1)}公里</Text>
                <Text type="secondary">预计用时: {Math.ceil(step.duration / 60)}分钟</Text>
                <Button type="link" href={step.navigationUrl} target="_blank" size="small">
                  导航到此处
                </Button>
              </Space>
            </Space>
          </List.Item>
        )}
      />
    </Card>
  );
} 