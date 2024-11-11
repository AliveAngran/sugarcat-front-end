"use client";

import { useEffect, useState } from "react";
import { db, dbPromise } from "@/utils/cloudbase";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useRouter } from "next/navigation";
import { checkAuth } from "@/utils/auth";

const formatMoney = (amount: number) => {
  return (amount / 100).toFixed(2);
};

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
  isExported?: boolean;
};

// 在文件顶部添加常量定义
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 10;
const MAX_HEIGHT_MM = A4_HEIGHT_MM - (2 * MARGIN_MM);

function OrderList() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const auth = checkAuth();
    if (!auth) {
      router.push('/');
    } else {
      setIsAuthorized(true);
    }
  }, [router]);

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

  // 首先将获取订单的逻辑抽取成一个函数，这样可以重用
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/orders', {
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error('获取订单失败');
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || '获取订单失败');
      }
      
      setOrders(result.data);
      setError(null);
    } catch (err) {
      console.error("获取订单失败:", err);
      setError(err instanceof Error ? err.message : "获取数据失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchOrders();
    }
  }, [isAuthorized]);

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

  const updateOrderExportStatus = async (orderId: string, isExported: boolean) => {
    try {
      const response = await fetch('/api/orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          isExported
        })
      });

      if (!response.ok) {
        throw new Error('更新订单导出状态失败');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || '更新订单导出状态失败');
      }

      // 更新本地状态
      setOrders(orders.map(order => 
        order._id === orderId 
          ? { ...order, isExported }
          : order
      ));

    } catch (error) {
      console.error('更新订单导出状态失败:', error);
      alert(error instanceof Error ? error.message : '更新订单导出状态失败');
    }
  };

  // 处理第二页的表头和内容
  const addSecondPage = (
    pdf: jsPDF,
    remainingImgData: string,
    headerImgData: string,
    imgWidth: number,
    remainingImgHeight: number,
    headerImgHeight: number
  ) => {
    const HEADER_TOP_MARGIN = 15;
    const CONTENT_SPACING = 10;

    // 添加续页标记
    pdf.setFontSize(8);
    pdf.setTextColor(128, 128, 128);
    pdf.text("(续页)", MARGIN_MM, MARGIN_MM - 2);

    // 添加表头，位置稍微下移
    pdf.addImage(
      headerImgData,
      "JPEG",
      MARGIN_MM,
      MARGIN_MM + HEADER_TOP_MARGIN,
      imgWidth,
      headerImgHeight,
      "",
      "FAST"
    );

    // 添加剩余内容，位置相应下移
    pdf.addImage(
      remainingImgData,
      "JPEG",
      MARGIN_MM,
      MARGIN_MM + HEADER_TOP_MARGIN + headerImgHeight + CONTENT_SPACING,
      imgWidth,
      remainingImgHeight,
      "",
      "FAST"
    );
  };

  const exportToPDF = async (selectedOnly: boolean = false) => {
    if (!confirm("确认导出所选订单数据？")) return;

    setExporting(true);
    try {
      const element = document.getElementById("orders-container");
      if (!element) return;

      if (selectedOnly && selectedOrders.size === 0) {
        alert("请先选择要导出的订单");
        return;
      }

      // 临时隐藏所有带有 no-print 类的元素
      const noPrintElements = element.querySelectorAll('.no-print');
      noPrintElements.forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });

      const orderElements = element.querySelectorAll(".order-item");
      let isFirstPage = true;

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const A4_WIDTH_MM = 210;
      const A4_HEIGHT_MM = 297;
      const MARGIN_MM = 10;
      const MAX_HEIGHT_MM = A4_HEIGHT_MM - (2 * MARGIN_MM);
      let currentPageHeight = 0;

      for (let i = 0; i < orderElements.length; i++) {
        const orderElement = orderElements[i] as HTMLElement;
        const orderId = orderElement.getAttribute("data-order-id");

        if (selectedOnly && (!orderId || !selectedOrders.has(orderId))) {
          continue;
        }

        if (orderId) {
          setExpandedOrders((prev) => new Set([...prev, orderId]));
        }

        await new Promise((resolve) => setTimeout(resolve, 100));

        const canvas = await html2canvas(orderElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          windowWidth: element.scrollWidth,
          allowTaint: true,
        });

        // 获表格行的位置信息
        const tableRows = orderElement.querySelectorAll('tbody tr');
        const rowPositions = Array.from(tableRows).map(row => {
          const rect = (row as HTMLElement).getBoundingClientRect();
          return {
            top: rect.top - orderElement.getBoundingClientRect().top,
            height: rect.height
          };
        });

        const imgWidth = A4_WIDTH_MM - (2 * MARGIN_MM);
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const scale = imgWidth / canvas.width;

        if (imgHeight > MAX_HEIGHT_MM) {
          if (!isFirstPage) {
            pdf.addPage();
            currentPageHeight = 0;
          }
          isFirstPage = false;

          // 计算最佳分割点
          const maxFirstPagePixels = MAX_HEIGHT_MM / scale;
          let splitPosition = maxFirstPagePixels;

          // 找到最近的表格行边界作为分割点
          for (let j = 0; j < rowPositions.length; j++) {
            const rowBottom = rowPositions[j].top + rowPositions[j].height;
            if (rowBottom > maxFirstPagePixels) {
              // 使用上一行的底部作为分割点
              splitPosition = j > 0 ? 
                rowPositions[j - 1].top + rowPositions[j - 1].height :
                rowPositions[j].top;
              break;
            }
          }

          // 创建第一页画布
          const firstPageCanvas = document.createElement('canvas');
          const firstPageCtx = firstPageCanvas.getContext('2d');
          if (!firstPageCtx) continue;

          firstPageCanvas.width = canvas.width;
          firstPageCanvas.height = splitPosition;

          firstPageCtx.drawImage(
            canvas,
            0,
            0,
            canvas.width,
            splitPosition,
            0,
            0,
            canvas.width,
            splitPosition
          );

          const firstPageImgData = firstPageCanvas.toDataURL("image/jpeg", 1.0);
          const firstPageImgHeight = splitPosition * scale;

          pdf.addImage(
            firstPageImgData,
            "JPEG",
            MARGIN_MM,
            MARGIN_MM,
            imgWidth,
            firstPageImgHeight,
            "",
            "FAST"
          );

          // 处理剩余内容
          pdf.addPage();
          const remainingHeight = canvas.height - splitPosition;
          const remainingCanvas = document.createElement('canvas');
          const remainingCtx = remainingCanvas.getContext('2d');
          if (!remainingCtx) continue;

          remainingCanvas.width = canvas.width;
          remainingCanvas.height = remainingHeight;

          remainingCtx.drawImage(
            canvas,
            0,
            splitPosition,
            canvas.width,
            remainingHeight,
            0,
            0,
            canvas.width,
            remainingHeight
          );

          const remainingImgData = remainingCanvas.toDataURL("image/jpeg", 1.0);
          const remainingImgHeight = remainingHeight * scale;

          // 处理表头
          const tableHeader = orderElement.querySelector('thead');
          if (tableHeader) {
            const headerCanvas = document.createElement('canvas');
            const headerCtx = headerCanvas.getContext('2d');
            if (headerCtx) {
              const headerHeight = (tableHeader as HTMLElement).offsetHeight;
              headerCanvas.width = canvas.width;
              headerCanvas.height = headerHeight;
              
              // 可以选择稍微放大表头
              const headerScale = 1.1; // 表头放大比例
              
              headerCtx.scale(headerScale, headerScale);
              headerCtx.drawImage(
                canvas,
                0,
                0,
                canvas.width / headerScale,
                headerHeight / headerScale,
                0,
                0,
                canvas.width / headerScale,
                headerHeight / headerScale
              );

              const headerImgData = headerCanvas.toDataURL("image/jpeg", 1.0);
              const headerImgHeight = headerHeight * scale * headerScale;

              // 使用新的函数添加第二页内容
              addSecondPage(
                pdf,
                remainingImgData,
                headerImgData,
                imgWidth,
                remainingImgHeight,
                headerImgHeight
              );
            }
          } else {
            // 如果没有表头，直接添加剩余内容
            pdf.addImage(
              remainingImgData,
              "JPEG",
              MARGIN_MM,
              MARGIN_MM,
              imgWidth,
              remainingImgHeight,
              "",
              "FAST"
            );
          }
        } else {
          if (currentPageHeight + imgHeight > MAX_HEIGHT_MM) {
            pdf.addPage();
            currentPageHeight = 0;
            isFirstPage = false;
          }

          pdf.addImage(
            canvas.toDataURL("image/jpeg", 1.0),
            "JPEG",
            MARGIN_MM,
            MARGIN_MM + currentPageHeight,
            imgWidth,
            imgHeight,
            "",
            "FAST"
          );

          currentPageHeight += imgHeight + 5;
        }
      }

      // 恢复所有 no-print 元素的显示
      noPrintElements.forEach(el => {
        (el as HTMLElement).style.display = '';
      });

      // 在成功导出后更新所有导出订单的状态
      const exportedOrderIds = selectedOnly 
        ? Array.from(selectedOrders)
        : orders.map(order => order._id);

      // 批量更新导出状态
      await Promise.all(
        exportedOrderIds.map(orderId => 
          updateOrderExportStatus(orderId, true)
        )
      );

      pdf.save(`订单列表_${new Date().toLocaleDateString()}.pdf`);
      
      // 重新获取最新数据
      await fetchOrders();
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

  const updateOrderStatus = async (orderId: string, newStatus: number) => {
    try {
      const response = await fetch('/api/orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          newStatus
        })
      });

      if (!response.ok) {
        throw new Error('更新订单状态失败');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || '更新订单状态失败');
      }

      // 更新本地状态
      setOrders(orders.map(order => 
        order._id === orderId 
          ? { ...order, orderStatus: newStatus }
          : order
      ));

      alert('订单状态更新成功');
    } catch (error) {
      console.error('更新订单状态失败:', error);
      alert(error instanceof Error ? error.message : '更新订单状态失败');
    }
  };

  const renderStatusButton = (order: OrderType) => {
    const statusOptions = [
      { value: 10, label: '待发货' },
      { value: 40, label: '运送中' },
      { value: 50, label: '已完成' },
      { value: 80, label: '已取消' }
    ];

    return (
      <select
        value={order.orderStatus}
        onChange={(e) => {
          const newStatus = parseInt(e.target.value, 10);
          if (confirm(`确认将订单状态更改为"${statusOptions.find(opt => opt.value === newStatus)?.label}"？`)) {
            updateOrderStatus(order._id, newStatus);
          }
        }}
        onClick={(e) => e.stopPropagation()}
        className={`px-3 py-1 rounded-full text-sm cursor-pointer no-print ${getOrderStatusStyle(order.orderStatus)}`}
      >
        {statusOptions.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  };

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
              <>
                <button
                  onClick={() => {
                    // 选择所有未导出的订单
                    const unexportedOrders = orders
                      .filter(order => !order.isExported)
                      .map(order => order._id);
                    setSelectedOrders(new Set(unexportedOrders));
                  }}
                  className="bg-yellow-600 text-white rounded-lg px-6 py-2 hover:bg-yellow-700 transition duration-200"
                >
                  选择未导出
                </button>
                <button
                  onClick={() => exportToPDF(true)}
                  disabled={exporting || selectedOrders.size === 0}
                  className="bg-green-600 text-white rounded-lg px-6 py-2 hover:bg-green-700 transition duration-200 disabled:bg-gray-400"
                >
                  {exporting ? "导出中..." : `导出所选(${selectedOrders.size})`}
                </button>
              </>
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
                rounded-lg shadow-md p-4 border border-gray-300 
                print:break-inside-avoid-page 
                print:mb-8
                ${order.orderStatus === 80 ? "bg-gray-100 text-gray-500" : "bg-white text-gray-900"}
                ${selectMode ? "cursor-pointer" : ""}
                ${selectMode && selectedOrders.has(order._id) ? "ring-2 ring-blue-500" : ""}
              `}
              onClick={() => selectMode && toggleSelectOrder(order._id)}
            >
              {selectMode && (
                <div className="absolute top-4 right-4">
                  <input
                    type="checkbox"
                    checked={selectedOrders.has(order._id)}
                    onChange={() => toggleSelectOrder(order._id)}
                    className={`w-5 h-5 ${order.orderStatus === 80 ? "cursor-not-allowed" : "text-blue-600"}`}
                    onClick={(e) => e.stopPropagation()}
                    disabled={order.orderStatus === 80}
                  />
                </div>
              )}
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-semibold">
                  {orders.length - index}. 订单号: {order.orderNo}
                </span>
                <div className="flex items-center space-x-4 no-print">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateOrderExportStatus(order._id, !order.isExported);
                    }}
                    className={`px-2 py-1 rounded-full text-xs cursor-pointer hover:opacity-80 ${
                      order.isExported 
                        ? 'bg-purple-100 text-purple-800 border border-purple-300' 
                        : 'bg-orange-100 text-orange-800 border border-orange-300'
                    } ${order.orderStatus === 80 ? "opacity-50 cursor-not-allowed" : ""}`}
                    disabled={order.orderStatus === 80}
                  >
                    {order.isExported ? '已导出' : '未导出'}
                  </button>
                  {renderStatusButton(order)}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-4">
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
              <div className="text-sm">
                {formatDate(String(order.createTime))}
              </div>
              <button
                className={`mt-4 rounded-lg px-4 py-2 hover:bg-blue-700 transition duration-200 no-print ${
                  order.orderStatus === 80
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleOrder(order._id);
                }}
                disabled={order.orderStatus === 80}
              >
                {expandedOrders.has(order._id) ? "收起" : "展开"}
              </button>

              {expandedOrders.has(order._id) && (
                <table className="mt-4 w-full rounded-lg text-sm">
                  <thead>
                    <tr className="border-b border-gray-300">
                      <th className="py-1.5 px-2 text-left font-medium">序号</th>
                      <th className="py-1.5 px-2 text-left font-medium">商品名称</th>
                      <th className="py-1.5 px-2 text-center font-medium">规格</th>
                      <th className="py-1.5 px-2 text-left font-medium">条码</th>
                      <th className="py-1.5 px-2 text-left font-medium">单价</th>
                      <th className="py-1.5 px-2 text-left font-medium">数量</th>
                      <th className="py-1.5 px-2 text-right font-medium">总价</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {order.goodsList.map((goods, index) => (
                      <tr key={goods.spuId} className="border-b border-gray-300">
                        <td className="py-1 px-2">{index + 1}</td>
                        <td className="py-1 px-2">{goods.goodsName}</td>
                        <td className="py-1 px-2">{goods.desc}</td>
                        <td className="py-1 px-2">{goods.spuId}</td>
                        <td className="py-1 px-2">
                          ¥{formatMoney(goods.price)}
                        </td>
                        <td className="py-1 px-2 text-center">
                          {goods.quantity}{" "}
                          {goods.unitType &&
                          goods.unitsPerUnit &&
                          goods.quantity / goods.unitsPerUnit >= 1
                            ? `（${goods.quantity / goods.unitsPerUnit}${goods.unitType}）`
                            : ""}
                        </td>
                        <td className="py-1 px-2 text-right">
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