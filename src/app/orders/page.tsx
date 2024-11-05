"use client";

import { useEffect, useState } from "react";
import { db, dbPromise } from "@/utils/cloudbase";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const formatMoney = (amount: number) => {
  return (amount / 100).toFixed(2);
};

// 修改时间格式化函数
const formatDate = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Shanghai",
    });
  } catch (error) {
    console.error("时间格式化错误:", error);
    return "时间格式错误";
  }
};

type User = {
  userStoreName: string;
  salesPerson: string;
  // 其他属性...
};

interface ParsedDescription {
  formattedDesc: string;
  unitType: string;
  unitsPerUnit: number | null;
  totalUnitType: string;
}

interface Goods {
  spuId: string;
  goodsName: string;
  price: number;
  quantity: number;
}

interface GoodsWithDesc extends Goods {
  desc: string;
  unitType: string;
  unitsPerUnit: number | null;
  totalUnitType: string;
  spuName: string;
}

const parseDescription = (desc: string): ParsedDescription => {
  const threePartMatch = desc.match(
    /(\d+)箱=(\d+)(盒|包|袋|板|大盒)=(\d+)(片|支|个|只|包|条|块|瓶|罐|袋|盒)/
  );
  if (threePartMatch) {
    const [, boxes, unitsPerBox, unitType, totalUnits, totalUnitType] =
      threePartMatch;
    const unitsPerUnit =
      unitsPerBox !== "0"
        ? parseInt(totalUnits, 10) / parseInt(unitsPerBox, 10)
        : null;
    return {
      formattedDesc: `${boxes}箱=${totalUnits}${totalUnitType}，1${unitType}=${unitsPerUnit}${totalUnitType}`,
      unitType,
      unitsPerUnit,
      totalUnitType,
    };
  }
  return {
    formattedDesc: desc,
    unitType: "",
    unitsPerUnit: null,
    totalUnitType: "",
  };
};

type OrderType = {
  _id: string;
  orderNo: string;
  orderStatus: number;
  paymentAmount: number;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  createTime: string | number;
  userStoreName?: string;
  goodsList: GoodsWithDesc[];
  _openid: string;
  salesPerson?: string;
};

function OrderList() {
  const [orders, setOrders] = useState<OrderType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [accessKey, setAccessKey] = useState<string>("");
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [exporting, setExporting] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const correctAccessKey = "chaodan"; // 设定正确的访问密钥

  const handleAccessKeySubmit = () => {
    if (accessKey === correctAccessKey) {
      setIsAuthorized(true);
    } else {
      alert("访问密钥错误");
    }
  };

  const toggleOrder = (orderId: string) => {
    setExpandedOrders((prev) => {
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
    if (isAuthorized) {
      const testConnection = async () => {
        try {
          const database = await dbPromise;
          console.log("数据库实例:", database);

          if (!database) {
            throw new Error("数据库初始化失败");
          }

          const userResult = await database.collection("users").limit(10).get();

          console.log("测试查询用户结果:", userResult);

          if (userResult && userResult.data && userResult.data.length > 0) {
            userResult.data.forEach((user: User, index: number) => {
              console.log(
                `第${index + 1}个用户的商店名称:`,
                user.userStoreName
              );
            });
          } else {
            console.log("未找到用户数据");
          }
        } catch (err) {
          console.error("数据库测试失败:", err);
        }
      };

      testConnection();
    }
  }, [isAuthorized]);

  useEffect(() => {
    if (isAuthorized) {
      const fetchOrders = async () => {
        try {
          const database = await dbPromise;

          if (!database) {
            throw new Error("数据库初始化失败");
          }

          console.log("开始获取订单数据...");

          const result = await database
            .collection("orders")
            .orderBy("createTime", "desc")
            .limit(100)
            .get();

          if (!result || !result.data) {
            throw new Error("返回数据格式异常");
          }

          const ordersWithDetails = await Promise.all(
            result.data.map(async (order: any) => {
              try {
                const userResult = await database
                  .collection("users")
                  .where({
                    _openid: order._openid,
                  })
                  .get();

                const userStoreName =
                  userResult.data && userResult.data.length > 0
                    ? userResult.data[0].userStoreName || "未知店家"
                    : "未知店家";

                const salesPerson =
                  userResult.data && userResult.data.length > 0
                    ? userResult.data[0].salesPerson || "未知"
                    : "未知";

                const goodsWithDesc = await Promise.all(
                  order.goodsList.map(async (goods: any) => {
                    try {
                      const spuResult = await database
                        .collection("spu_db")
                        .where({
                          spuId: goods.spuId,
                        })
                        .get();

                      let spuDesc =
                        spuResult.data && spuResult.data.length > 0
                          ? spuResult.data[0].desc || "无描述"
                          : "无描述";

                      const parsedDesc = parseDescription(spuDesc);

                      const spuName =
                        spuResult.data && spuResult.data.length > 0
                          ? spuResult.data[0].spuName || "未知SPU"
                          : "未知SPU";

                      return {
                        ...goods,
                        desc: parsedDesc.formattedDesc,
                        unitType: parsedDesc.unitType,
                        unitsPerUnit: parsedDesc.unitsPerUnit,
                        totalUnitType: parsedDesc.totalUnitType,
                        spuName, // 添加 spuName
                      };
                    } catch (err) {
                      console.error(`获取商品 ${goods.spuId} 描述失败:`, err);
                      return {
                        ...goods,
                        desc: "无描述",
                        unitType: "",
                        unitsPerUnit: null,
                        totalUnitType: "",
                        spuName: "未知SPU", // 添加默认 spuName
                      };
                    }
                  })
                );

                return {
                  ...order,
                  userStoreName,
                  salesPerson,
                  goodsList: goodsWithDesc,
                };
              } catch (err) {
                console.error(`获取订单 ${order._id} 详情失败:`, err);
                return {
                  ...order,
                  userStoreName: "未知店家",
                  salesPerson: "未知",
                  goodsList: order.goodsList.map((goods: any) => ({
                    ...goods,
                    spuName: "未知SPU", // 添加默认 spuName
                  })),
                };
              }
            })
          );

          setOrders(ordersWithDetails);
          setError(null);
        } catch (err) {
          console.error("获取订单失败:", err);
          console.error(
            "错误详细信息:",
            err instanceof Error ? err.stack : err
          );
          setError(err instanceof Error ? err.message : "获取数据失败");
        } finally {
          setLoading(false);
        }
      };

      fetchOrders();
    }
  }, [isAuthorized]);

  const getOrderStatusText = (status: number) => {
    switch (status) {
      case 10:
        return "待发货";
      case 40:
        return "运送中（待收货）";
      case 50:
        return "已完成";
      case 80:
        return "已取消";
      default:
        return "未知状态";
    }
  };

  const getOrderStatusStyle = (status: number) => {
    switch (status) {
      case 10:
        return "bg-blue-100 text-blue-800 border border-blue-300";
      case 40:
        return "bg-yellow-100 text-yellow-800 border border-yellow-300";
      case 50:
        return "bg-green-100 text-green-800 border border-green-300";
      case 80:
        return "bg-gray-100 text-gray-800 border border-gray-300";
      default:
        return "bg-gray-100 text-gray-800 border border-gray-300";
    }
  };

  const toggleSelectMode = () => {
    setSelectMode(!selectMode);
    setSelectedOrders(new Set());
  };

  const toggleSelectOrder = (orderId: string) => {
    setSelectedOrders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const exportToPDF = async (selectedOnly: boolean = false) => {
    if (!confirm("确认导出所选订单数据？")) return;

    setExporting(true);
    try {
      const element = document.getElementById("orders-container");
      if (!element) return;

      // 检查是否有选中的订单
      if (selectedOnly && selectedOrders.size === 0) {
        alert("请先选择要导出的订单");
        return;
      }

      // 获取所有订单元素
      const orderElements = element.querySelectorAll(".order-item");
      let isFirstPage = true;

      // 创建PDF文档
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // A4纸的尺寸（以毫米为单位）
      const A4_WIDTH_MM = 210;
      const A4_HEIGHT_MM = 297;
      const MARGIN_MM = 10;

      // 逐个处理订单
      for (let i = 0; i < orderElements.length; i++) {
        const orderElement = orderElements[i] as HTMLElement;
        const orderId = orderElement.getAttribute("data-order-id");

        // 如果是选择导出模式，跳过未选中的订单
        if (selectedOnly && (!orderId || !selectedOrders.has(orderId))) {
          continue;
        }

        // 临时展开当前订单
        if (orderId) {
          setExpandedOrders((prev) => {
            const newSet = new Set(prev);
            newSet.add(orderId);
            return newSet;
          });
        }

        // 等待DOM更新
        await new Promise((resolve) => setTimeout(resolve, 100));

        // 为每个订单创建画布
        const canvas = await html2canvas(orderElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          windowWidth: element.scrollWidth,
          allowTaint: true,
        });

        // 计算缩放比例以适应页面宽度
        const imgWidth = A4_WIDTH_MM - 2 * MARGIN_MM;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        // 检查是否需要新页面
        if (!isFirstPage) {
          pdf.addPage();
        }
        isFirstPage = false;

        // 将订单添加到PDF
        const imgData = canvas.toDataURL("image/jpeg", 1.0);
        pdf.addImage(
          imgData,
          "JPEG",
          MARGIN_MM,
          MARGIN_MM,
          imgWidth,
          imgHeight,
          "",
          "FAST"
        );

        // 恢复订单折叠状态
        if (orderId) {
          setExpandedOrders((prev) => {
            const newSet = new Set(prev);
            newSet.delete(orderId);
            return newSet;
          });
        }
      }

      // 保存PDF
      pdf.save(`订单列表_${new Date().toLocaleDateString()}.pdf`);
    } catch (error) {
      console.error("PDF导出失败:", error);
      alert("PDF导出失败，请重试");
    } finally {
      setExporting(false);
      if (selectedOnly) {
        setSelectMode(false);
        setSelectedOrders(new Set());
      }
    }
  };

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-r from-purple-800 to-blue-600">
        <div className="bg-black bg-opacity-50 p-8 rounded-xl shadow-2xl backdrop-filter backdrop-blur-lg border border-gray-700">
          <h2 className="text-3xl text-white mb-6 text-center">
            请输入访问密钥
          </h2>
          <div className="flex flex-col items-center">
            <input
              type="password"
              placeholder="访问密钥"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              className="w-80 px-4 py-2 mb-4 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-400"
            />
            <button
              onClick={handleAccessKeySubmit}
              className="w-80 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-purple-600 hover:to-blue-500 text-white font-semibold py-2 rounded-lg transition duration-300 ease-in-out transform hover:scale-105"
            >
              提交
            </button>
          </div>
        </div>
      </div>
    );
  }

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
      <div className="container mx-auto px-2 py-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-4xl font-bold text-gray-800">订单列表</h1>
          <div className="space-x-4">
            <button
              onClick={toggleSelectMode}
              className={`px-6 py-2 rounded-lg transition duration-200 ${
                selectMode
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {selectMode ? "取消选择" : "选择订单"}
            </button>
            {selectMode && (
              <button
                onClick={() => exportToPDF(true)}
                disabled={exporting || selectedOrders.size === 0}
                className="bg-green-600 text-white rounded-lg px-6 py-2 hover:bg-green-700 transition duration-200 disabled:bg-gray-400"
              >
                {exporting ? "导出中..." : `导出所选(${selectedOrders.size})`}
              </button>
            )}
            {!selectMode && (
              <button
                onClick={() => exportToPDF(false)}
                disabled={exporting}
                className="bg-green-600 text-white rounded-lg px-6 py-2 hover:bg-green-700 transition duration-200 disabled:bg-gray-400"
              >
                {exporting ? "导出中..." : "导出全部"}
              </button>
            )}
          </div>
        </div>

        <div id="orders-container" className="space-y-2 print:space-y-8">
          {orders.map((order, index) => (
            <div
              key={order._id}
              data-order-id={order._id}
              className={`
                order-item
                bg-white rounded-lg shadow-md p-4 border border-gray-300 
                print:break-inside-avoid-page 
                print:mb-8
                ${order.orderStatus === 80 ? "bg-gray-100" : ""}
                ${selectMode ? "cursor-pointer" : ""}
                ${
                  selectMode && selectedOrders.has(order._id)
                    ? "ring-2 ring-blue-500"
                    : ""
                }
              `}
              onClick={() => selectMode && toggleSelectOrder(order._id)}
            >
              {selectMode && (
                <div className="absolute top-4 right-4">
                  <input
                    type="checkbox"
                    checked={selectedOrders.has(order._id)}
                    onChange={() => toggleSelectOrder(order._id)}
                    className="w-5 h-5 text-blue-600"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-900 text-lg font-semibold">
                  {" "}
                  {orders.length - index}. 订单号: {order.orderNo}
                </span>
                <span
                  className={`px-3 py-1 text-sm rounded-full ${getOrderStatusStyle(
                    order.orderStatus
                  )}`}
                >
                  {getOrderStatusText(order.orderStatus)}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600 mb-4">
                <div className="flex">
                  <span className="font-semibold w-20">店家名：</span>
                  <span>{order.userStoreName || "未知店家"}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-20">收货人：</span>
                  <span>
                    {order.receiverName} {order.receiverPhone}
                  </span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-20">地址：</span>
                  <span>{order.receiverAddress}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-20">销售人员：</span>
                  <span>{order.salesPerson || "未知"}</span>
                </div>
              </div>
              <div className="text-lg font-medium text-green-700">
                ¥{formatMoney(order.paymentAmount)}
              </div>
              <div className="text-sm text-gray-500">
                {formatDate(String(order.createTime))}
              </div>
              <button
                className="mt-4 bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 transition duration-200"
                onClick={() => toggleOrder(order._id)}
              >
                {expandedOrders.has(order._id) ? "收起" : "展开"}
              </button>

              {/* 展开的商品列表 */}
              {expandedOrders.has(order._id) && (
                <table className="mt-4 w-full rounded-lg">
                  <thead>
                    <tr className="border-b border-gray-300">
                      <th className="py-3 px-4 text-left text-gray-900">
                        序号
                      </th>
                      <th className="py-3 px-4 text-left text-gray-900">
                        商品名称
                      </th>
                      <th className="py-3 px-4 text-center text-gray-900">
                        规格
                      </th>
                      <th className="py-3 px-4 text-left text-gray-900">
                        条码
                      </th>
                      <th className="py-3 px-4 text-left text-gray-900">
                        单价
                      </th>
                      <th className="py-3 px-4 text-left text-gray-900">
                        数量
                      </th>
                      <th className="py-3 px-4 text-right text-gray-900">
                        总价
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.goodsList.map((goods, index) => (
                      <tr
                        key={goods.spuId}
                        className="border-b border-gray-300"
                      >
                        <td className="py-2 text-gray-900">{index + 1}</td>
                        <td className="py-2 text-gray-900">
                          {goods.goodsName}
                        </td>
                        <td className="py-2 text-gray-500">{goods.desc}</td>
                        <td className="py-2 text-gray-900">{goods.spuId}</td>
                        <td className="py-2 text-left text-gray-900">
                          ¥{formatMoney(goods.price)}
                        </td>
                        <td className="py-2 text-center text-gray-500">
                          {goods.quantity}{" "}
                          {goods.unitType &&
                          goods.unitsPerUnit &&
                          goods.quantity / goods.unitsPerUnit >= 1
                            ? `（${goods.quantity / goods.unitsPerUnit}${
                                goods.unitType
                              }）`
                            : ""}
                        </td>

                        <td className="py-2 text-right text-gray-900">
                          ¥{formatMoney(goods.price * goods.quantity)}
                        </td>
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
