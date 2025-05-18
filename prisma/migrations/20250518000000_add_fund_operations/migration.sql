-- CreateTable
CREATE TABLE "FundOperation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fundCode" TEXT NOT NULL,
    "fundName" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "operationDate" TIMESTAMP(3) NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "shares" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "fee" DOUBLE PRECISION NOT NULL,
    "holdingShares" DOUBLE PRECISION,
    "marketValue" DOUBLE PRECISION,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FundOperation_userId_fundCode_idx" ON "FundOperation"("userId", "fundCode");

-- CreateIndex
CREATE INDEX "FundOperation_fundCode_idx" ON "FundOperation"("fundCode");

-- AddForeignKey
ALTER TABLE "FundOperation" ADD CONSTRAINT "FundOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; 