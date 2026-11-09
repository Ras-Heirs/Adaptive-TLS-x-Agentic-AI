-- CreateTable
CREATE TABLE "intersections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intersections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensor_data" (
    "id" TEXT NOT NULL,
    "intersectionId" TEXT NOT NULL,
    "vehicleCount" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensor_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decisions" (
    "id" TEXT NOT NULL,
    "intersectionId" TEXT NOT NULL,
    "greenDuration" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'AGENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traffic_light_states" (
    "id" TEXT NOT NULL,
    "intersectionId" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'RED',
    "greenDuration" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "traffic_light_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_messages" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overrides" (
    "id" TEXT NOT NULL,
    "intersectionId" TEXT NOT NULL,
    "previousDuration" INTEGER NOT NULL,
    "newDuration" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "traffic_light_states_intersectionId_key" ON "traffic_light_states"("intersectionId");

-- AddForeignKey
ALTER TABLE "sensor_data" ADD CONSTRAINT "sensor_data_intersectionId_fkey" FOREIGN KEY ("intersectionId") REFERENCES "intersections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_intersectionId_fkey" FOREIGN KEY ("intersectionId") REFERENCES "intersections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traffic_light_states" ADD CONSTRAINT "traffic_light_states_intersectionId_fkey" FOREIGN KEY ("intersectionId") REFERENCES "intersections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "intersections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "intersections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overrides" ADD CONSTRAINT "overrides_intersectionId_fkey" FOREIGN KEY ("intersectionId") REFERENCES "intersections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
