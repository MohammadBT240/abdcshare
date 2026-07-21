import type { EntityName } from '@mikro-orm/postgresql';
import { TitleEntity } from './infrastructure/persistence/titles.entity';
import { GenderEntity } from './infrastructure/persistence/genders.entity';
import { MaritalStatusEntity } from './infrastructure/persistence/marital-statuses.entity';
import { ClientTypeEntity } from './infrastructure/persistence/client-types.entity';
import { IndustryEntity } from './infrastructure/persistence/industries.entity';
import { CategoryEntity } from './infrastructure/persistence/categories.entity';
import { BankEntity } from './infrastructure/persistence/banks.entity';
import { GeneralStatusEntity } from './infrastructure/persistence/general-statuses.entity';
import { StateEntity } from './infrastructure/persistence/states.entity';
import { LgaEntity } from './infrastructure/persistence/lgas.entity';
import { WardEntity } from './infrastructure/persistence/wards.entity';

/** Minimal shape shared by every lookup table. */
export interface LookupRow {
  id: number;
  name: string;
  isActive: boolean;
}

export interface LookupConfig {
  entity: EntityName<LookupRow>;
  /** For hierarchical lookups (lgas → state, wards → lga). */
  parent?: { field: string; entity: EntityName<{ id: number }> };
}

/** URL segment → entity (+ optional parent). Types are intentionally widened to LookupRow;
 *  at runtime MikroORM uses the concrete entity metadata. */
export const LOOKUP_REGISTRY: Record<string, LookupConfig> = {
  titles: { entity: TitleEntity },
  genders: { entity: GenderEntity },
  'marital-statuses': { entity: MaritalStatusEntity },
  'client-types': { entity: ClientTypeEntity },
  industries: { entity: IndustryEntity },
  categories: { entity: CategoryEntity },
  banks: { entity: BankEntity },
  'general-statuses': { entity: GeneralStatusEntity },
  states: { entity: StateEntity },
  lgas: { entity: LgaEntity, parent: { field: 'state', entity: StateEntity } },
  wards: { entity: WardEntity, parent: { field: 'lga', entity: LgaEntity } },
};

export const LOOKUP_TYPES = Object.keys(LOOKUP_REGISTRY);
