import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  SupportConversation,
  SupportMessageSenderRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit-log/audit-log.service';

const MESSAGE_PAGE_SIZE = 100;
const MESSAGE_PREVIEW_LENGTH = 140;

export interface SupportMessageView {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: SupportMessageSenderRole;
  body: string;
  createdAt: Date;
}

export interface SupportConversationView {
  id: string;
  status: 'OPEN' | 'RESOLVED';
  lastMessageAt: Date;
  lastMessagePreview: string;
  lastMessageSenderRole: SupportMessageSenderRole;
  hasUnread: boolean;
}

export interface AdminSupportConversationView extends SupportConversationView {
  userId: string;
  userFullName: string;
  userPhone: string;
  resolvedAt: Date | null;
}

/**
 * One persistent support thread per user (plan phase 11 — "personal chatroom"). A
 * SupportConversation row is only ever materialized on that user's first message, so an
 * unstarted conversation is represented as `null`, never as an empty row — this keeps the
 * denormalized unread-tracking fields (see schema.prisma) unambiguous.
 */
@Injectable()
export class SupportChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async getConversationForUser(
    userId: string,
  ): Promise<SupportConversationView | null> {
    const conversation = await this.prisma.supportConversation.findUnique({
      where: { userId },
    });
    return conversation ? this.toUserView(conversation) : null;
  }

  async listMessagesForUser(userId: string): Promise<SupportMessageView[]> {
    const conversation = await this.prisma.supportConversation.findUnique({
      where: { userId },
    });
    if (!conversation) return [];
    return this.listMessages(conversation.id);
  }

  async sendMessageAsUser(
    userId: string,
    body: string,
  ): Promise<{
    message: SupportMessageView;
    conversation: SupportConversationView;
  }> {
    const trimmed = assertNonEmpty(body);

    const { conversation, message } = await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.supportConversation.findUnique({
          where: { userId },
        });
        const now = new Date();
        const summary = {
          status: 'OPEN' as const,
          lastMessageAt: now,
          lastMessagePreview: preview(trimmed),
          lastMessageSenderRole: 'USER' as const,
          userLastReadAt: now,
        };

        const conv = existing
          ? await tx.supportConversation.update({
              where: { id: existing.id },
              data: summary,
            })
          : await tx.supportConversation.create({
              data: { userId, ...summary },
            });

        const msg = await tx.supportMessage.create({
          data: {
            conversationId: conv.id,
            senderId: userId,
            senderRole: 'USER',
            body: trimmed,
          },
        });

        return { conversation: conv, message: msg };
      },
    );

    return {
      message,
      conversation: this.toUserView(conversation),
    };
  }

  async markReadAsUser(userId: string): Promise<void> {
    await this.prisma.supportConversation.updateMany({
      where: { userId },
      data: { userLastReadAt: new Date() },
    });
  }

  async listConversationsForAdmin(filters: {
    status?: 'OPEN' | 'RESOLVED';
    search?: string;
    take?: number;
    skip?: number;
  }): Promise<{
    conversations: AdminSupportConversationView[];
    total: number;
  }> {
    const take = Math.min(filters.take ?? 50, 200);
    const skip = filters.skip ?? 0;

    const where = {
      status: filters.status,
      user: filters.search
        ? {
            OR: [
              {
                fullName: {
                  contains: filters.search,
                  mode: 'insensitive' as const,
                },
              },
              { phone: { contains: filters.search } },
            ],
          }
        : undefined,
    };

    const [rows, total] = await Promise.all([
      this.prisma.supportConversation.findMany({
        where,
        include: { user: { select: { fullName: true, phone: true } } },
        orderBy: { lastMessageAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.supportConversation.count({ where }),
    ]);

    // hasUnread (see toAdminView) can't be expressed as a portable Prisma `where` column-to-
    // column comparison, so "unread first" is left to the client to sort/badge from this
    // already-small, already-paginated page rather than reaching for raw SQL for it.
    return {
      conversations: rows.map((row) => this.toAdminView(row)),
      total,
    };
  }

  async getMessagesForAdmin(
    conversationId: string,
  ): Promise<SupportMessageView[]> {
    await this.requireConversation(conversationId);
    return this.listMessages(conversationId);
  }

  async sendMessageAsAdmin(
    adminId: string,
    conversationId: string,
    body: string,
  ): Promise<{
    message: SupportMessageView;
    conversation: AdminSupportConversationView;
  }> {
    const trimmed = assertNonEmpty(body);
    await this.requireConversation(conversationId);

    const { conversation, message } = await this.prisma.$transaction(
      async (tx) => {
        const now = new Date();
        const conv = await tx.supportConversation.update({
          where: { id: conversationId },
          data: {
            status: 'OPEN',
            lastMessageAt: now,
            lastMessagePreview: preview(trimmed),
            lastMessageSenderRole: 'ADMIN',
            adminLastReadAt: now,
          },
          include: { user: { select: { fullName: true, phone: true } } },
        });

        const msg = await tx.supportMessage.create({
          data: {
            conversationId,
            senderId: adminId,
            senderRole: 'ADMIN',
            body: trimmed,
          },
        });

        return { conversation: conv, message: msg };
      },
    );

    return {
      message,
      conversation: this.toAdminView(conversation),
    };
  }

  async markReadAsAdmin(conversationId: string): Promise<void> {
    await this.requireConversation(conversationId);
    await this.prisma.supportConversation.update({
      where: { id: conversationId },
      data: { adminLastReadAt: new Date() },
    });
  }

  async resolveConversation(
    adminId: string,
    conversationId: string,
    reason: string | undefined,
    ipAddress?: string,
  ): Promise<AdminSupportConversationView> {
    const existing = await this.requireConversation(conversationId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const conv = await tx.supportConversation.update({
        where: { id: conversationId },
        data: {
          status: 'RESOLVED',
          resolvedByAdminId: adminId,
          resolvedAt: new Date(),
        },
        include: { user: { select: { fullName: true, phone: true } } },
      });

      await this.auditLog.record(
        {
          adminUserId: adminId,
          actionType: 'SUPPORT_CONVERSATION_RESOLVED',
          targetEntityType: 'SupportConversation',
          targetEntityId: conversationId,
          reason: reason?.trim() || 'Marked resolved from the support inbox',
          beforeState: { status: existing.status },
          afterState: { status: 'RESOLVED' },
          ipAddress,
        },
        tx,
      );

      return conv;
    });

    return this.toAdminView(updated);
  }

  private async requireConversation(
    conversationId: string,
  ): Promise<SupportConversation> {
    const conversation = await this.prisma.supportConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundException('Support conversation not found');
    }
    return conversation;
  }

  private async listMessages(
    conversationId: string,
    take = MESSAGE_PAGE_SIZE,
  ): Promise<SupportMessageView[]> {
    const messages = await this.prisma.supportMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return messages.reverse();
  }

  private toUserView(
    conversation: SupportConversation,
  ): SupportConversationView {
    const hasUnread =
      conversation.lastMessageSenderRole === 'ADMIN' &&
      conversation.lastMessageAt > conversation.userLastReadAt;
    return {
      id: conversation.id,
      status: conversation.status,
      lastMessageAt: conversation.lastMessageAt,
      lastMessagePreview: conversation.lastMessagePreview,
      lastMessageSenderRole: conversation.lastMessageSenderRole,
      hasUnread,
    };
  }

  private toAdminView(
    conversation: SupportConversation & {
      user: { fullName: string; phone: string };
    },
  ): AdminSupportConversationView {
    const hasUnread =
      conversation.lastMessageSenderRole === 'USER' &&
      (!conversation.adminLastReadAt ||
        conversation.lastMessageAt > conversation.adminLastReadAt);
    return {
      id: conversation.id,
      userId: conversation.userId,
      userFullName: conversation.user.fullName,
      userPhone: conversation.user.phone,
      status: conversation.status,
      lastMessageAt: conversation.lastMessageAt,
      lastMessagePreview: conversation.lastMessagePreview,
      lastMessageSenderRole: conversation.lastMessageSenderRole,
      resolvedAt: conversation.resolvedAt,
      hasUnread,
    };
  }
}

function assertNonEmpty(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) {
    throw new BadRequestException('Message cannot be empty');
  }
  return trimmed;
}

function preview(body: string): string {
  return body.length > MESSAGE_PREVIEW_LENGTH
    ? `${body.slice(0, MESSAGE_PREVIEW_LENGTH)}…`
    : body;
}
