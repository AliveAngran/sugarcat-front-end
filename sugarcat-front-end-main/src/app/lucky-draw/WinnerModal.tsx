import { useEffect } from 'react';
import { Button } from 'antd';
import confetti from 'canvas-confetti';
import styles from './page.module.css';

interface WinnerModalProps {
  isVisible: boolean;
  winnerName: string;
  prize: string;
  onClose: () => void;
}

const WinnerModal = ({ isVisible, winnerName, prize, onClose }: WinnerModalProps) => {
  useEffect(() => {
    if (isVisible) {
      // 触发烟花动画
      const duration = 5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min;
      }

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);

        // 从左右两侧发射烟花
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className={styles.winnerModalOverlay}>
      <div className={styles.winnerModal}>
        <div className={styles.winnerModalContent}>
          <div className={styles.winnerModalEmoji}>🎉</div>
          <h2 className={styles.winnerModalTitle}>恭喜中奖！</h2>
          <div className={styles.winnerModalInfo}>
            <div className={styles.winnerModalName}>{winnerName}</div>
            <div className={styles.winnerModalPrize}>获得 {prize}</div>
          </div>
          <Button 
            type="primary"
            className={styles.winnerModalButton}
            onClick={onClose}
          >
            确定
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WinnerModal; 