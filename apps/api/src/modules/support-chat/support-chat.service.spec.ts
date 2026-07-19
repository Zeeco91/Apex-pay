import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditLogService } from '../../common/audit-log/audit-log.service';
import { SupportChatService } from './support-chat.service';

type MockPrisma = {
  supportConversation: {
    findUnique: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    updateMany: jest.Mock;
  };
  supportMessage: {
    create: jest.Mock;
    findMany: jest.Mock;
  };
  $transaction: jest.Mock;
};

function fakePrisma(): MockPrisma {
  const prisma: MockPrisma = {
    supportConversation: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    supportMessage: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
      callback(prisma),
    ),
  };
  return prisma;
}

describe('SupportChatService', () => {
  let prisma: MockPrisma;
  let auditLogRecord: jest.Mock;
  let service: SupportChatService;

  beforeEach(() => {
    prisma = fakePrisma();
    auditLogRecord = jest.fn();
    const auditLog = { record: auditLogRecord } as unknown as AuditLogService;
    service = new SupportChatService(
      prisma as unknown as PrismaService,
      auditLog,
    );
  });

  describe('getConversationForUser', () => {
    it('returns null when the user has never started a conversation', async () => {
      prisma.supportConversation.findUnique.mockResolvedValue(null);
      await expect(
        service.getConversationForUser('user-1'),
      ).resolves.toBeNull();
    });

    it('flags hasUnread when the last message was from an admin the user has not read', async () => {
      prisma.supportConversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        status: 'OPEN',
        lastMessageAt: new Date('2026-01-02T00:00:00Z'),
        lastMessagePreview: 'hi',
        lastMessageSenderRole: 'ADMIN',
        userLastReadAt: new Date('2026-01-01T00:00:00Z'),
      });
      const result = await service.getConversationForUser('user-1');
      expect(result?.hasUnread).toBe(true);
    });

    it('does not flag hasUnread when the user sent the last message themselves', async () => {
      prisma.supportConversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        status: 'OPEN',
        lastMessageAt: new Date('2026-01-02T00:00:00Z'),
        lastMessagePreview: 'hi',
        lastMessageSenderRole: 'USER',
        userLastReadAt: new Date('2026-01-01T00:00:00Z'),
      });
      const result = await service.getConversationForUser('user-1');
      expect(result?.hasUnread).toBe(false);
    });
  });

  describe('sendMessageAsUser', () => {
    it('rejects a whitespace-only message', async () => {
      await expect(service.sendMessageAsUser('user-1', '   ')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates a new conversation on the first message', async () => {
      prisma.supportConversation.findUnique.mockResolvedValue(null);
      prisma.supportConversation.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => ({
          id: 'conv-1',
          userId: data.userId,
          ...data,
        }),
      );
      prisma.supportMessage.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => ({
          id: 'msg-1',
          createdAt: new Date(),
          ...data,
        }),
      );

      const result = await service.sendMessageAsUser(
        'user-1',
        'Hello, I need help',
      );

      expect(prisma.supportConversation.create).toHaveBeenCalled();
      expect(prisma.supportConversation.update).not.toHaveBeenCalled();
      expect(result.message.body).toBe('Hello, I need help');
      expect(result.conversation.status).toBe('OPEN');
    });

    it('reuses and reopens an existing resolved conversation', async () => {
      prisma.supportConversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        status: 'RESOLVED',
      });
      prisma.supportConversation.update.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => ({
          id: 'conv-1',
          userId: 'user-1',
          ...data,
        }),
      );
      prisma.supportMessage.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => ({
          id: 'msg-2',
          createdAt: new Date(),
          ...data,
        }),
      );

      const result = await service.sendMessageAsUser('user-1', 'Still there?');

      expect(prisma.supportConversation.create).not.toHaveBeenCalled();
      expect(prisma.supportConversation.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'conv-1' } }),
      );
      expect(result.conversation.status).toBe('OPEN');
    });
  });

  describe('resolveConversation', () => {
    it('throws NotFoundException for a conversation that does not exist', async () => {
      prisma.supportConversation.findUnique.mockResolvedValue(null);
      await expect(
        service.resolveConversation('admin-1', 'missing-conv', undefined),
      ).rejects.toThrow(NotFoundException);
      expect(auditLogRecord).not.toHaveBeenCalled();
    });

    it('records an audit log entry with a default reason when none is given', async () => {
      prisma.supportConversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        status: 'OPEN',
      });
      prisma.supportConversation.update.mockResolvedValue({
        id: 'conv-1',
        userId: 'user-1',
        status: 'RESOLVED',
        lastMessageAt: new Date(),
        lastMessagePreview: 'hi',
        lastMessageSenderRole: 'USER',
        adminLastReadAt: new Date(),
        resolvedAt: new Date(),
        user: { fullName: 'Jane Doe', phone: '+2348012345678' },
      });

      await service.resolveConversation(
        'admin-1',
        'conv-1',
        undefined,
        '127.0.0.1',
      );

      expect(auditLogRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: 'admin-1',
          actionType: 'SUPPORT_CONVERSATION_RESOLVED',
          targetEntityId: 'conv-1',
          reason: 'Marked resolved from the support inbox',
        }),
        prisma,
      );
    });
  });
});
