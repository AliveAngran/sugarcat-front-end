'use client';

import { useState, useEffect } from 'react';
import { Form, Input, Modal, Button, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CloudUploadOutlined, EditOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';
import NavBar from '@/components/NavBar';
import React from 'react';
import * as XLSX from 'xlsx';

interface Store {
  _openid: string;
  userStoreName: string;
  userStoreNameLiankai: string;
  salesPerson: string;
  phoneNumber: string;
  createTime: string;
  userStoreAddress?: string;
  userStorePhone?: string;
  hasOrdered?: boolean;
}

const salesPersonMap = {
  847392: '张倩倩',
  156234: '赵志忠',
  739481: '魏经选',
  628451: '李傲然',
  394756: '李兵',
  582647: '刘飞',
  916374: '赵智国',
  473819: '陈华',
  285946: '纪中乐',
  647193: '李伟斌',
  528461: '王亮亮',
  374851: '王从洁',
  194627: '王俊男',
  836492: '杨晓',
  729384: '杨雪峰',
  463728: '王盼盼',
  591837: '杨春红',
  313049: '陈俊辉',
  497192: '张世虎',
  897979: '姚雨轩',
};

const StoreManagementPage: React.FC = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();
  const [isUpdatingOrderStatus, setIsUpdatingOrderStatus] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // 获取店铺列表 - 修改为循环获取，最多 5000 条
  const fetchStores = async () => {
      setLoading(true);
    let allStores: Store[] = [];
    let skip = 0;
    const limit = 1000; // 每次获取的数量
    const maxStores = 5000; // 最多获取的总数

    try {
      while (true) {
        // 增加总数限制检查
        if (allStores.length >= maxStores) {
          console.log(`Reached max store limit of ${maxStores}. Stopping fetch.`);
          break;
        }

        console.log(`Fetching stores: skip=${skip}, limit=${limit}`);
        const response = await fetch(`/api/users?limit=${limit}&skip=${skip}`);
      const data = await response.json();

        if (data.success && data.data) {
          const fetchedCount = data.data.length;
          // 计算还能添加多少店铺以不超过 maxStores
          const remainingSpace = maxStores - allStores.length;
          const storesToAdd = fetchedCount > remainingSpace ? data.data.slice(0, remainingSpace) : data.data;
          
          allStores = allStores.concat(storesToAdd);
          console.log(`Fetched ${fetchedCount} stores (added ${storesToAdd.length}), total now: ${allStores.length}`);
          
          // 如果实际获取的数量小于请求的数量，说明是最后一页
          if (fetchedCount < limit) {
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
      console.log(`Finished fetching stores. Total loaded: ${allStores.length}`);
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

  // 新增：处理更新店铺下单状态的函数
  const handleUpdateOrderedStatus = async () => {
    setIsUpdatingOrderStatus(true);
    try {
      const response = await fetch('/api/users/mark-ordered-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const result = await response.json();
      if (result.success) {
        message.success(`成功更新 ${result.updatedCount} 个店铺的下单状态。`);
        // 可以选择重新获取店铺数据以在界面上反映变化
        // fetchStores(); 
      } else {
        message.error('更新下单状态失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      message.error('更新下单状态操作失败: ' + (error instanceof Error ? error.message : '网络错误'));
    } finally {
      setIsUpdatingOrderStatus(false);
    }
  };

  // 过滤数据
  const filteredStores = stores.filter((store) => {
    if (!searchText) return true;
    const lowerSearchText = searchText.toLowerCase();
    return (
      store.userStoreName?.toLowerCase().includes(lowerSearchText) ||
      store.userStoreNameLiankai?.toLowerCase().includes(lowerSearchText) ||
      store.salesPerson?.toLowerCase().includes(lowerSearchText) ||
      store.userStoreAddress?.toLowerCase().includes(lowerSearchText) ||
      store.userStorePhone?.includes(searchText) ||
      store.phoneNumber?.includes(searchText)
    );
  });

  // 新增：导出 Excel 的函数
  const handleExportExcel = () => {
    if (filteredStores.length === 0) {
      message.warning('没有可导出的数据');
      return;
    }
    setIsExporting(true);
    try {
      // 定义表头顺序和中文名 (可以根据需要调整)
      const header = {
        userStoreName: '店铺名称',
        userStoreNameLiankai: '连凯店铺名称',
        salesPerson: '业务员',
        phoneNumber: '联系电话',
        userStoreAddress: '店铺地址',
        userStorePhone: '店铺电话',
        createTime: '创建时间',
        hasOrdered: '是否下单',
        _openid: '用户OpenID' // 如果需要导出 openid
      };

      // 准备导出的数据，只包含表头中定义的字段，并按表头顺序排列
      const dataToExport = filteredStores.map(store => {
        const row: any = {};
        for (const key in header) {
          if (key === 'hasOrdered') {
            row[(header as any)[key]] = store.hasOrdered === true ? '是' : (store.hasOrdered === false ? '否' : '未知');
          } else if (key === 'createTime') {
            row[(header as any)[key]] = store.createTime ? new Date(store.createTime).toLocaleString() : '';
          } else {
            row[(header as any)[key]] = (store as any)[key] !== undefined && (store as any)[key] !== null ? String((store as any)[key]) : '';
          }
        }
        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "店铺列表");

      // 生成 Excel 文件并下载
      const fileName = `店铺列表_${new Date().toISOString().slice(0,10)}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      message.success(`成功导出 ${filteredStores.length} 条店铺数据到 ${fileName}`);
    } catch (error) {
      console.error('导出 Excel 失败:', error);
      message.error('导出 Excel 失败');
    } finally {
      setIsExporting(false);
    }
  };

  const columns: ColumnsType<Store> = [
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
      filters: Object.entries(salesPersonMap).map(([_, name]) => ({
        text: name,
        value: name,
      })),
      onFilter: (value: React.Key | boolean, record: Store) => record.salesPerson === value,
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
      title: '是否下单',
      dataIndex: 'hasOrdered',
      key: 'hasOrdered',
      render: (hasOrdered?: boolean) => (
        hasOrdered === true ? 
          <span style={{ color: 'green', fontWeight: 'bold' }}>是</span> :
          <span style={{ color: 'red' }}>否</span>
      ),
      filters: [
        { text: '已下单', value: true },
        { text: '未下单', value: false },
      ],
      onFilter: (value: React.Key | boolean, record: Store) => {
        if (value === false) {
          return record.hasOrdered === false || record.hasOrdered === undefined;
        }
        return record.hasOrdered === value;
      },
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
      <div className="mb-4 flex justify-between items-center">
          <Input.Search
          placeholder="搜索店铺名称、连凯名称、业务员、地址或电话"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 400 }}
          />
        <div className="flex space-x-2">
          <Button
            type="primary"
            onClick={handleExportExcel}
            loading={isExporting}
            icon={<DownloadOutlined />}
          >
            导出 Excel
          </Button>
        </div>
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