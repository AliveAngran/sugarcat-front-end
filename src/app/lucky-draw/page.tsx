'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Input, message, Progress, Modal, DatePicker } from 'antd';
import { ReloadOutlined, ClearOutlined, DeleteOutlined } from '@ant-design/icons';
import styles from './page.module.css';
import confetti from 'canvas-confetti';
import WinnerModal from './WinnerModal';

interface Participant {
  userStoreName: string;
  orderCount?: number;
  totalAmount?: number;
}

interface Prize {
  name: string;
  count: number;
}

interface Stats {
  totalStores: number;
  totalOrders: number;
  totalAmount: number;
}

interface Winner {
  name: string;
  prize: string;
}

export default function LuckyDraw() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [currentName, setCurrentName] = useState('');
  const [newPrizeName, setNewPrizeName] = useState('');
  const [newPrizeCount, setNewPrizeCount] = useState('1');
  const [currentPrize, setCurrentPrize] = useState<Prize | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const animationRef = useRef<number>();
  const namesRef = useRef<string[]>([]);
  const [winners, setWinners] = useState<{name: string, prize: string}[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [currentWinner, setCurrentWinner] = useState<Winner | null>(null);

  // 加载参与者数据
  const loadParticipants = async () => {
    if (!selectedDate) {
      message.warning('请先选择起始日期');
      return;
    }

    try {
      setLoading(true);
      // 将选择的日期设置为当天的0点
      const date = new Date(selectedDate);
      date.setHours(0, 0, 0, 0);
      // 转换为东八区的时间戳
      const startDate = date.getTime() - (date.getTimezoneOffset() * 60 * 1000);
      
      console.log('选择的日期:', date.toISOString());
      console.log('转换后的时间戳:', startDate);
      
      const response = await fetch(`/api/lucky-draw/participants?startDate=${startDate}`);
      const data = await response.json();
      if (data.success) {
        setParticipants(data.participants);
        namesRef.current = data.participants.map((p: Participant) => p.userStoreName);
        setStats(data.stats);
        message.success(`成功导入${data.participants.length}家店铺`);
      } else {
        message.error('加载参与者数据失败');
      }
    } catch (error) {
      message.error('加载参与者数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 一键导入
  const handleImport = () => {
    loadParticipants();
  };

  // 添加参与者
  const handleAddParticipant = () => {
    if (!currentName.trim()) {
      message.warning('请输入参与者名称');
      return;
    }
    const newParticipant = { userStoreName: currentName.trim() };
    setParticipants(prev => [...prev, newParticipant]);
    namesRef.current.push(currentName.trim());
    setCurrentName('');
  };

  // 添加奖品
  const handleAddPrize = () => {
    if (!newPrizeName.trim()) {
      message.warning('请输入奖品名称');
      return;
    }
    const count = parseInt(newPrizeCount);
    if (isNaN(count) || count < 1) {
      message.warning('请输入有效的奖品数量');
      return;
    }
    setPrizes(prev => [...prev, { name: newPrizeName.trim(), count }]);
    setNewPrizeName('');
    setNewPrizeCount('1');
  };

  // 选择当前要抽取的奖品
  const selectPrize = () => {
    const availablePrizes = prizes.filter(p => p.count > 0);
    if (availablePrizes.length === 0) {
      message.warning('所有奖品已抽完');
      return null;
    }
    return availablePrizes[0];
  };

  // 开始抽奖动画
  const startDrawAnimation = () => {
    if (namesRef.current.length === 0) {
      message.warning('没有可抽奖的参与者');
      return;
    }

    const prize = selectPrize();
    if (!prize) return;
    
    setCurrentPrize(prize);
    setDrawing(true);
    let count = 0;
    const totalFrames = 50; // 增加动画次数
    const animate = () => {
      const randomIndex = Math.floor(Math.random() * namesRef.current.length);
      setCurrentName(namesRef.current[randomIndex]);
      count++;
      
      if (count < totalFrames) {
        const frameDelay = Math.min(count * 2, 50); // 逐渐减速
        setTimeout(() => {
          animationRef.current = requestAnimationFrame(animate);
        }, frameDelay);
      } else {
        // 动画结束，选出最终中奖者
        const winnerIndex = Math.floor(Math.random() * namesRef.current.length);
        const winner = namesRef.current[winnerIndex];
        setCurrentName(winner);
        
        // 更新中奖记录
        setWinners(prev => [...prev, {name: winner, prize: prize.name}]);
        
        // 更新奖品数量
        setPrizes(prev => prev.map(p => 
          p.name === prize.name ? {...p, count: p.count - 1} : p
        ));
        
        // 从参与者列表中移除中奖者
        namesRef.current = namesRef.current.filter((_, index) => index !== winnerIndex);
        setParticipants(prev => prev.filter(p => p.userStoreName !== winner));
        
        // 显示中奖弹窗
        setCurrentWinner({ name: winner, prize: prize.name });
        setShowWinnerModal(true);
        
        setDrawing(false);
        setCurrentPrize(null);
      }
    };
    
    animate();
  };

  // 停止抽奖动画
  const stopDrawAnimation = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setDrawing(false);
    setCurrentPrize(null);
  };

  // 重置功能
  const handleReset = () => {
    Modal.confirm({
      title: '确认重置',
      content: '这将清空所有参与者、奖品设置和中奖记录，确定要重置吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        setParticipants([]);
        setPrizes([]);
        setWinners([]);
        setStats(null);
        namesRef.current = [];
        setCurrentName('');
        setNewPrizeName('');
        setNewPrizeCount('1');
        setCurrentPrize(null);
        setSelectedDate(null);
        message.success('已重置所有数据');
      }
    });
  };

  const handleDrawEnd = (winnerName: string, prize: string) => {
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (error) {
      console.error('Confetti animation error:', error);
    }
    
    setCurrentWinner({ name: winnerName, prize });
    setShowWinnerModal(true);
  };

  const handleCloseWinnerModal = () => {
    setShowWinnerModal(false);
    setCurrentWinner(null);
  };

  const startDraw = () => {
    if (participants.length === 0 || prizes.length === 0) {
      message.error('请先添加参与者和奖品！');
      return;
    }

    setDrawing(true);
    const totalFrames = 50; // 增加总帧数使动画更流畅
    let currentFrame = 0;
    
    const drawInterval = setInterval(() => {
      currentFrame++;
      const randomIndex = Math.floor(Math.random() * participants.length);
      setCurrentName(participants[randomIndex].userStoreName);

      // 在最后一帧时选出获奖者
      if (currentFrame >= totalFrames) {
        clearInterval(drawInterval);
        setDrawing(false);
        
        // 随机选择一个奖品
        const prizeIndex = Math.floor(Math.random() * prizes.length);
        const selectedPrize = prizes[prizeIndex];
        
        // 随机选择一个参与者
        const winnerIndex = Math.floor(Math.random() * participants.length);
        const winner = participants[winnerIndex];

        // 更新剩余奖品数量
        const updatedPrizes = [...prizes];
        updatedPrizes[prizeIndex] = {
          ...selectedPrize,
          count: selectedPrize.count - 1
        };
        setPrizes(updatedPrizes.filter(prize => prize.count > 0));

        // 从参与者列表中移除获奖者
        const updatedParticipants = [...participants];
        updatedParticipants.splice(winnerIndex, 1);
        setParticipants(updatedParticipants);

        // 触发中奖弹窗
        handleDrawEnd(winner.userStoreName, selectedPrize.name);
      }
    }, 100); // 减少间隔时间使动画更流畅
  };

  // 添加删除参与者的处理函数
  const handleDeleteParticipant = (name: string) => {
    setParticipants(prev => prev.filter(p => p.userStoreName !== name));
    namesRef.current = namesRef.current.filter(n => n !== name);
    message.success('已删除参与者');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <img src="/cookie-icon.svg" alt="cookie" className={styles.icon} />
        <h1 className={styles.title}>糖猫仓储抽奖</h1>
        <img src="/cookie-icon.svg" alt="cookie" className={styles.icon} />
      </div>
      
      <h2 className={styles.subtitle}>甜蜜好运，幸运降临！</h2>

      <div className={styles.content}>
        <Card 
          title="参与者名单" 
          className={`${styles.card} ${styles.participantsCard}`}
          extra={
            <Button
              type="text"
              icon={<ClearOutlined />}
              onClick={handleReset}
              disabled={loading || drawing}
              danger
            >
              重置
            </Button>
          }
        >
          <div className={styles.inputGroup}>
            <DatePicker
              placeholder="选择起始日期"
              onChange={(date) => setSelectedDate(date ? date.toDate() : null)}
              style={{ width: '100%' }}
              disabled={loading || drawing}
            />
            <Button 
              type="primary"
              onClick={handleImport}
              disabled={loading || drawing || !selectedDate}
              icon={<ReloadOutlined />}
            >
              一键导入
            </Button>
          </div>
          <div className={styles.inputGroup}>
            <Input
              value={currentName}
              onChange={e => setCurrentName(e.target.value)}
              placeholder="输入参与者姓名"
              disabled={loading || drawing}
            />
            <Button 
              type="primary"
              onClick={handleAddParticipant}
              disabled={loading || drawing}
            >
              添加
            </Button>
          </div>
          
          {stats && (
            <div className={styles.stats}>
              <div className={styles.statItem}>
                <span>参与店铺：</span>
                <span className={styles.statValue}>{stats.totalStores}家</span>
              </div>
              <div className={styles.statItem}>
                <span>总订单数：</span>
                <span className={styles.statValue}>{stats.totalOrders}单</span>
              </div>
            </div>
          )}

          <div className={styles.participantList}>
            {participants.map((p, index) => (
              <div key={index} className={styles.participant}>
                <div className={styles.participantName}>{p.userStoreName}</div>
                <div className={styles.participantActions}>
                  {p.orderCount && p.totalAmount && (
                    <div className={styles.participantStats}>
                      <span>{p.orderCount}单</span>
                      <span>¥{(p.totalAmount / 100).toFixed(2)}</span>
                    </div>
                  )}
                  <Button
                    type="text"
                    icon={<DeleteOutlined />}
                    onClick={() => handleDeleteParticipant(p.userStoreName)}
                    disabled={drawing}
                    danger
                    size="small"
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="奖品设置" className={`${styles.card} ${styles.prizesCard}`}>
          <div className={styles.inputGroup}>
            <Input
              value={newPrizeName}
              onChange={e => setNewPrizeName(e.target.value)}
              placeholder="奖品名称"
              disabled={drawing}
            />
            <Input
              value={newPrizeCount}
              onChange={e => setNewPrizeCount(e.target.value)}
              placeholder="数量"
              type="number"
              min="1"
              style={{ width: 100 }}
              disabled={drawing}
            />
            <Button type="primary" onClick={handleAddPrize} disabled={drawing}>
              添加奖品
            </Button>
          </div>
          <div className={styles.prizeList}>
            {prizes.map((prize, index) => (
              <div key={index} className={styles.prize}>
                {prize.name} x {prize.count}
              </div>
            ))}
          </div>
        </Card>

        <Card title="中奖名单" className={`${styles.card} ${styles.winnersCard}`}>
          <div className={styles.winnerList}>
            {winners.map((winner, index) => (
              <div key={index} className={styles.winner}>
                {winner.name} - {winner.prize}
              </div>
            ))}
          </div>
        </Card>

        <div className={styles.drawSection}>
          <div className={`${styles.drawBox} ${drawing ? styles.drawing : ''}`}>
            <div className={styles.currentName}>
              {currentName || '等待抽奖...'}
              {currentPrize && (
                <div className={styles.prizeName}>
                  正在抽取: {currentPrize.name}
                </div>
              )}
            </div>
          </div>
          <Button
            type="primary"
            size="large"
            className={styles.drawButton}
            onClick={drawing ? stopDrawAnimation : startDrawAnimation}
            disabled={loading || participants.length === 0 || prizes.every(p => p.count === 0)}
          >
            {drawing ? '停止抽奖' : '开始抽奖'}
          </Button>
        </div>
      </div>
      
      {currentWinner && (
        <WinnerModal
          isVisible={showWinnerModal}
          winnerName={currentWinner.name}
          prize={currentWinner.prize}
          onClose={handleCloseWinnerModal}
        />
      )}
    </div>
  );
} 