// Property hierarchy configuration — server-free constants/helpers so client
// components can import them without pulling in next/headers (see the data-layer
// modules for the DB reads). Mirrors the rules enforced by the
// check_property_hierarchy() DB trigger (migration 0018).
//
//   Containers (may have children): Building, Sub-building.
//   Leaf (no children):             Unit.
//   Top-level (no parent):          Building, Standalone Property.
//   Child (needs a container):      Sub-building, Unit.
//   Leasable (can hold a lease):    Unit, Standalone Property.

export const CONFIG_BUILDING = "Building";
export const CONFIG_SUBBUILDING = "Sub-building";
export const CONFIG_STANDALONE = "Standalone Property";
export const CONFIG_UNIT = "Unit";

/** Configurations that can be a parent of other properties (valid parent picker targets). */
export const CONTAINER_CONFIGS = [CONFIG_BUILDING, CONFIG_SUBBUILDING] as const;

/** Configurations that must be top-level (no parent). */
export const TOP_LEVEL_CONFIGS = [CONFIG_BUILDING, CONFIG_STANDALONE] as const;

/** Configurations that require a parent container. */
export const CHILD_CONFIGS = [CONFIG_SUBBUILDING, CONFIG_UNIT] as const;

/** Configurations that can hold a lease (used for occupancy / leasable counts). */
export const LEASABLE_CONFIGS = [CONFIG_UNIT, CONFIG_STANDALONE] as const;

const has = (list: readonly string[], v: string | null | undefined) => !!v && list.includes(v);

/** Can this configuration be a parent in the model (offered as a parent option)? */
export const isContainerConfig = (config: string | null | undefined) => has(CONTAINER_CONFIGS, config);

/** Must this configuration be created/kept at the top level (no parent)? */
export const isTopLevelConfig = (config: string | null | undefined) => has(TOP_LEVEL_CONFIGS, config);

/** Does this configuration require a parent container? */
export const isChildConfig = (config: string | null | undefined) => has(CHILD_CONFIGS, config);

/** Is this configuration leasable (a Unit or a Standalone Property)? */
export const isLeasableConfig = (config: string | null | undefined) => has(LEASABLE_CONFIGS, config);

/**
 * Does this property show a "Contents" panel (units / sub-buildings) and its own
 * utilities? Everything except a Unit leaf — preserves the legacy behaviour where
 * a Standalone Property could also carry units.
 */
export const canHaveChildren = (config: string | null | undefined) => config !== CONFIG_UNIT;

/** Child configurations that can be added under a given parent configuration. */
export function addableChildConfigs(parentConfig: string | null | undefined): string[] {
  if (parentConfig === CONFIG_BUILDING) return [CONFIG_SUBBUILDING, CONFIG_UNIT];
  // Sub-buildings and (legacy) standalones can hold units.
  if (parentConfig === CONFIG_SUBBUILDING || parentConfig === CONFIG_STANDALONE) return [CONFIG_UNIT];
  return [];
}
