/**
 * 用户类型定义
 */
export interface User {
  id: string;         // 用户ID
  username: string;   // 用户名
  password: string;   // 密码（存储时应加密）
  displayName: string; // 显示名称
  email?: string;     // 电子邮件（可选）
  createdAt: string;  // 创建时间
  lastLoginAt?: string; // 最后登录时间
}

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
 * 创建用户
 */
export function createUser(data: Omit<User, 'id' | 'createdAt'>): User {
  return {
    id: generateId(),
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