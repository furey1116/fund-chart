import React, { useState } from 'react';
import { Form, Input, Button, message, Space } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { LoginRequest } from '@/types/user';
import { User } from '@/types/user';
import { DatabaseDriver, getDatabaseDriver } from '@/lib/db';

interface LoginFormProps {
  onLogin: (user: User) => void;
  onCancel: () => void;
  onRegisterClick: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin, onCancel, onRegisterClick }) => {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: LoginRequest) => {
    setLoading(true);
    try {
      // 使用数据库驱动进行登录
      const driver = getDatabaseDriver();
      const user = await driver.loginUser(values);
      
      if (user) {
        onLogin(user);
        message.success('登录成功');
      } else {
        message.error('用户名或密码错误');
      }
    } catch (error) {
      console.error('登录失败:', error);
      message.error('登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form
      name="login"
      onFinish={handleSubmit}
      layout="vertical"
      size="large"
    >
      <Form.Item
        name="username"
        rules={[{ required: true, message: '请输入用户名' }]}
      >
        <Input prefix={<UserOutlined />} placeholder="用户名" />
      </Form.Item>

      <Form.Item
        name="password"
        rules={[{ required: true, message: '请输入密码' }]}
      >
        <Input.Password prefix={<LockOutlined />} placeholder="密码" />
      </Form.Item>

      <Form.Item>
        <Space className="w-full justify-between">
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              登录
            </Button>
            <Button onClick={onCancel}>
              取消
            </Button>
          </Space>
          <Button type="link" onClick={onRegisterClick}>
            没有账号？立即注册
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default LoginForm; 