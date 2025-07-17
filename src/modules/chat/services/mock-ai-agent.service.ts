import { Injectable, Logger } from '@nestjs/common';
import {
  AIAgentRequest,
  AIAgentResponse,
  IAIAgentService,
} from '../interfaces/ai-agent.interface';
import { CustomerType } from '../types/enums';

@Injectable()
export class MockAIAgentService implements IAIAgentService {
  private readonly logger = new Logger(MockAIAgentService.name);

  async analyzeMessage(request: AIAgentRequest): Promise<AIAgentResponse> {
    try {
      this.logger.log(`Analyzing message: ${request.question}`);

      // Simulate processing delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Mock analysis based on keywords
      const question = request.question.toLowerCase();

      let customerType = CustomerType.INDIVIDUAL;
      let mainTopic = 'general_inquiry';
      let keyInformation = 'customer inquiry';

      // Random confidence xung quanh 90% (85% - 95%)
      const confidence = 0.85 + Math.random() * 0.1; // 85% - 95%

      // Simple keyword-based analysis (giữ nguyên confidence đã random)
      if (question.includes('loan') || question.includes('vay')) {
        mainTopic = 'banking_loan';
        keyInformation = 'loan inquiry';
        // confidence giữ nguyên từ random
      } else if (question.includes('card') || question.includes('thẻ')) {
        mainTopic = 'banking_card';
        keyInformation = 'card services';
        // confidence giữ nguyên từ random
      } else if (
        question.includes('account') ||
        question.includes('tài khoản')
      ) {
        mainTopic = 'banking_account';
        keyInformation = 'account services';
        // confidence giữ nguyên từ random
      } else if (
        question.includes('business') ||
        question.includes('doanh nghiệp')
      ) {
        customerType = CustomerType.BUSINESS;
        mainTopic = 'business_inquiry';
        keyInformation = 'business services';
        // confidence giữ nguyên từ random
      } else if (question.includes('partner') || question.includes('đối tác')) {
        customerType = CustomerType.PARTNER;
        mainTopic = 'partner_services';
        keyInformation = 'partner services';
        // confidence giữ nguyên từ random
      } else if (
        question.includes('household') ||
        question.includes('hộ kinh doanh')
      ) {
        customerType = CustomerType.HOUSEHOLD_BUSINESS;
        mainTopic = 'household_business_inquiry';
        keyInformation = 'household business services';
        // confidence giữ nguyên từ random
      }

      // Generate mock response
      const response: AIAgentResponse = {
        answer: this.generateMockAnswer(mainTopic, customerType),
        confidence,
        clarified_query: this.clarifyQuery(request.question, mainTopic),
        customer_type: customerType,
        key_information: keyInformation,
        main_topic: mainTopic,
        question: request.question,
      };

      this.logger.log(
        `AI Analysis completed for topic: ${mainTopic}, customer type: ${customerType}`,
      );

      return response;
    } catch (error) {
      this.logger.error('Error analyzing message:', error);

      // Return default response on error
      return {
        answer:
          'Xin chào! Cảm ơn bạn đã liên hệ với chúng tôi. Một chuyên viên sẽ hỗ trợ bạn trong thời gian sớm nhất.',
        confidence: 0.5,
        clarified_query: request.question,
        customer_type: CustomerType.INDIVIDUAL,
        key_information: 'general inquiry',
        main_topic: 'general_inquiry',
        question: request.question,
      };
    }
  }

  private generateMockAnswer(
    topic: string,
    customerType: CustomerType,
  ): string {
    const greetings = {
      [CustomerType.PARTNER]: 'Xin chào quý đối tác! ',
      [CustomerType.BUSINESS]: 'Xin chào quý doanh nghiệp! ',
      [CustomerType.HOUSEHOLD_BUSINESS]: 'Xin chào hộ kinh doanh! ',
      [CustomerType.INDIVIDUAL]: 'Xin chào! ',
    };

    const responses = {
      banking_loan:
        'Chúng tôi có nhiều gói vay ưu đãi phù hợp với nhu cầu của bạn. Chuyên viên sẽ tư vấn chi tiết về lãi suất và điều kiện vay.',
      banking_card:
        'Chúng tôi cung cấp đầy đủ các loại thẻ tín dụng và thẻ ghi nợ với nhiều ưu đãi hấp dẫn. Chuyên viên sẽ hỗ trợ bạn chọn thẻ phù hợp.',
      banking_account:
        'Chúng tôi hỗ trợ mở tài khoản và các dịch vụ ngân hàng trực tuyến. Chuyên viên sẽ hướng dẫn bạn chi tiết.',
      business_inquiry:
        'Chúng tôi có nhiều giải pháp tài chính dành riêng cho doanh nghiệp. Chuyên viên sẽ tư vấn phù hợp với quy mô kinh doanh của bạn.',
      premium_services:
        'Chúng tôi cung cấp các dịch vụ cao cấp với nhiều đặc quyền độc đáo. Chuyên viên sẽ giới thiệu chi tiết các gói dịch vụ VIP.',
      general_inquiry:
        'Cảm ơn bạn đã quan tâm đến dịch vụ của chúng tôi. Chuyên viên sẽ hỗ trợ bạn trong thời gian sớm nhất.',
    };

    const greeting =
      greetings[customerType] || greetings[CustomerType.INDIVIDUAL];
    const answer = responses[topic] || responses.general_inquiry;

    return greeting + answer + ' Vui lòng chờ trong giây lát.';
  }

  private clarifyQuery(originalQuestion: string, topic: string): string {
    const clarifications = {
      banking_loan: `Khách hàng hỏi về dịch vụ vay: ${originalQuestion}`,
      banking_card: `Khách hàng hỏi về dịch vụ thẻ: ${originalQuestion}`,
      banking_account: `Khách hàng hỏi về tài khoản ngân hàng: ${originalQuestion}`,
      business_inquiry: `Doanh nghiệp hỏi về dịch vụ: ${originalQuestion}`,
      premium_services: `Khách hàng VIP hỏi về dịch vụ cao cấp: ${originalQuestion}`,
      general_inquiry: `Khách hàng có câu hỏi chung: ${originalQuestion}`,
    };

    return clarifications[topic] || clarifications.general_inquiry;
  }

  /**
   * Get default model name từ system config
   */
  getDefaultModelName(): string {
    return 'gpt-4.1'; // Có thể lấy từ system config sau
  }

  /**
   * Get default API key từ system config
   */
  getDefaultApiKey(): string | undefined {
    return undefined; // Có thể lấy từ system config sau
  }
}
