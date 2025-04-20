'use client';

import { useState, useEffect } from 'react';
import { Form, Input, Modal, Button, Table, message } from 'antd';
import { CloudUploadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';
import NavBar from '@/components/NavBar';

interface Store {
  _openid: string;
  userStoreName: string;
  userStoreNameLiankai: string;
  salesPerson: string;
  phoneNumber: string;
  createTime: string;
  userStoreAddress?: string;
  userStorePhone?: string;
}

const StoreManagementPage: React.FC = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  // 获取店铺列表 - 修改为循环获取
  const fetchStores = async () => {
    setLoading(true);
    let allStores: Store[] = [];
    let skip = 0;
    const limit = 1000; // 每次获取的数量

    try {
      while (true) {
        console.log(`Fetching stores: skip=${skip}, limit=${limit}`);
        const response = await fetch(`/api/users?limit=${limit}&skip=${skip}`);
        const data = await response.json();

        if (data.success && data.data) {
          allStores = allStores.concat(data.data);
          console.log(`Fetched ${data.data.length} stores, total now: ${allStores.length}`);
          
          // 如果返回的数量小于请求的数量，说明是最后一页
          if (data.data.length < limit) {
            console.log('Last page reached.');
            break;
          }
          
          // 准备下一次请求
          skip += limit;
        } else {
          message.error('获取店铺列表时出错：' + (data.error || '未知错误'));
          console.error('API Error:', data);
          break; // 出错时停止循环
        }
      }
      setStores(allStores);
      console.log('Finished fetching all stores.');
    } catch (error) {
      message.error('获取店铺列表失败: ' + (error instanceof Error ? error.message : '网络错误'));
      console.error('Network or parsing Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  // 处理编辑
  const handleEdit = (store: Store) => {
    setEditingStore(store);
    form.setFieldsValue(store);
    setEditModalVisible(true);
  };

  // 保存编辑
  const handleSave = async (values: any) => {
    try {
      if (!editingStore) return;

      const response = await fetch('/api/users/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: editingStore._openid,
          ...values,
        }),
      });

      const data = await response.json();
      if (data.success) {
        message.success('更新成功');
        setEditModalVisible(false);
        fetchStores();
      } else {
        message.error('更新失败');
      }
    } catch (error) {
      message.error('更新失败');
    }
  };

  // 过滤数据
  const filteredStores = stores.filter((store) => {
    if (!searchText) return true;
    return (
      store.userStoreName?.toLowerCase().includes(searchText.toLowerCase()) ||
      store.userStoreAddress?.toLowerCase().includes(searchText.toLowerCase()) ||
      store.userStorePhone?.includes(searchText)
    );
  });

  const columns = [
    {
      title: '店铺名称',
      dataIndex: 'userStoreName',
      key: 'userStoreName',
    },
    {
      title: '连凯店铺名称',
      dataIndex: 'userStoreNameLiankai',
      key: 'userStoreNameLiankai',
    },
    {
      title: '业务员',
      dataIndex: 'salesPerson',
      key: 'salesPerson',
    },
    {
      title: '联系电话',
      dataIndex: 'phoneNumber',
      key: 'phoneNumber',
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Store) => (
        <Button type="link" onClick={() => handleEdit(record)}>
          编辑
        </Button>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-4">
        <Input.Search
          placeholder="搜索店铺名称、地址或电话"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 300 }}
        />
      </div>
      <Table
        columns={columns}
        dataSource={filteredStores}
        rowKey="_openid"
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
      />

      <Modal
        title="编辑店铺信息"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            label="店铺名称"
            name="userStoreName"
            rules={[{ required: true, message: '请输入店铺名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="连凯店铺名称"
            name="userStoreNameLiankai"
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="业务员"
            name="salesPerson"
            rules={[{ required: true, message: '请输入业务员' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="联系电话"
            name="phoneNumber"
          >
            <Input />
          </Form.Item>
          <Form.Item>
            <div className="flex justify-end space-x-4">
              <Button onClick={() => setEditModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default function Page() {
  return (
    <>
      <NavBar />
      <StoreManagementPage />
    </>
  );
} 