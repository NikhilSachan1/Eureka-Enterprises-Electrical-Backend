import { CommunicationCategory } from '../communication-logs/constants/communication-log.constants';
import { WhatsAppTemplateKey } from './constants/whatsapp.constants';

export interface WhatsAppMessageOptions {
  to: string; // Phone number
  templateKey: WhatsAppTemplateKey;
  templateData: Record<string, any>;
  category?: CommunicationCategory;
  referenceId?: string;
  referenceType?: string;
  recipientId?: string;
  recipientName?: string;
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
