import { UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { TokenService } from './application/token.service';
import { ClientsService } from '../clients/clients.service';

const contact = (clientActive: boolean) => ({
  id: 'u-grace',
  email: 'grace@client.test',
  fullName: 'Grace Eze',
  isActive: true,
  passwordHash: '',
  mustChangePassword: false,
  partnerDesignation: null,
  role: { roleName: 'Client' },
  client: { id: 'cl-1', isActive: clientActive },
  avatarPath: null,
});

function auth(user: ReturnType<typeof contact>) {
  const em = { findOne: jest.fn(async () => user), create: jest.fn(), flush: jest.fn() };
  const tokens = { issuePair: jest.fn(async () => ({ accessToken: 'a', refreshToken: 'r' })) };
  const outbox = { enqueue: jest.fn() };
  const service = new AuthService(
    em as never,
    tokens as never,
    outbox as never,
    { get: jest.fn() } as never,
    { record: jest.fn() } as never,
    { presignDownload: jest.fn() } as never,
  );
  return { service, tokens, outbox, em };
}

describe('a deactivated client switches off its contacts', () => {
  let hash = '';
  beforeAll(async () => {
    hash = await bcrypt.hash('Secret123!', 4);
  });

  it('refuses sign-in, saying why once the password is right', async () => {
    const user = { ...contact(false), passwordHash: hash };
    const { service, tokens } = auth(user);
    await expect(service.login({ email: user.email, password: 'Secret123!' })).rejects.toThrow(/portal access is switched off/);
    expect(tokens.issuePair).not.toHaveBeenCalled();
  });

  it('still says only "Invalid credentials" for a wrong password', async () => {
    const user = { ...contact(false), passwordHash: hash };
    const { service } = auth(user);
    await expect(service.login({ email: user.email, password: 'nope' })).rejects.toThrow('Invalid credentials');
  });

  it('signs in normally once the client is active again', async () => {
    const user = { ...contact(true), passwordHash: hash };
    const { service, tokens } = auth(user);
    await service.login({ email: user.email, password: 'Secret123!' });
    expect(tokens.issuePair).toHaveBeenCalled();
  });

  it('sends no password-reset email', async () => {
    const { service, outbox, em } = auth(contact(false));
    await service.requestPasswordReset({ email: 'grace@client.test' });
    expect(em.create).not.toHaveBeenCalled();
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('refuses to refresh a session and ends its token family', async () => {
    const row = { familyId: 'fam-1', revokedAt: null, expiresAt: new Date(Date.now() + 60_000), user: contact(false) };
    const em = { findOne: jest.fn(async () => row), nativeUpdate: jest.fn(async () => 1), flush: jest.fn() };
    const tokens = new TokenService({ signAsync: jest.fn() } as never, { get: jest.fn() } as never, em as never);
    await expect(tokens.rotate('raw')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(em.nativeUpdate).toHaveBeenCalledWith(expect.anything(), { familyId: 'fam-1', revokedAt: null }, { revokedAt: expect.any(Date) });
  });

  it('deactivating the client signs every contact out', async () => {
    const client = { id: 'cl-1', isActive: true, primaryContact: null, clientType: null };
    const em = { findOne: jest.fn(async () => client), findOneOrFail: jest.fn(async () => client), flush: jest.fn() };
    const users = { endSessionsForClient: jest.fn(async () => undefined) };
    const service = new ClientsService(em as never, { enqueue: jest.fn() } as never, users as never, {} as never);
    jest.spyOn(service as never, 'toDto' as never).mockResolvedValue({} as never);
    await service.deactivate('cl-1');
    expect(client.isActive).toBe(false);
    expect(users.endSessionsForClient).toHaveBeenCalledWith('cl-1');
  });
});
