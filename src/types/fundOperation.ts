/**
 * 基金操作记录类型定义
 */
export interface FundOperation {
  id: string;               // 操作ID
  userId: string;           // 用户ID
  fundCode: string;         // 基金代码
  fundName: string;         // 基金名称
  operationType: 'buy' | 'sell';  // 操作类型：买入/卖出
  operationDate: string;    // 操作日期
  price: number;            // 操作价格
  shares: number;           // 份数
  amount: number;           // 金额
  fee: number;              // 手续费
  holdingShares?: number;   // 持有份额（操作后）
  marketValue?: number;     // 市值（操作后）
  remark?: string;          // 备注
  createdAt: string;        // 记录创建时间
}

/**
 * 创建基金操作记录
 */
export function createFundOperation(
  userId: string,
  fundCode: string,
  fundName: string,
  data: Omit<FundOperation, 'id' | 'userId' | 'fundCode' | 'fundName' | 'createdAt'>
): FundOperation {
  return {
    id: generateId(),
    userId,
    fundCode,
    fundName,
    ...data,
    createdAt: new Date().toISOString()
  };
}

/**
 * 生成唯一ID
 */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
} 