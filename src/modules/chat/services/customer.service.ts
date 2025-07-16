import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../../users/entities/customer.entity';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';
import { formatDateToISO } from '../../../utils/date-formatter';

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
  ) {}

  /**
   * Tạo customer mới
   */
  async createCustomer(
    createCustomerDto: CreateCustomerDto,
  ): Promise<Customer> {
    try {
      // Kiểm tra xem customer đã tồn tại chưa
      const existingCustomer = await this.customerRepository.findOne({
        where: { facebookId: createCustomerDto.facebookId },
      });

      if (existingCustomer) {
        throw new HttpException(
          `Customer với Facebook ID ${createCustomerDto.facebookId} đã tồn tại`,
          HttpStatus.CONFLICT,
        );
      }

      // Tạo customer mới
      const customer = this.customerRepository.create({
        ...createCustomerDto,
        firstInteractionAt: new Date(),
        lastInteractionAt: new Date(),
        totalConversations: 0,
        totalMessages: 0,
      });

      const savedCustomer = await this.customerRepository.save(customer);

      this.logger.log(`Đã tạo customer mới với ID: ${savedCustomer.id}`);
      return savedCustomer;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Lỗi khi tạo customer:', error);
      throw new HttpException(
        'Tạo customer thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Tìm hoặc tạo customer (dành cho webhook từ Facebook)
   */
  async findOrCreateCustomer(
    customerInfo: CreateCustomerDto,
  ): Promise<Customer> {
    try {
      // Tìm customer theo facebookId
      let customer = await this.customerRepository.findOne({
        where: { facebookId: customerInfo.facebookId },
      });

      if (!customer) {
        // Tạo customer mới nếu chưa tồn tại
        customer = await this.createCustomer(customerInfo);
      } else {
        // Cập nhật thông tin từ Facebook (có thể thay đổi)
        const shouldUpdate =
          (customerInfo.facebookName &&
            customerInfo.facebookName !== customer.facebookName) ||
          (customerInfo.facebookAvatarUrl &&
            customerInfo.facebookAvatarUrl !== customer.facebookAvatarUrl) ||
          (customerInfo.facebookProfileUrl &&
            customerInfo.facebookProfileUrl !== customer.facebookProfileUrl);

        if (shouldUpdate) {
          await this.customerRepository.update(customer.id, {
            facebookName: customerInfo.facebookName || customer.facebookName,
            facebookAvatarUrl:
              customerInfo.facebookAvatarUrl || customer.facebookAvatarUrl,
            facebookProfileUrl:
              customerInfo.facebookProfileUrl || customer.facebookProfileUrl,
            lastInteractionAt: new Date(),
          });

          // Reload customer với data mới
          customer = await this.customerRepository.findOne({
            where: { id: customer.id },
          });
        } else {
          // Chỉ update lastInteractionAt
          await this.customerRepository.update(customer.id, {
            lastInteractionAt: new Date(),
          });
          customer.lastInteractionAt = new Date();
        }
      }

      return customer;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Lỗi khi tìm hoặc tạo customer:', error);
      throw new HttpException(
        'Tìm hoặc tạo customer thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Lấy customer theo ID
   */
  async getCustomerById(customerId: string): Promise<Customer> {
    try {
      const customer = await this.customerRepository.findOne({
        where: { id: customerId },
        relations: ['conversations'],
      });

      if (!customer) {
        throw new HttpException('Customer không tồn tại', HttpStatus.NOT_FOUND);
      }

      return customer;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Lỗi khi lấy customer ${customerId}:`, error);
      throw new HttpException(
        'Lấy thông tin customer thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Lấy customer theo Facebook ID
   */
  async getCustomerByFacebookId(facebookId: string): Promise<Customer | null> {
    try {
      return await this.customerRepository.findOne({
        where: { facebookId },
        relations: ['conversations'],
      });
    } catch (error) {
      this.logger.error(
        `Lỗi khi lấy customer với Facebook ID ${facebookId}:`,
        error,
      );
      throw new HttpException(
        'Lấy thông tin customer thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Cập nhật customer
   */
  async updateCustomer(
    customerId: string,
    updateCustomerDto: UpdateCustomerDto,
  ): Promise<Customer> {
    try {
      // Kiểm tra customer tồn tại
      const existingCustomer = await this.getCustomerById(customerId);

      // Cập nhật customer
      await this.customerRepository.update(customerId, updateCustomerDto);

      // Lấy customer đã cập nhật
      const updatedCustomer = await this.getCustomerById(customerId);

      this.logger.log(`Đã cập nhật customer với ID: ${customerId}`);
      return updatedCustomer;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Lỗi khi cập nhật customer ${customerId}:`, error);
      throw new HttpException(
        'Cập nhật customer thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Cập nhật AI analysis cho customer
   */
  async updateCustomerAnalysis(
    customerId: string,
    analysis: {
      customerType?: string;
      intentAnalysis?: any;
      behaviorAnalysis?: any;
      interactionHistory?: any;
    },
  ): Promise<void> {
    try {
      const updateData: any = {};

      if (analysis.customerType) {
        updateData.customerType = analysis.customerType;
      }

      if (analysis.intentAnalysis) {
        updateData.intentAnalysis = analysis.intentAnalysis;
      }

      if (analysis.behaviorAnalysis) {
        updateData.behaviorAnalysis = analysis.behaviorAnalysis;
      }

      if (analysis.interactionHistory) {
        updateData.interactionHistory = analysis.interactionHistory;
      }

      await this.customerRepository.update(customerId, updateData);

      this.logger.log(`Đã cập nhật AI analysis cho customer ${customerId}`);
    } catch (error) {
      this.logger.error(
        `Lỗi khi cập nhật AI analysis cho customer ${customerId}:`,
        error,
      );
      throw new HttpException(
        'Cập nhật AI analysis thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Tăng số lượng conversation và message
   */
  async incrementStats(
    customerId: string,
    incrementConversation = false,
  ): Promise<void> {
    try {
      const updateData: any = {
        totalMessages: () => 'total_messages + 1',
      };

      if (incrementConversation) {
        updateData.totalConversations = () => 'total_conversations + 1';
      }

      await this.customerRepository
        .createQueryBuilder()
        .update(Customer)
        .set(updateData)
        .where('id = :id', { id: customerId })
        .execute();

      this.logger.log(
        `Đã tăng stats cho customer ${customerId} - conversations: ${incrementConversation}, messages: 1`,
      );
    } catch (error) {
      this.logger.error(
        `Lỗi khi tăng stats cho customer ${customerId}:`,
        error,
      );
    }
  }

  /**
   * Lấy danh sách customers với filter và pagination
   */
  async getCustomers(params: {
    page?: number;
    limit?: number;
    customerType?: string;
    search?: string;
  }) {
    try {
      const { page = 1, limit = 20, customerType, search } = params;
      const skip = (page - 1) * limit;

      const queryBuilder = this.customerRepository
        .createQueryBuilder('customer')
        .leftJoinAndSelect('customer.conversations', 'conversations');

      // Filter by customer type
      if (customerType) {
        queryBuilder.andWhere('customer.customerType = :customerType', {
          customerType,
        });
      }

      // Search by name, email, phone, facebook ID
      if (search) {
        queryBuilder.andWhere(
          '(customer.facebookName LIKE :search OR customer.email LIKE :search OR customer.phone LIKE :search OR customer.facebookId LIKE :search)',
          { search: `%${search}%` },
        );
      }

      const [customers, total] = await queryBuilder
        .orderBy('customer.lastInteractionAt', 'DESC')
        .skip(skip)
        .take(limit)
        .getManyAndCount();

      return {
        customers: customers.map((customer) => ({
          ...customer,
          firstInteractionAt: formatDateToISO(customer.firstInteractionAt),
          lastInteractionAt: formatDateToISO(customer.lastInteractionAt),
          createdAt: formatDateToISO(customer.createdAt),
          updatedAt: formatDateToISO(customer.updatedAt),
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error('Lỗi khi lấy danh sách customers:', error);
      throw new HttpException(
        'Lấy danh sách customers thất bại',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Format customer cho response
   */
  formatCustomerResponse(customer: Customer): any {
    return {
      ...customer,
      firstInteractionAt: formatDateToISO(customer.firstInteractionAt),
      lastInteractionAt: formatDateToISO(customer.lastInteractionAt),
      createdAt: formatDateToISO(customer.createdAt),
      updatedAt: formatDateToISO(customer.updatedAt),
    };
  }
}
