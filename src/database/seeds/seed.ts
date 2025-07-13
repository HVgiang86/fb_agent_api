import { DataSource } from 'typeorm';
import {
  Permission,
  PermissionName,
} from '../../modules/users/entities/permission.entity';
import {
  CustomerType,
  CustomerTypeName,
} from '../../modules/users/entities/customer-type.entity';

export async function seedDatabase(dataSource: DataSource) {
  const permissionRepository = dataSource.getRepository(Permission);
  const customerTypeRepository = dataSource.getRepository(CustomerType);

  // Seed permissions
  const permissions = [
    {
      name: PermissionName.CHAT,
      displayName: 'Chat Permission',
      description: 'Quyền truy cập trang chat, gửi/nhận tin nhắn',
    },
    {
      name: PermissionName.KB,
      displayName: 'Knowledge Base',
      description: 'Quyền quản lý knowledge base',
    },
    {
      name: PermissionName.PERMISSION,
      displayName: 'Permission Management',
      description: 'Quyền quản lý user và phân quyền',
    },
    {
      name: PermissionName.CUSTOMER_TYPE,
      displayName: 'Customer Type Management',
      description: 'Quyền quản lý phân loại khách hàng',
    },
  ];

  for (const permissionData of permissions) {
    const existingPermission = await permissionRepository.findOne({
      where: { name: permissionData.name },
    });

    if (!existingPermission) {
      const permission = permissionRepository.create(permissionData);
      await permissionRepository.save(permission);
      console.log(`Created permission: ${permissionData.name}`);
    }
  }

  // Seed customer types
  const customerTypes = [
    {
      name: CustomerTypeName.INDIVIDUAL,
      displayName: 'Khách hàng cá nhân',
      description: 'Khách hàng cá nhân',
    },
    {
      name: CustomerTypeName.BUSINESS,
      displayName: 'Khách hàng doanh nghiệp',
      description: 'Khách hàng doanh nghiệp',
    },
    {
      name: CustomerTypeName.HOUSEHOLD_BUSINESS,
      displayName: 'Khách hàng hộ kinh doanh',
      description: 'Khách hàng hộ kinh doanh',
    },
    {
      name: CustomerTypeName.PARTNER,
      displayName: 'Khách hàng đối tác',
      description: 'Khách hàng đối tác',
    },
  ];

  for (const customerTypeData of customerTypes) {
    const existingCustomerType = await customerTypeRepository.findOne({
      where: { name: customerTypeData.name },
    });

    if (!existingCustomerType) {
      const customerType = customerTypeRepository.create(customerTypeData);
      await customerTypeRepository.save(customerType);
      console.log(`Created customer type: ${customerTypeData.name}`);
    }
  }

  console.log('Database seeding completed');
}
