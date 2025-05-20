-- CreateTable
CREATE TABLE "FundKLineData" (
    "id" TEXT NOT NULL,
    "fundCode" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" BIGINT NOT NULL,
    "scale" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundKLineData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GridStrategy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fundCode" TEXT NOT NULL,
    "fundName" TEXT NOT NULL,
    "initialPrice" DOUBLE PRECISION NOT NULL,
    "strategyType" TEXT NOT NULL,
    "gridMode" TEXT NOT NULL,
    "sellStrategy" TEXT NOT NULL,
    "gridCount" INTEGER NOT NULL,
    "gridWidth" DOUBLE PRECISION NOT NULL,
    "absoluteGridWidth" DOUBLE PRECISION,
    "investmentPerGrid" DOUBLE PRECISION NOT NULL,
    "enableMediumGrid" BOOLEAN NOT NULL DEFAULT false,
    "mediumGridMultiplier" DOUBLE PRECISION,
    "enableLargeGrid" BOOLEAN NOT NULL DEFAULT false,
    "largeGridMultiplier" DOUBLE PRECISION,
    "retainedProfitsRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxPercentOfDecline" DOUBLE PRECISION,
    "enableMaxDeclineLimit" BOOLEAN NOT NULL DEFAULT false,
    "enableIntraDayBacktest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GridStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GridBacktestResult" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalInvestment" DOUBLE PRECISION NOT NULL,
    "totalValue" DOUBLE PRECISION NOT NULL,
    "totalShares" DOUBLE PRECISION NOT NULL,
    "totalBuyAmount" DOUBLE PRECISION NOT NULL,
    "totalSellAmount" DOUBLE PRECISION NOT NULL,
    "totalFees" DOUBLE PRECISION NOT NULL,
    "profitAmount" DOUBLE PRECISION NOT NULL,
    "profitPercentage" DOUBLE PRECISION NOT NULL,
    "transactionCount" INTEGER NOT NULL,
    "buyCount" INTEGER NOT NULL,
    "sellCount" INTEGER NOT NULL,
    "useIntraDayData" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GridBacktestResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GridTransaction" (
    "id" TEXT NOT NULL,
    "backtestId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "operation" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "shares" DOUBLE PRECISION NOT NULL,
    "gridLevel" DOUBLE PRECISION NOT NULL,
    "gridType" TEXT NOT NULL,
    "fee" DOUBLE PRECISION NOT NULL,
    "buyDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GridTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FundKLineData_fundCode_scale_idx" ON "FundKLineData"("fundCode", "scale");

-- CreateIndex
CREATE INDEX "FundKLineData_date_idx" ON "FundKLineData"("date");

-- CreateIndex
CREATE UNIQUE INDEX "FundKLineData_fundCode_date_scale_key" ON "FundKLineData"("fundCode", "date", "scale");

-- CreateIndex
CREATE INDEX "GridStrategy_userId_fundCode_idx" ON "GridStrategy"("userId", "fundCode");

-- CreateIndex
CREATE INDEX "GridBacktestResult_strategyId_idx" ON "GridBacktestResult"("strategyId");

-- CreateIndex
CREATE INDEX "GridTransaction_backtestId_idx" ON "GridTransaction"("backtestId");

-- AddForeignKey
ALTER TABLE "GridStrategy" ADD CONSTRAINT "GridStrategy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GridTransaction" ADD CONSTRAINT "GridTransaction_backtestId_fkey" FOREIGN KEY ("backtestId") REFERENCES "GridBacktestResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
