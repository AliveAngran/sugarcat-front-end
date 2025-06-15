"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { checkAuth } from '@/utils/auth';
import { pinyin } from 'pinyin-pro';
import { CATEGORY_NAMES } from '@/constants/categories';
import { BRAND_MAP } from '@/constants/brands';
import { salesPersonMap } from '@/constants/salespersons';

// Ant Design Components & Icons
import { Button, Input, Modal, message, Spin, Tabs, Avatar, Drawer, List, Badge, Empty, Tag, Collapse, Checkbox } from 'antd';
import { UserOutlined, SearchOutlined, ShoppingCartOutlined, PlusOutlined, MinusOutlined, CloseOutlined, FunnelPlotOutlined } from '@ant-design/icons';

// Type definitions
interface Product {
  _id: string;
  title: string;
  brand: string;
  price: string;
  primaryImage: string;
  desc: string; // e.g., "1箱*12盒*250ml"
  categoryIds?: string[];
  // Add other relevant product fields if needed
}

interface Customer {
  _id: string;
  _openid: string; // This is the actual ID for linking
  userStoreName: string;
  salesPerson: string;
  userAvatar?: string;
  // Add other relevant customer fields
}

interface CartItem {
  product: Product;
  quantity: number;
}

const SuggestOrderPage = () => {
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    
    // Data states
    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);

    // UI & interaction states
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');

    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('all');

    const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
    const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
    
    // New filter states
    const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
    const [tempSelectedBrands, setTempSelectedBrands] = useState<Set<string>>(new Set());
    const [tempSelectedCategories, setTempSelectedCategories] = useState<Set<string>>(new Set());
    const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

    const [submitting, setSubmitting] = useState(false);
    
    // Initial Auth and Data Fetching
    useEffect(() => {
        const auth = checkAuth();
        if (!auth.isAuth) {
            router.push('/');
        } else {
            setIsAuthorized(true);
            fetchInitialData(auth.role, auth.id);
        }
    }, [router]);

    const fetchInitialData = async (role: string | null, id: string | null) => {
        setInitialLoading(true);
        try {
            // Fetch customers and products in parallel
            const [customersRes, productsRes] = await Promise.all([
                fetch('/api/users'),
                fetch('/api/products')
            ]);

            const customersData = await customersRes.json();
            if (customersData.success) {
                setCustomers(customersData.data);
            } else {
                message.error('加载客户列表失败');
            }

            const productsData = await productsRes.json();
            if (productsData.success) {
                setProducts(productsData.data);
            } else {
                message.error('加载商品列表失败');
            }

        } catch (error) {
            message.error('加载基础数据失败');
            console.error(error);
        } finally {
            setInitialLoading(false);
        }
    };

    const handleAddToCart = (product: Product) => {
        const existingItem = cart.get(product._id);
        const newCart = new Map(cart);
        if (existingItem) {
            newCart.set(product._id, { ...existingItem, quantity: existingItem.quantity + 1 });
        } else {
            newCart.set(product._id, { product, quantity: 1 });
        }
        setCart(newCart);
    };
    
    const handleUpdateQuantity = (productId: string, newQuantity: number) => {
        const newCart = new Map(cart);
        if (newQuantity > 0) {
            const existingItem = newCart.get(productId);
            if(existingItem) {
                newCart.set(productId, { ...existingItem, quantity: newQuantity });
            }
        } else {
            newCart.delete(productId);
        }
        setCart(newCart);
    };

    const filteredCustomers = useMemo(() => {
        if (!customerSearchTerm) return customers;
        const lowercasedTerm = customerSearchTerm.toLowerCase();
        return customers.filter(c => 
            c.userStoreName.toLowerCase().includes(lowercasedTerm) ||
            pinyin(c.userStoreName, { toneType: 'none' }).toLowerCase().replace(/\s/g, '').includes(lowercasedTerm)
        );
    }, [customers, customerSearchTerm]);

    const allBrands = useMemo(() => {
        const brands = new Set(products.map(p => p.brand).filter(Boolean));
        return Array.from(brands).sort();
    }, [products]);

    const groupedBrands = useMemo(() => {
        const groups = new Map<string, string[]>();
        allBrands.forEach(brand => {
            const initial = pinyin(brand, { pattern: 'first', toneType: 'none' }).charAt(0).toUpperCase();
            const charCode = initial.charCodeAt(0);
            const key = (charCode >= 65 && charCode <= 90) ? initial : '#';
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(brand);
        });
        return new Map([...groups.entries()].sort());
    }, [allBrands]);
    
    const filteredProducts = useMemo(() => {
        let filtered = products;

        // 1. Filter by brand
        if (selectedBrands.size > 0) {
            filtered = filtered.filter(p => p.brand && selectedBrands.has(p.brand));
        }

        // 2. Filter by category
        if (selectedCategories.size > 0) {
            filtered = filtered.filter(p => 
                p.categoryIds && p.categoryIds.some(catId => selectedCategories.has(catId))
            );
        }

        // 3. Filter by search term
        if (productSearchTerm) {
            const lowercasedTerm = productSearchTerm.toLowerCase();
            filtered = filtered.filter(p => 
                p.title.toLowerCase().includes(lowercasedTerm) ||
                (p.brand && p.brand.toLowerCase().includes(lowercasedTerm)) ||
                pinyin(p.title, { toneType: 'none' }).toLowerCase().replace(/\s/g, '').includes(lowercasedTerm)
            );
        }
        
        return filtered;
    }, [products, productSearchTerm, selectedBrands, selectedCategories]);

    const cartArray = useMemo(() => Array.from(cart.values()), [cart]);
    const totalCartItems = useMemo(() => cartArray.reduce((sum, item) => sum + item.quantity, 0), [cartArray]);
    const totalCartPrice = useMemo(() => {
        return cartArray.reduce((sum, item) => sum + (parseFloat(item.product.price) || 0) * item.quantity, 0);
    }, [cartArray]);

    const handleSubmit = async () => {
        if (!selectedCustomer) {
            message.warning('请先选择客户');
            return;
        }
        if (cart.size === 0) {
            message.warning('购物车是空的');
            return;
        }

        setSubmitting(true);
        const { id: salespersonId, role } = checkAuth(); // From auth utils
        if (role !== 'admin' && !salespersonId) { // Admins might not have an ID but can still operate
            message.error('无法获取业务员信息，请重新登录');
            setSubmitting(false);
            return;
        }

        const productsList = cartArray.map(item => ({
            productId: item.product._id,
            productName: item.product.title,
            quantity: item.quantity,
            price: parseFloat(item.product.price) || 0
        }));

        try {
            const response = await fetch('/api/suggested-orders/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId: selectedCustomer._openid, // Using openid as the unique identifier
                    salespersonId,
                    productsList
                })
            });
            const result = await response.json();
            if (result.success) {
                message.success('建议单已成功生成！');
                // Reset state for next order
                setSelectedCustomer(null);
                setCart(new Map());
                setIsCartDrawerOpen(false);
            } else {
                throw new Error(result.error || '提交失败');
            }
        } catch (error) {
            message.error(`提交建议单失败: ${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
            setSubmitting(false);
        }
    };
    
    const handleOpenFilter = () => {
        setTempSelectedBrands(new Set(selectedBrands));
        setTempSelectedCategories(new Set(selectedCategories));
        setIsFilterDrawerOpen(true);
    };

    const handleApplyFilter = () => {
        setSelectedBrands(tempSelectedBrands);
        setSelectedCategories(tempSelectedCategories);
        setIsFilterDrawerOpen(false);
    };

    const handleClearSingleFilter = (type: 'brand' | 'category', value: string) => {
        if (type === 'brand') {
            const newBrands = new Set(selectedBrands);
            newBrands.delete(value);
            setSelectedBrands(newBrands);
        } else {
            const newCategories = new Set(selectedCategories);
            newCategories.delete(value);
            setSelectedCategories(newCategories);
        }
    };

    const handleClearAllFilters = () => {
        setSelectedBrands(new Set());
        setSelectedCategories(new Set());
    };

    if (initialLoading || !isAuthorized) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-100">
                <Spin size="large" tip="正在加载数据..." />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-gray-100">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white shadow-md p-2">
                <Button 
                    icon={<UserOutlined />} 
                    onClick={() => setIsCustomerModalOpen(true)}
                    className="w-full mb-2 text-left"
                    size="large"
                >
                    {selectedCustomer ? selectedCustomer.userStoreName : '请选择客户'}
                </Button>
                <div className="flex items-center gap-2">
                    <Input 
                        placeholder="搜索商品 (名称/品牌/编码)"
                        prefix={<SearchOutlined />}
                        value={productSearchTerm}
                        onChange={e => setProductSearchTerm(e.target.value)}
                        size="large"
                        className="flex-1"
                    />
                    <Badge dot={selectedBrands.size > 0 || selectedCategories.size > 0}>
                        <Button 
                            icon={<FunnelPlotOutlined />} 
                            onClick={handleOpenFilter}
                            size="large"
                        />
                    </Badge>
                </div>
            </header>
            
            {/* Filter Echo */}
            {(selectedBrands.size > 0 || selectedCategories.size > 0) && (
                <div className="p-2 bg-white border-b sticky top-[118px] z-10">
                    <div className="flex flex-wrap gap-2 items-center">
                        {Array.from(selectedBrands).map(brand => (
                            <Tag key={brand} closable onClose={() => handleClearSingleFilter('brand', brand)}>{BRAND_MAP[brand as keyof typeof BRAND_MAP] || brand}</Tag>
                        ))}
                        {Array.from(selectedCategories).map(catId => (
                            <Tag key={catId} closable onClose={() => handleClearSingleFilter('category', catId)}>{CATEGORY_NAMES[Number(catId) as keyof typeof CATEGORY_NAMES] || '未知分类'}</Tag>
                        ))}
                        <Button type="link" onClick={handleClearAllFilters} size="small">全部清除</Button>
                    </div>
                </div>
            )}
            
            {/* Body */}
            <main className="flex-1 overflow-y-auto p-2">
                <Tabs activeKey={activeTab} onChange={setActiveTab} centered>
                    <Tabs.TabPane tab="全部商品" key="all" />
                    <Tabs.TabPane tab="常购清单" key="frequent" disabled={!selectedCustomer} />
                    <Tabs.TabPane tab="近期活动" key="promo" />
                    <Tabs.TabPane tab="新品上架" key="new" />
                </Tabs>
                
                <List
                    dataSource={filteredProducts}
                    renderItem={product => {
                        const cartItem = cart.get(product._id);
                        return (
                            <List.Item>
                                <List.Item.Meta
                                    title={product.title}
                                    description={`¥${product.price} / ${product.desc.split('=')[1] || '件'}`}
                                />
                                <div className="flex items-center">
                                    {cartItem ? (
                                        <>
                                            <Button icon={<MinusOutlined />} onClick={() => handleUpdateQuantity(product._id, cartItem.quantity - 1)} size="small" />
                                            <span className="mx-2 w-8 text-center">{cartItem.quantity}</span>
                                            <Button icon={<PlusOutlined />} onClick={() => handleUpdateQuantity(product._id, cartItem.quantity + 1)} size="small" />
                                        </>
                                    ) : (
                                        <Button type="primary" onClick={() => handleAddToCart(product)}>添加</Button>
                                    )}
                                </div>
                            </List.Item>
                        );
                    }}
                    className="bg-white"
                />

            </main>
            
            {/* Footer / Cart FAB */}
            <div className="fixed bottom-6 right-6 z-20">
                <Badge count={totalCartItems} size="default">
                    <Button 
                        type="primary" 
                        shape="circle" 
                        icon={<ShoppingCartOutlined />}
                        size="large"
                        onClick={() => setIsCartDrawerOpen(true)}
                        className="shadow-lg"
                        style={{ width: 60, height: 60, fontSize: '24px' }}
                    />
                </Badge>
            </div>

            {/* Customer Selection Modal */}
            <Modal
                title="选择客户"
                open={isCustomerModalOpen}
                onCancel={() => setIsCustomerModalOpen(false)}
                footer={null}
                destroyOnClose
            >
                <Input 
                    placeholder="搜索客户名称"
                    prefix={<SearchOutlined />}
                    onChange={e => setCustomerSearchTerm(e.target.value)}
                    className="mb-4"
                />
                <List
                    dataSource={filteredCustomers}
                    renderItem={customer => (
                        <List.Item
                            onClick={() => {
                                setSelectedCustomer(customer);
                                setIsCustomerModalOpen(false);
                            }}
                            className="cursor-pointer hover:bg-gray-100"
                        >
                            <List.Item.Meta
                                title={customer.userStoreName}
                                description={`业务员: ${customer.salesPerson}`}
                            />
                        </List.Item>
                    )}
                    className="h-96 overflow-y-auto"
                />
            </Modal>

            {/* Cart Drawer */}
            <Drawer
                title="订单预览"
                placement="bottom"
                onClose={() => setIsCartDrawerOpen(false)}
                open={isCartDrawerOpen}
                height="80%"
            >
                {cart.size === 0 ? (
                    <Empty description="购物车是空的" />
                ) : (
                    <div className="flex flex-col h-full">
                        <div className="flex-1 overflow-y-auto p-2">
                            <List
                                dataSource={cartArray}
                                renderItem={item => (
                                    <List.Item>
                                        <List.Item.Meta
                                            title={item.product.title}
                                            description={`¥${item.product.price}`}
                                        />
                                        <div className="flex items-center">
                                            <Button icon={<MinusOutlined />} onClick={() => handleUpdateQuantity(item.product._id, item.quantity - 1)} size="small" />
                                            <span className="mx-2 w-8 text-center">{item.quantity}</span>
                                            <Button icon={<PlusOutlined />} onClick={() => handleUpdateQuantity(item.product._id, item.quantity + 1)} size="small" />
                                        </div>
                                    </List.Item>
                                )}
                            />
                        </div>
                        <footer className="p-4 border-t bg-white">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-lg font-bold">总计:</span>
                                <span className="text-xl font-bold text-red-600">¥{totalCartPrice.toFixed(2)}</span>
                            </div>
                            <Button 
                                type="primary" 
                                block 
                                size="large"
                                onClick={handleSubmit}
                                loading={submitting}
                            >
                                {submitting ? '正在提交...' : '生成建议单'}
                            </Button>
                        </footer>
                    </div>
                )}
            </Drawer>

            {/* Filter Drawer */}
            <Drawer
                title="筛选商品"
                placement="right"
                onClose={() => setIsFilterDrawerOpen(false)}
                open={isFilterDrawerOpen}
                width="85%"
                bodyStyle={{ padding: 0 }}
                footer={
                    <div className="flex justify-between p-2">
                        <Button onClick={() => {
                            setTempSelectedBrands(new Set());
                            setTempSelectedCategories(new Set());
                        }}>重置</Button>
                        <Button type="primary" onClick={handleApplyFilter}>
                            确定
                        </Button>
                    </div>
                }
            >
                <Collapse defaultActiveKey={['1']} ghost>
                    <Collapse.Panel header="按品牌筛选" key="1">
                        <div className="h-64 overflow-y-auto px-4">
                            {Array.from(groupedBrands.keys()).map(initial => (
                                <div key={initial}>
                                    <p className="font-bold text-gray-500 py-1">{initial}</p>
                                    {groupedBrands.get(initial)?.map(brand => (
                                        <Checkbox
                                            key={brand}
                                            checked={tempSelectedBrands.has(brand)}
                                            onChange={e => {
                                                const newSet = new Set(tempSelectedBrands);
                                                e.target.checked ? newSet.add(brand) : newSet.delete(brand);
                                                setTempSelectedBrands(newSet);
                                            }}
                                            className="block ml-2"
                                        >
                                            {BRAND_MAP[brand as keyof typeof BRAND_MAP] || brand}
                                        </Checkbox>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </Collapse.Panel>
                    <Collapse.Panel header="按分类筛选" key="2">
                         <div className="h-64 overflow-y-auto px-4">
                            {Object.entries(CATEGORY_NAMES).map(([id, name]) => (
                                <Checkbox
                                    key={id}
                                    checked={tempSelectedCategories.has(id)}
                                    onChange={e => {
                                        const newSet = new Set(tempSelectedCategories);
                                        e.target.checked ? newSet.add(id) : newSet.delete(id);
                                        setTempSelectedCategories(newSet);

                                    }}
                                    className="block ml-2 mb-1"
                                >
                                    {name}
                                </Checkbox>
                            ))}
                        </div>
                    </Collapse.Panel>
                </Collapse>
            </Drawer>
        </div>
    );
};

export default SuggestOrderPage; 