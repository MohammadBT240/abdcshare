import { LibraryItemStatus, LibraryVisibility } from '@abdcshare/shared';
import { canEditItem, canSeeItem, libraryScopeSql, type LibraryAccessItem, type LibraryViewer } from './library-access';

const TAX = 2;
const AUDIT = 1;

const staffTax: LibraryViewer = { userId: 'u-tax', departmentId: TAX, isCurator: false };
const staffNoDept: LibraryViewer = { userId: 'u-none', departmentId: null, isCurator: false };
const curator: LibraryViewer = { userId: 'u-sa', departmentId: null, isCurator: true };

function item(overrides: Partial<LibraryAccessItem> = {}): LibraryAccessItem {
  return {
    status: LibraryItemStatus.Published,
    visibility: LibraryVisibility.Firm,
    uploadedById: 'u-other',
    departmentIds: [],
    ...overrides,
  };
}

describe('canSeeItem — visibility matrix (design §5)', () => {
  const restrictedToAudit = item({ visibility: LibraryVisibility.Departments, departmentIds: [AUDIT] });
  const restrictedToTax = item({ visibility: LibraryVisibility.Departments, departmentIds: [AUDIT, TAX] });

  it.each([
    ['firm-wide published → any staff', item(), staffTax, true],
    ['firm-wide published → staff without department', item(), staffNoDept, true],
    ['department match → visible', restrictedToTax, staffTax, true],
    ['department mismatch → hidden', restrictedToAudit, staffTax, false],
    ['restricted → staff without department hidden', restrictedToAudit, staffNoDept, false],
    ['restricted → curator sees it', restrictedToAudit, curator, true],
    ['uploader sees own restricted item outside their department', { ...restrictedToAudit, uploadedById: 'u-tax' }, staffTax, true],
    ['archived → hidden from others', item({ status: LibraryItemStatus.Archived }), staffTax, false],
    ['archived → uploader still sees it', item({ status: LibraryItemStatus.Archived, uploadedById: 'u-tax' }), staffTax, true],
    ['archived → curator sees it', item({ status: LibraryItemStatus.Archived }), curator, true],
    ['draft → hidden from others', item({ status: LibraryItemStatus.Draft }), staffTax, false],
    ['draft → uploader sees it', item({ status: LibraryItemStatus.Draft, uploadedById: 'u-tax' }), staffTax, true],
  ])('%s', (_label, it_, viewer, expected) => {
    expect(canSeeItem(it_, viewer)).toBe(expected);
  });
});

describe('canEditItem', () => {
  it('lets the uploader edit their own item', () => {
    expect(canEditItem({ uploadedById: 'u-tax' }, staffTax)).toBe(true);
  });
  it("blocks staff from editing someone else's item", () => {
    expect(canEditItem({ uploadedById: 'u-other' }, staffTax)).toBe(false);
  });
  it('lets curators edit anything', () => {
    expect(canEditItem({ uploadedById: 'u-other' }, curator)).toBe(true);
  });
});

describe('libraryScopeSql', () => {
  it('is unrestricted for curators', () => {
    expect(libraryScopeSql('i', curator)).toEqual({ sql: 'true', params: [] });
  });

  it('allows firm items and own uploads for a user without a department', () => {
    const scope = libraryScopeSql('i', staffNoDept);
    expect(scope.sql).toBe(`(i.visibility = 'Firm' or i.uploaded_by_id = ?)`);
    expect(scope.params).toEqual(['u-none']);
  });

  it('adds a department membership check when the user has a department', () => {
    const scope = libraryScopeSql('e0', staffTax);
    expect(scope.sql).toContain(`e0.visibility = 'Firm'`);
    expect(scope.sql).toContain('e0.uploaded_by_id = ?');
    expect(scope.sql).toContain('lid.item_id = e0.id and lid.department_id = ?');
    expect(scope.params).toEqual(['u-tax', TAX]);
  });
});
