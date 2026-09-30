/*
 * A new character starts with the junk, skeleton and bottle kinds ignored, as
 * 3.x hid them. Those three classes declare an ignoreMenu label in tval.json,
 * so the ignore setup lists them and the player can bring any kind back. The
 * Filthy Rag and the broken weapons belong to Angband's own armour and sword
 * classes, whose kinds the ignore menus never offer, so they are left alone.
 */
const JUNK_KINDS: Readonly<Record<string, readonly string[]>> = {
  bottle: ["& Empty Bottle~"],
  junk: ["& Shard~ of Pottery", "& Broken Stick~"],
  skeleton: [
    "& Broken Skull~", "& Broken Bone~", "& Canine Skeleton~",
    "& Rodent Skeleton~", "& Human Skeleton~", "& Dwarf Skeleton~",
    "& Elf Skeleton~", "& Gnome Skeleton~",
  ],
};

export interface JunkState {
  ignore: {
    kindIgnoreWhenAware(kidx: number): void;
    kindIgnoreWhenUnaware(kidx: number): void;
  };
}

export interface JunkRegistries {
  objects: { kinds: readonly ({ name: string; tval: number; kidx: number } | null)[] };
}

export function ignoreJunk(
  state: JunkState,
  registries: JunkRegistries,
  tvalFindIdx: (name: string) => number,
): void {
  for (const [type, names] of Object.entries(JUNK_KINDS)) {
    const tval = tvalFindIdx(type);
    if (tval < 0) throw new Error(`Missing junk item class: ${type}`);
    for (const name of names) {
      const kind = registries.objects.kinds.find((k) => k?.name === name && k.tval === tval);
      if (!kind) throw new Error(`Missing junk kind: ${type} ${name}`);
      state.ignore.kindIgnoreWhenAware(kind.kidx);
      state.ignore.kindIgnoreWhenUnaware(kind.kidx);
    }
  }
}
