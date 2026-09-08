import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { PrismaService } from '@/prisma/prisma.service';
import { mockProject } from '@/prisma/mock-data';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';

describe('ProjectsController', () => {
  let controller: ProjectsController;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    prisma.project.findMany.mockResolvedValue([mockProject()]);
    prisma.project.findUnique.mockResolvedValue(mockProject());
    prisma.project.create.mockResolvedValue(mockProject());
    prisma.project.update.mockResolvedValue(mockProject());
    prisma.project.delete.mockResolvedValue(mockProject());

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: prisma },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProjectsController>(ProjectsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /projects', () => {
    it('should return all projects', async () => {
      const result = await controller.findAll();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Default Project');
    });
  });

  describe('GET /projects/:projectId', () => {
    it('should return project by id', async () => {
      const result = await controller.findOne(1);
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Default Project');
    });

    it('should return null for non-existent', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      const result = await controller.findOne(999);
      expect(result).toBeNull();
    });
  });

  describe('POST /projects', () => {
    it('should create a project and return 201', async () => {
      const result = await controller.create({ name: 'New Project', description: 'Desc' });
      expect(result).not.toBeNull();
      expect(result.name).toBe('Default Project');
      expect(prisma.project.create).toHaveBeenCalledWith({
        data: { name: 'New Project', description: 'Desc' },
      });
    });

    it('should throw ConflictException on duplicate', async () => {
      const { Prisma } = await import('@prisma/client');
      prisma.project.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.8.0',
        }),
      );

      await expect(
        controller.create({ name: 'Duplicate' }),
      ).rejects.toThrow('Project name already exists');
    });
  });

  describe('PATCH /projects/:projectId', () => {
    it('should update a project', async () => {
      const result = await controller.update(1, { name: 'Renamed' });
      expect(result).not.toBeNull();
      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: 'Renamed' },
      });
    });
  });

  describe('DELETE /projects/:projectId', () => {
    it('should delete a project and return 204', async () => {
      await expect(controller.remove(1)).resolves.toBeUndefined();
      expect(prisma.project.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });
});
