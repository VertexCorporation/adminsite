export const MAX_TEAM_CARDS = 40;
export const BOARD_POSITIONS = Object.freeze(["CEO","CTO","COO","CFO","CMO","CDO","CHRO","CCO","CLO","CITO"]);

export function normalizeSiteTeamCard(card) {
    const positions = card.positions || card.titles || {};
    const links = Array.isArray(card.links) ? card.links : [];
    const boardPosition = BOARD_POSITIONS.find(key => positions.en === key && positions.tr === key) || (BOARD_POSITIONS.includes(card.position) ? card.position : '');
    const social = label => links.find(link => link.label?.toLowerCase() === label.toLowerCase())?.url || card.socialLinks?.[label.toLowerCase()] || '';
    return { ...card, positions, links, titles: positions, position: boardPosition || positions.en || positions.tr || card.position || '', boardPosition, photoUrl: card.imageUrl || card.photoUrl || '', socialLinks: { linkedin: social('LinkedIn'), instagram: social('Instagram') } };
}

export function createSiteTeamPayload({ existing, name, position, titleTr, titleEn, imageUrl, order, linkedin, instagram }) {
    const board = BOARD_POSITIONS.includes(position);
    const positions = { ...(existing?.positions || {}), tr: board ? position : titleTr, en: board ? position : titleEn };
    const links = (existing?.links || []).filter(link => !['linkedin', 'instagram'].includes(link.label?.toLowerCase()));
    if (linkedin) links.push({ label: 'LinkedIn', url: linkedin });
    if (instagram) links.push({ label: 'Instagram', url: instagram });
    return { kind: 'card', ...(existing?.id ? { id: existing.id } : {}), name, imageUrl, positions, links, order: Number(order) };
}
