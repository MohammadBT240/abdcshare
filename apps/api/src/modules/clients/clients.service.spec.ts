import { ConflictException, NotFoundException } from '@nestjs/common';
import { EVENT } from '@abdcshare/shared';
import { ClientsService } from './clients.service';
import { ClientEntity } from './infrastructure/persistence/client.entity';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import { RoleEntity } from '../roles/infrastructure/persistence/role.entity';
import type { CreateClientDto } from './presentation/dto/create-client.dto';

/**
 * Verifies the core rule: creating a client provisions its primary contact
 * login (a Client-role user) atomically, and emits the credential email.
 */
describe('ClientsService.create', () => {
  const clientRole = { id: 1, roleName: 'Client' } as RoleEntity;

  function makeDto(): CreateClientDto {
    return {
      name: 'Acme Ltd',
      contact: { firstName: 'Ada', surname: 'Bello', email: 'Ada@Acme.com' },
    } as CreateClientDto;
  }

  function buildEm(overrides: Partial<Record<string, unknown>> = {}) {
    const created: Array<{ entity: unknown; data: Record<string, unknown> }> = [];
    const em = {
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === RoleEntity) return clientRole;
        return null; // no existing client name / contact email
      }),
      getReference: jest.fn((entity: unknown, id: unknown) => ({ __ref: entity, id })),
      create: jest.fn((entity: unknown, data: Record<string, unknown>) => {
        const row = { id: entity === ClientEntity ? 'client-uuid' : 'user-uuid', ...data };
        created.push({ entity, data: row });
        return row;
      }),
      persistAndFlush: jest.fn(async () => undefined),
      ...overrides,
    };
    return { em, created };
  }

  it('creates the client + a Client-role contact user and emails credentials', async () => {
    const { em, created } = buildEm();
    const outbox = { enqueue: jest.fn() };
    const service = new ClientsService(em as never, outbox as never);

    const dto = makeDto();
    const result = await service.create(dto);

    const contact = created.find((c) => c.entity === UserEntity)?.data;
    expect(contact).toBeDefined();
    expect(contact?.role).toBe(clientRole);
    expect(contact?.client).toBeDefined();
    expect(contact?.email).toBe('ada@acme.com'); // normalised lower-case
    expect(contact?.mustChangePassword).toBe(true);
    expect(contact?.passwordHash).toEqual(expect.any(String));
    expect(contact?.passwordHash).not.toBe(''); // hashed, not blank

    expect(outbox.enqueue).toHaveBeenCalledWith(
      EVENT.UserCreated,
      expect.objectContaining({ email: 'ada@acme.com', tempPassword: expect.any(String) }),
    );
    expect(em.persistAndFlush).toHaveBeenCalledTimes(1);
    expect(result.primaryContactEmail).toBe('ada@acme.com');
    expect(result.name).toBe('Acme Ltd');
  });

  it('rejects a duplicate client name', async () => {
    const { em } = buildEm({
      findOne: jest.fn(async (entity: unknown) =>
        entity === ClientEntity ? ({ id: 'x' } as ClientEntity) : null,
      ),
    });
    const service = new ClientsService(em as never, { enqueue: jest.fn() } as never);
    await expect(service.create(makeDto())).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects when the contact email already belongs to a user', async () => {
    const { em } = buildEm({
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === ClientEntity) return null;
        if (entity === UserEntity) return { id: 'u' } as UserEntity;
        return clientRole;
      }),
    });
    const service = new ClientsService(em as never, { enqueue: jest.fn() } as never);
    await expect(service.create(makeDto())).rejects.toBeInstanceOf(ConflictException);
  });

  it('fails clearly if the Client role is not seeded', async () => {
    const { em } = buildEm({ findOne: jest.fn(async () => null) });
    const service = new ClientsService(em as never, { enqueue: jest.fn() } as never);
    await expect(service.create(makeDto())).rejects.toBeInstanceOf(NotFoundException);
  });
});
