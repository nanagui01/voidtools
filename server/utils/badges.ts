
export interface Badge {
  name: string
  url: string
  tooltip: string
}

const LOCAL_ICON_OVERRIDE: Record<string, string> = {
  staff: 'https://ik.imagekit.io/xys3wb0qo/discordstaff.svg',
  partner: 'https://ik.imagekit.io/xys3wb0qo/discordpartner.svg',
  hypesquad: 'https://ik.imagekit.io/xys3wb0qo/hypesquadevents.svg',
  bug_hunter_level_1: 'https://ik.imagekit.io/xys3wb0qo/discordbughunter1.svg',
  bug_hunter_level_2: 'https://ik.imagekit.io/xys3wb0qo/discordbughunter2.svg',
  hypesquad_house_1: 'https://ik.imagekit.io/xys3wb0qo/hypesquadbravery.svg',
  hypesquad_house_2: 'https://ik.imagekit.io/xys3wb0qo/hypesquadbrilliance.svg',
  hypesquad_house_3: 'https://ik.imagekit.io/xys3wb0qo/hypesquadbalance.svg',
  early_supporter: 'https://ik.imagekit.io/xys3wb0qo/discordearlysupporter.svg',
  verified_developer: 'https://ik.imagekit.io/xys3wb0qo/discordbotdev.svg',
  certified_moderator: 'https://ik.imagekit.io/xys3wb0qo/discordmod.svg',
  active_developer: 'https://ik.imagekit.io/xys3wb0qo/activedeveloper.svg',
}

export function processProfileBadges(
  profileBadges: Array<{ id: string; description: string; icon: string; link?: string | null }>,
  _premiumSince?: string | null,
  _premiumGuildSince?: string | null,
): Badge[] {
  return profileBadges.map((b) => ({
    name: b.id,
    url: LOCAL_ICON_OVERRIDE[b.id] ?? `https://cdn.discordapp.com/badge-icons/${b.icon}.png`,
    tooltip: b.description,
  }))
}

const FLAG_BADGES: Record<number, Badge> = {
  1: { name: 'Staff', url: 'https://ik.imagekit.io/xys3wb0qo/discordstaff.svg', tooltip: 'Discord Staff' },
  2: { name: 'Partner', url: 'https://ik.imagekit.io/xys3wb0qo/discordpartner.svg', tooltip: 'Discord Partner' },
  4: { name: 'HypeSquad', url: 'https://ik.imagekit.io/xys3wb0qo/hypesquadevents.svg', tooltip: 'HypeSquad Events' },
  8: { name: 'BugHunter1', url: 'https://ik.imagekit.io/xys3wb0qo/discordbughunter1.svg', tooltip: 'Bug Hunter Level 1' },
  64: { name: 'HypeSquadBravery', url: 'https://ik.imagekit.io/xys3wb0qo/hypesquadbravery.svg', tooltip: 'HypeSquad Bravery' },
  128: { name: 'HypeSquadBrilliance', url: 'https://ik.imagekit.io/xys3wb0qo/hypesquadbrilliance.svg', tooltip: 'HypeSquad Brilliance' },
  256: { name: 'HypeSquadBalance', url: 'https://ik.imagekit.io/xys3wb0qo/hypesquadbalance.svg', tooltip: 'HypeSquad Balance' },
  512: { name: 'EarlySupporter', url: 'https://ik.imagekit.io/xys3wb0qo/discordearlysupporter.svg', tooltip: 'Early Supporter' },
  16384: { name: 'BugHunter2', url: 'https://ik.imagekit.io/xys3wb0qo/discordbughunter2.svg', tooltip: 'Bug Hunter Level 2' },
  131072: { name: 'VerifiedDeveloper', url: 'https://ik.imagekit.io/xys3wb0qo/discordbotdev.svg', tooltip: 'Early Verified Bot Developer' },
  262144: { name: 'CertifiedModerator', url: 'https://ik.imagekit.io/xys3wb0qo/discordmod.svg', tooltip: 'Discord Certified Moderator' },
  4194304: { name: 'ActiveDeveloper', url: 'https://ik.imagekit.io/xys3wb0qo/activedeveloper.svg', tooltip: 'Active Developer' },
}

const FLAG_ORDER = [1, 2, 4, 8, 16384, 64, 128, 256, 512, 131072, 262144, 4194304]

export function decodeBadges(publicFlags?: number, premiumType?: number): Badge[] {
  const badges: Badge[] = []

  if (premiumType && premiumType > 0) {
    badges.push({ name: 'Nitro', url: 'https://ik.imagekit.io/xys3wb0qo/discordnitro.svg', tooltip: 'Nitro' })
  }

  if (publicFlags) {
    for (const flag of FLAG_ORDER) {
      if ((publicFlags & flag) === flag && FLAG_BADGES[flag]) {
        badges.push(FLAG_BADGES[flag])
      }
    }
  }

  return badges
}
