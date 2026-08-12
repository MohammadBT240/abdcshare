import type { CatalogueRow } from "@/features/catalogues/hooks/use-catalogue";

export interface RequestClassTypeGroup {
  class: CatalogueRow;
  types: CatalogueRow[];
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

/**
 * Nest request types under their parent class. Classes with no types still appear.
 * Orphan types (missing/unknown class) go under a synthetic "Unclassified" group.
 */
export function groupRequestClassesWithTypes(
  classes: CatalogueRow[],
  types: CatalogueRow[],
): RequestClassTypeGroup[] {
  const byClassId = new Map<number, CatalogueRow[]>();
  const orphans: CatalogueRow[] = [];

  const classIds = new Set(classes.map((c) => c.id));

  for (const type of types) {
    const classId = type.requestClassId;
    if (classId == null || !classIds.has(classId)) {
      orphans.push(type);
      continue;
    }
    const list = byClassId.get(classId) ?? [];
    list.push(type);
    byClassId.set(classId, list);
  }

  const groups: RequestClassTypeGroup[] = classes
    .slice()
    .sort((a, b) => compareText(a.name, b.name))
    .map((cls) => ({
      class: cls,
      types: (byClassId.get(cls.id) ?? [])
        .slice()
        .sort((a, b) => compareText(a.name, b.name)),
    }));

  if (orphans.length > 0) {
    groups.push({
      class: {
        id: -1,
        name: "Unclassified",
        isActive: true,
        code: null,
        description: null,
      },
      types: orphans.slice().sort((a, b) => compareText(a.name, b.name)),
    });
  }

  return groups;
}

/** Filter groups by class name/code or any type name (case-insensitive). */
export function filterClassTypeGroups(
  groups: RequestClassTypeGroup[],
  query: string,
): RequestClassTypeGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;

  return groups
    .map((group) => {
      const classMatch =
        group.class.name.toLowerCase().includes(q) ||
        (group.class.code?.toLowerCase().includes(q) ?? false);
      const matchingTypes = group.types.filter((t) =>
        t.name.toLowerCase().includes(q),
      );
      if (classMatch) return group;
      if (matchingTypes.length === 0) return null;
      return { class: group.class, types: matchingTypes };
    })
    .filter((g): g is RequestClassTypeGroup => g != null);
}
