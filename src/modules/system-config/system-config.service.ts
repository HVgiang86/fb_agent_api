import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig, ConfigKey } from './entities/system-config.entity';
import { CreateConfigDto } from './dto/create-config.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { ConfigService } from '../global/services/config.service';

@Injectable()
export class SystemConfigService {
  private readonly logger = new Logger(SystemConfigService.name);

  constructor(
    @InjectRepository(SystemConfig)
    private readonly systemConfigRepository: Repository<SystemConfig>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Tạo config mới
   */
  async createConfig(
    createConfigDto: CreateConfigDto,
    createdBy: string,
  ): Promise<SystemConfig> {
    try {
      // Kiểm tra config key đã tồn tại chưa
      const existingConfig = await this.systemConfigRepository.findOne({
        where: { configKey: createConfigDto.configKey },
      });

      if (existingConfig) {
        throw new ConflictException(
          `Config với key "${createConfigDto.configKey}" đã tồn tại`,
        );
      }

      // Validate giá trị config nếu là system config
      if (createConfigDto.isSystemConfig) {
        this.validateSystemConfigValue(
          createConfigDto.configKey,
          createConfigDto.configValue,
          createConfigDto.dataType,
        );
      }

      const newConfig = this.systemConfigRepository.create({
        ...createConfigDto,
        createdBy,
      });

      const savedConfig = await this.systemConfigRepository.save(newConfig);

      // Refresh cache để update config mới
      await this.configService.refreshCache();

      this.logger.log(
        `Config "${createConfigDto.configKey}" đã được tạo bởi user ${createdBy}`,
      );

      return savedConfig;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Lỗi khi tạo config:', error);
      throw new HttpException(
        'Lỗi khi tạo config',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Cập nhật config
   */
  async updateConfig(
    configKey: ConfigKey,
    updateConfigDto: UpdateConfigDto,
    updatedBy: string,
  ): Promise<SystemConfig> {
    try {
      const config = await this.systemConfigRepository.findOne({
        where: { configKey },
      });

      if (!config) {
        throw new NotFoundException(
          `Config với key "${configKey}" không tồn tại`,
        );
      }

      // Validate giá trị config nếu là system config
      if (config.isSystemConfig) {
        this.validateSystemConfigValue(
          configKey,
          updateConfigDto.configValue,
          config.dataType,
        );
      }

      await this.systemConfigRepository.update(
        { configKey },
        {
          configValue: updateConfigDto.configValue,
          description: updateConfigDto.description,
          updatedBy,
        },
      );

      // Update cache thông qua ConfigService
      await this.configService.updateConfig(
        configKey,
        updateConfigDto.configValue,
        updatedBy,
      );

      const updatedConfig = await this.systemConfigRepository.findOne({
        where: { configKey },
      });

      this.logger.log(
        `Config "${configKey}" đã được cập nhật bởi user ${updatedBy}`,
      );

      return updatedConfig!;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Lỗi khi cập nhật config:', error);
      throw new HttpException(
        'Lỗi khi cập nhật config',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Lấy tất cả config
   */
  async getAllConfigs(): Promise<SystemConfig[]> {
    try {
      return await this.systemConfigRepository.find({
        order: { configKey: 'ASC' },
        relations: ['creator', 'updater'],
      });
    } catch (error) {
      this.logger.error('Lỗi khi lấy danh sách config:', error);
      throw new HttpException(
        'Lỗi khi lấy danh sách config',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Lấy config theo key
   */
  async getConfigByKey(configKey: ConfigKey): Promise<SystemConfig> {
    try {
      const config = await this.systemConfigRepository.findOne({
        where: { configKey },
        relations: ['creator', 'updater'],
      });

      if (!config) {
        throw new NotFoundException(
          `Config với key "${configKey}" không tồn tại`,
        );
      }

      return config;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Lỗi khi lấy config:', error);
      throw new HttpException(
        'Lỗi khi lấy config',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Xóa config (chỉ config không phải system config)
   */
  async deleteConfig(configKey: ConfigKey, deletedBy: string): Promise<void> {
    try {
      const config = await this.systemConfigRepository.findOne({
        where: { configKey },
      });

      if (!config) {
        throw new NotFoundException(
          `Config với key "${configKey}" không tồn tại`,
        );
      }

      if (config.isSystemConfig) {
        throw new BadRequestException('Không thể xóa system config');
      }

      await this.systemConfigRepository.delete({ configKey });

      // Refresh cache
      await this.configService.refreshCache();

      this.logger.log(
        `Config "${configKey}" đã được xóa bởi user ${deletedBy}`,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Lỗi khi xóa config:', error);
      throw new HttpException(
        'Lỗi khi xóa config',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Toggle active status của config
   */
  async toggleConfigStatus(
    configKey: ConfigKey,
    updatedBy: string,
  ): Promise<SystemConfig> {
    try {
      const config = await this.systemConfigRepository.findOne({
        where: { configKey },
      });

      if (!config) {
        throw new NotFoundException(
          `Config với key "${configKey}" không tồn tại`,
        );
      }

      await this.systemConfigRepository.update(
        { configKey },
        {
          isActive: !config.isActive,
          updatedBy,
        },
      );

      // Refresh cache
      await this.configService.refreshCache();

      const updatedConfig = await this.systemConfigRepository.findOne({
        where: { configKey },
      });

      this.logger.log(
        `Config "${configKey}" status đã được toggle bởi user ${updatedBy}`,
      );

      return updatedConfig!;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Lỗi khi toggle config status:', error);
      throw new HttpException(
        'Lỗi khi toggle config status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Refresh cache
   */
  async refreshCache(): Promise<void> {
    await this.configService.refreshCache();
    this.logger.log('Config cache đã được refresh');
  }

  // Private helper methods
  private validateSystemConfigValue(
    key: ConfigKey,
    value: string,
    dataType: any,
  ): void {
    // Validation logic tương tự như trong ConfigService
    switch (key) {
      case ConfigKey.AI_CONFIDENCE_THRESHOLD:
        const threshold = Number(value);
        if (isNaN(threshold) || threshold < 0 || threshold > 100) {
          throw new BadRequestException(
            'AI Confidence Threshold phải là số từ 0 đến 100',
          );
        }
        break;

      case ConfigKey.MAX_RETRY_COUNT:
        const retryCount = Number(value);
        if (isNaN(retryCount) || retryCount < 0 || retryCount > 10) {
          throw new BadRequestException(
            'Max Retry Count phải là số từ 0 đến 10',
          );
        }
        break;

      case ConfigKey.REVIEWER_TIMEOUT_MINUTES:
        const timeout = Number(value);
        if (isNaN(timeout) || timeout < 1 || timeout > 1440) {
          throw new BadRequestException(
            'Reviewer Timeout phải là số từ 1 đến 1440 phút (24 giờ)',
          );
        }
        break;

      case ConfigKey.AUTO_ASSIGN_STRATEGY:
        const validStrategies = [
          'round_robin',
          'load_based',
          'expertise_based',
        ];
        if (!validStrategies.includes(value)) {
          throw new BadRequestException(
            `Auto Assign Strategy phải là một trong: ${validStrategies.join(
              ', ',
            )}`,
          );
        }
        break;

      case ConfigKey.ENABLE_WAITING_MESSAGE:
        if (!['true', 'false'].includes(value.toLowerCase())) {
          throw new BadRequestException(
            'Enable Waiting Message phải là true hoặc false',
          );
        }
        break;
    }
  }
}
