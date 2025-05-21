import React, { ReactNode } from 'react';
import { Layout as AntLayout, Menu, Button } from 'antd';
import { HomeOutlined, HistoryOutlined, SettingOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/router';

const { Header, Content, Footer } = AntLayout;

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const router = useRouter();
  const currentPath = router.pathname;
  
  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: <Link href="/">首页</Link>,
    },
    {
      key: '/history',
      icon: <HistoryOutlined />,
      label: <Link href="/history">历史记录</Link>,
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: <Link href="/settings">设置</Link>,
    },
  ];

  return (
    <AntLayout className="min-h-screen">
      <Header className="bg-white border-b border-gray-200 px-4">
        <div className="flex items-center justify-between">
          <div className="text-xl font-bold">ETF网格交易回测</div>
          <Menu
            mode="horizontal"
            selectedKeys={[currentPath]}
            items={menuItems}
            style={{ border: 'none' }}
          />
        </div>
      </Header>
      <Content className="site-layout">
        <div className="site-layout-background py-6">
          {children}
        </div>
      </Content>
      <Footer className="text-center">ETF网格交易回测系统 ©2023</Footer>
    </AntLayout>
  );
};

export default Layout; 