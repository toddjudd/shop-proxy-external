-- CreateTable
CREATE TABLE "WhiplashConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" DATETIME,
    "scope" TEXT,
    "whiplashUserId" INTEGER,
    "whiplashUserEmail" TEXT,
    "whiplashUserName" TEXT,
    "whiplashUserRole" TEXT,
    "customers" TEXT,
    "selectedCustomerId" INTEGER,
    "selectedCustomerName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "connectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRefreshedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WhiplashOAuthState" (
    "state" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "host" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "WhiplashConnection_shop_key" ON "WhiplashConnection"("shop");
