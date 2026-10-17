const test = require('node:test');
const assert = require('node:assert/strict');

test('team card adapter preserves localized roles and unrelated social links', async () => {
    const {normalizeSiteTeamCard,createSiteTeamPayload,MAX_TEAM_CARDS} = await import('../js/utils/teamCards.mjs');
    assert.equal(MAX_TEAM_CARDS,40);
    const old = {"id":"abc","name":"Example","positions":{"tr":"Kurucu","en":"Founder","de":"Gründer"},"imageUrl":"https://example.com/a.webp","links":[{"label":"Website","url":"https://example.com/"},{"label":"LinkedIn","url":"https://linkedin.com/a"}],"order":2};
    const normalized = normalizeSiteTeamCard(old);
    assert.equal(normalized.photoUrl,old.imageUrl);
    assert.equal(normalized.socialLinks.linkedin,'https://linkedin.com/a');
    const edited = createSiteTeamPayload({existing:normalized,name:'Example 2',position:'custom',titleTr:'Kurucu Ortak',titleEn:'Co-founder',imageUrl:normalized.photoUrl,order:4,linkedin:'https://linkedin.com/new',instagram:''});
    assert.equal(edited.kind,'card');
    assert.equal(edited.id,'abc');
    assert.equal(edited.positions.de,'Gründer');
    assert.deepEqual(edited.links.map(link=>link.label),['Website','LinkedIn']);
    assert.equal(edited.order,4);
    const board = createSiteTeamPayload({name:'Board',position:'CEO',titleTr:'',titleEn:'',imageUrl:'https://example.invalid/b.webp',order:1,linkedin:'',instagram:''});
    assert.deepEqual(board.positions,{tr:'CEO',en:'CEO'});
});
