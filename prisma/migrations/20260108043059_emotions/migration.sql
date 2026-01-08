-- CreateTable
CREATE TABLE "EmotionalLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "emotion" TEXT NOT NULL,
    "intensity" INTEGER NOT NULL,
    "confidence" TEXT NOT NULL,
    "triggers" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    CONSTRAINT "EmotionalLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmotionalLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConversationSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
