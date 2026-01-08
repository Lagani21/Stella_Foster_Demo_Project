-- CreateTable
CREATE TABLE "ParkedWorry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "worry" TEXT NOT NULL,
    "reviewTime" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    CONSTRAINT "ParkedWorry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ParkedWorry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConversationSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
