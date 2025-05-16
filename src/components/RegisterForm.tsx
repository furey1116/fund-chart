import React, { useState } from 'react';
import { Form, Input, Button, message, Space } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, UserSwitchOutlined } from '@ant-design/icons';
import { RegisterRequest } from '@/types/user';
import { User } from '@/types/user';
import { getDatabaseDriver } from '@/lib/db';

interface RegisterFormProps {
  onRegister: (user: User) => void;
  onCancel: () => void;
  onLoginClick: () => void;
}

// 扩展表单数据类型,增加confirmPassword字段
interface RegisterFormData extends RegisterRequest {
  confirmPassword: string;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onRegister, onCancel, onLoginClick }) => {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: RegisterFormData) => {
    // 确认两次密码一致
    if (values.password !== values.confirmPassword) {
      message.error('两次输入的密码不一致');
      return;
    }
    
    setLoading(true);
    try {
      // 取出注册请求所需信息
      const { confirmPassword, ...registerData } = values;
      
      // 使用数据库驱动进行注册
      const driver = getDatabaseDriver();
      const user = await driver.registerUser(registerData);
      
      if (user) {
        onRegister(user);
        message.success('注册成功');
      } else {
        message.error('注册失败，用户名可能已存在');
      }
    } catch (error) {
      console.error('注册失败:', error);
      message.error('注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form
      name="register"
      onFinish={handleSubmit}
      layout="vertical"
      size="large"
    >
      <Form.Item
        name="username"
        rules={[
          { required: true, message: '请输入用户名' },
          { min: 3, message: '用户名不少于3个字符' }
        ]}
      >
        <Input prefix={<UserOutlined />} placeholder="用户名（登录账号）" />
      </Form.Item>

      <Form.Item
        name="displayName"
        rules={[{ required: true, message: '请输入显示名称' }]}
      >
        <Input prefix={<UserSwitchOutlined />} placeholder="显示名称" />
      </Form.Item>

      <Form.Item
        name="password"
        rules={[
          { required: true, message: '请输入密码' },
          { min: 6, message: '密码不少于6个字符' }
        ]}
      >
        <Input.Password prefix={<LockOutlined />} placeholder="密码" />
      </Form.Item>

      <Form.Item
        name="confirmPassword"
        rules={[{ required: true, message: '请确认密码' }]}
      >
        <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
      </Form.Item>

      <Form.Item name="email">
        <Input prefix={<MailOutlined />} placeholder="电子邮箱（可选）" />
      </Form.Item>

      <Form.Item>
        <Space className="w-full justify-between">
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              注册
            </Button>
            <Button onClick={onCancel}>
              取消
            </Button>
          </Space>
          <Button type="link" onClick={onLoginClick}>
            已有账号？立即登录
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default RegisterForm; 