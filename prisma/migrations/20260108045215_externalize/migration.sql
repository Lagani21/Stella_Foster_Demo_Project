-- CreateTable
CREATE TABLE "ExternalizedThought" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "summary" TEXT NOT NULL,
    "structured" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    CONSTRAINT "ExternalizedThought_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExternalizedThought_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConversationSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
