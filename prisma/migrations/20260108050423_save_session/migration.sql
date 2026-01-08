-- CreateTable
CREATE TABLE "SavedSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionSummary" TEXT NOT NULL,
    "emotion" TEXT NOT NULL,
    "intensity" INTEGER NOT NULL,
    "keyStressor" TEXT NOT NULL,
    "microStep" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    CONSTRAINT "SavedSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedSession_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConversationSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
