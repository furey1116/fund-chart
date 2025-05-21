import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/Home.module.css';
import { BookOutlined, HistoryOutlined } from '@ant-design/icons';

const Home: NextPage = () => {
  return (
    <div className={styles.container}>
      <Head>
        <title>天天基金数据分析工具</title>
        <meta name="description" content="天天基金数据分析和网格策略回测工具" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          天天基金数据分析工具
        </h1>

        <p className={styles.description}>
          基金数据分析和网格策略回测系统
        </p>

        <div className={styles.grid}>
          <Link href="/fund-chart">
            <a className={styles.card}>
              <h2>基金走势分析 &rarr;</h2>
              <p>查看基金历史净值走势、分析涨跌幅度分布</p>
            </a>
          </Link>

          <Link href="/grid-strategy">
            <a className={styles.card}>
              <h2>网格策略 &rarr;</h2>
              <p>基金网格交易策略设计与回测</p>
            </a>
          </Link>

          <Link href="/grid-history">
            <a className={styles.card}>
              <h2><HistoryOutlined /> 历史回测记录 &rarr;</h2>
              <p>查看、比较历史网格策略回测结果</p>
            </a>
          </Link>

          <a
            href="https://fundf10.eastmoney.com/"
            className={styles.card}
            target="_blank"
            rel="noopener noreferrer"
          >
            <h2><BookOutlined /> 天天基金网 &rarr;</h2>
            <p>访问天天基金网站获取最新基金资讯</p>
          </a>
        </div>
      </main>

      <footer className={styles.footer}>
        <a
          href="https://github.com/your-username/fund-chart-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className={styles.logo}>
            基金网格回测系统 | {new Date().getFullYear()}
          </span>
        </a>
      </footer>
    </div>
  );
};

export default Home; 