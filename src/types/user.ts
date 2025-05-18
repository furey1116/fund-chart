/**
 * 用户类型定义（带密码，用于内部处理）
 */
export interface UserWithPassword {
  id: string;         // 用户ID
  username: string;   // 用户名
  password: string;   // 密码（存储时应加密）
  displayName: string; // 显示名称
  email?: string;     // 电子邮件（可选）
  createdAt: string;  // 创建时间
  lastLoginAt?: string; // 最后登录时间
}

/**
 * 安全的用户类型（不包含密码，用于前端显示和API返回）
 */
export type User = Omit<UserWithPassword, 'password'>;

/**
 * 登录请求
 */
export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * 注册请求
 */
export interface RegisterRequest {
  username: string;
  password: string;
  displayName: string;
  email?: string;
}

/**
 * 生成唯一ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * 创建用户
 */
export function createUser(data: Omit<UserWithPassword, 'id' | 'createdAt'>): UserWithPassword {
  return {
    id: generateId(),
    ...data,
    createdAt: new Date().toISOString()
  };
} 