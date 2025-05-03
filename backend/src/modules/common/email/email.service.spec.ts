import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './email.service';
import { MailerService } from '@nestjs-modules/mailer';
import { Logger } from '@nestjs/common';

describe('EmailService', () => {
  let service: MailService;

  const mockMailerService = {
    sendMail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: MailerService,
          useValue: mockMailerService,
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);

    jest.spyOn(Logger, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendMail', () => {
    it('should call mailerService.sendMail with correct parameters', async () => {
      // Arrange
      const emailContext = {
        receiverEmails: 'test@example.com',
        subject: 'Test Subject',
        template: 'test-template',
        emailData: { firstName: 'Test', invitationLink: 'https://example.com' },
      };

      mockMailerService.sendMail.mockResolvedValueOnce(true);

      // Act
      await service.sendMail(emailContext);

      // Assert
      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        to: emailContext.receiverEmails,
        subject: emailContext.subject,
        template: emailContext.template,
        context: emailContext.emailData,
      });
    });

    it('should log success message when email is sent successfully', async () => {
      // Arrange
      const emailContext = {
        receiverEmails: 'test@example.com',
        subject: 'Test Subject',
        template: 'test-template',
        emailData: { firstName: 'Test' },
      };

      mockMailerService.sendMail.mockResolvedValueOnce(true);

      // Act
      await service.sendMail(emailContext);

      // Assert
      expect(Logger.log).toHaveBeenCalledWith(
        `Mail Successfully Sent to : ${emailContext.receiverEmails}`,
      );
    });

    it('should handle multiple receiver emails', async () => {
      // Arrange
      const emailContext = {
        receiverEmails: ['test1@example.com', 'test2@example.com'],
        subject: 'Test Subject',
        template: 'test-template',
        emailData: { firstName: 'Test' },
      };

      mockMailerService.sendMail.mockResolvedValueOnce(true);

      // Act
      await service.sendMail(emailContext);

      // Assert
      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        to: emailContext.receiverEmails,
        subject: emailContext.subject,
        template: emailContext.template,
        context: emailContext.emailData,
      });
      expect(Logger.log).toHaveBeenCalledWith(
        `Mail Successfully Sent to : ${emailContext.receiverEmails}`,
      );
    });

    it('should log error when sending email fails', async () => {
      // Arrange
      const emailContext = {
        receiverEmails: 'test@example.com',
        subject: 'Test Subject',
        template: 'test-template',
        emailData: { firstName: 'Test' },
      };

      const error = new Error('Failed to send email');
      mockMailerService.sendMail.mockRejectedValueOnce(error);

      // Act
      await service.sendMail(emailContext);

      // Assert
      expect(Logger.error).toHaveBeenCalledWith(error);
    });
  });
});
