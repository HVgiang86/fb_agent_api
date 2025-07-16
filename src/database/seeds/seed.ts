import { DataSource } from 'typeorm';
import {
  Permission,
  PermissionName,
} from '../../modules/users/entities/permission.entity';

export async function seedDatabase(dataSource: DataSource) {
  const permissionRepository = dataSource.getRepository(Permission);

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

  console.log('Database seeding completed!');
}
