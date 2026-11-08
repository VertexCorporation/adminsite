import * as dom from '../../utils/dom.js';
import { crossfade } from '../../ui/transition.js';
import { showToast, userErrorMessage, __, getLang, onLangChange, sanitizeHTML } from '../../utils/ui.js';
import { icon } from '../../utils/icons.js';
import { openPopover, closePopover } from '../shell.js';
import { MODEL_TYPE } from './constants.js';
import { canEditModels } from './access.js';

export function createModelCatalog({ state }) {
    function renderManualModelsList() {
        const offlineCountBadge = document.getElementById('offline-model-count-badge');
        const roleplayCountBadge = document.getElementById('roleplay-model-count-badge');

        let offlineCount = 0;
        let roleplayCount = 0;

        if (state.manualModels && state.manualModels.length > 0) {
            for (const model of state.manualModels) {
                if (model.type === MODEL_TYPE.OFFLINE) {
                    offlineCount++;
                } else if (model.type === MODEL_TYPE.ROLEPLAY) {
                    roleplayCount++;
                }
            }
        }

        if (offlineCountBadge && roleplayCountBadge) {
            offlineCountBadge.textContent = `${__('models.offline_count')} ${offlineCount}`;
            roleplayCountBadge.textContent = `${__('models.roleplay_count')} ${roleplayCount}`;
        }

        crossfade(dom.manualModelsListContainer, () => {
        dom.manualModelsListContainer.innerHTML = '';
        if (!state.manualModels || state.manualModels.length === 0) {
            dom.manualModelsListContainer.innerHTML = `<p class="form-hint" data-i18n="models.no_models">${__('models.no_models')}</p>`;
            return;
        }

        state.manualModels.forEach(model => {
            const item = document.createElement('div');
            item.className = 'model-item';

            const titleText = model.details?.[document.documentElement.lang]?.title || model.details?.en?.title || model.id;
            const modelType = model.type || 'unknown';

            item.innerHTML = `
                <div class="item-details">
                    <span class="item-title">${sanitizeHTML(titleText)}</span>
                    <span class="model-type-badge ${sanitizeHTML(modelType)}">${sanitizeHTML(modelType)}</span>
                </div>
                <div class="item-actions">
                    <button class="edit-btn" data-id="${sanitizeHTML(model.id)}">${__('common.edit')}</button>
                    <button class="translations-btn" data-id="${sanitizeHTML(model.id)}">${__('common.translations')}</button>
                    <button class="delete-btn" data-id="${sanitizeHTML(model.id)}">${__('common.delete')}</button>
                </div>`;
            dom.manualModelsListContainer.appendChild(item);
        });
        compactModelActions(dom.manualModelsListContainer);
        });
    }

    /**
     * Renders the collapsible explorer view for all models in the database.
     * Uses a template string with sanitized data to prevent XSS vulnerabilities.
     */
    // An indexed, lazily rendered catalogue. Filters share one source and never
    // trigger network requests; collapsed groups do not allocate model-row DOM.
    let catalogGroups=[],catalogRows=[],catalogQuery='',catalogLimit=120;
    let catalogSelection=new Set(),filtersReady=false,catalogFlatMode=false;
    const openProducerGroups=new Set(),openSeriesGroups=new Set();
    const catalogText=(tr,en)=>getLang()==='tr'?tr:en;
    const catalogType=row=>String(row.model.type||row.model.source||'unknown').toLowerCase();
    const catalogStatus=row=>{
        const value=row.model.publish_status ?? row.model.publicationStatus ?? row.model.status;
        if(typeof value==='string'&&value.trim())return value.toLowerCase();
        if(row.model.published===true)return 'published';
        if(row.model.published===false)return 'draft';
        return 'unspecified';
    };
    function buildCatalogIndex(){
        catalogGroups=[];catalogRows=[];
        for(const pName of Object.keys(state.data?.producers||{}).sort()){
            const producer=state.data.producers[pName],group={pName,series:[]};
            for(const sName of Object.keys(producer).sort()){
                if(sName==='series_description')continue;
                const source=producer[sName];
                if(!source||typeof source!=='object')continue;
                const series={sName,hidden:source.hidden===true,rows:[]};
                for(const vName of Object.keys(source).sort()){
                    if(['series_description','hidden'].includes(vName))continue;
                    const model=source[vName];if(!model||typeof model!=='object'||!model.id)continue;
                    const row={pName,sName,vName,model,hidden:series.hidden||model.hidden===true,index:catalogRows.length};
                    series.rows.push(row);catalogRows.push(row);
                }
                group.series.push(series);
            }
            catalogGroups.push(group);
        }
        catalogSelection.clear();
    }
    function modelVariantHTML(row,selectable=false){
        const model=row.model;
        const hasDesc=(model.source==='manual'&&model.details?.en?.title)||model.description?.en;
        const title=model.details?.[getLang()]?.title||model.details?.en?.title||row.vName;
        return `<div class="model-item variant-item" data-catalog-index="${row.index}">
            ${selectable?`<label class="model-select-label"><input class="model-select" type="checkbox" data-select-model="${row.index}" ${catalogSelection.has(row.index)?'checked':''} aria-label="${sanitizeHTML(title)}"></label>`:''}
            <div class="variant-details"><span class="model-title">${sanitizeHTML(title)}</span><span class="model-id-label">${sanitizeHTML(model.id)}</span><small>${sanitizeHTML(row.pName)} / ${sanitizeHTML(row.sName)} · ${sanitizeHTML(catalogType(row))} · ${sanitizeHTML(catalogStatus(row))}${row.hidden?' · '+catalogText('Gizli','Hidden'):''}</small></div>
            <div class="item-actions">
              <button type="button" class="translations-btn" data-pname="${sanitizeHTML(row.pName)}" data-sname="${sanitizeHTML(row.sName)}" data-vname="${sanitizeHTML(row.vName)}" ${!hasDesc?'disabled':''}>${__('common.translations')}</button>
              ${model.source==='openrouter'?`<button type="button" class="block-btn" data-id="${sanitizeHTML(model.id)}">${__('models.block')}</button>`:''}
            </div></div>`;
    }
    function filteredCatalogRows(){
        const toolbar=document.getElementById('model-catalog-filters');
        if(!toolbar)return null;
        const q=String(toolbar.querySelector('[data-catalog-search]')?.value||'').trim().toLocaleLowerCase();
        const provider=toolbar.querySelector('[data-catalog-provider]')?.value||'';
        const type=toolbar.querySelector('[data-catalog-type]')?.value||'';
        const status=toolbar.querySelector('[data-catalog-status]')?.value||'';
        const visibility=toolbar.querySelector('[data-catalog-visibility]')?.value||'';
        if(!q&&!provider&&!type&&!status&&!visibility&&!catalogFlatMode)return null;
        return catalogRows.filter(row=>{
            if(provider&&row.pName!==provider)return false;
            if(type&&catalogType(row)!==type)return false;
            if(status&&catalogStatus(row)!==status)return false;
            if(visibility==='visible'&&row.hidden)return false;
            if(visibility==='hidden'&&!row.hidden)return false;
            if(!q)return true;
            const titles=Object.values(row.model.details||{}).filter(x=>x&&typeof x==='object').map(x=>x.title||'');
            const searchable=[...titles,row.vName,row.model.id,row.pName,row.sName,row.model.provider,catalogType(row),catalogStatus(row)].join(' ').toLocaleLowerCase();
            return searchable.includes(q);
        });
    }
    function renderCatalogFiltered(rows){
        const visible=rows.slice(0,catalogLimit);
        const status=`<p class="form-hint" role="status" aria-live="polite">${rows.length} ${catalogText('model eşleşiyor','matching models')}</p>`;
        dom.allModelsListContainer.innerHTML=status+visible.map(row=>modelVariantHTML(row,true)).join('')+(rows.length>visible.length?`<button type="button" class="chrome-btn-outline model-show-more" data-catalog-more>${catalogText('Daha fazla göster','Show more')} (${rows.length-visible.length})</button>`:'');
        compactModelActions(dom.allModelsListContainer);
        updateCatalogSelection();
    }
    function updateCatalogSelection(){
        const count=document.getElementById('model-catalog-selection-count');
        if(count)count.textContent=`${catalogSelection.size} ${catalogText('seçili','selected')}`;
        const copy=document.getElementById('model-catalog-copy');
        if(copy)copy.disabled=!catalogSelection.size;
    }
    function fillCatalogSeries(details,limit=80){
        const gi=Number(details.dataset.groupIndex),si=Number(details.dataset.seriesIndex);
        const series=catalogGroups[gi]?.series[si],content=details.querySelector('.details-content');
        if(!series||!content)return;
        const visible=series.rows.slice(0,limit);
        content.innerHTML=visible.map(row=>modelVariantHTML(row)).join('')+(limit<series.rows.length?`<button type="button" class="chrome-btn-outline" data-series-more="${limit}">${catalogText('Daha fazla göster','Show more')} (${series.rows.length-limit})</button>`:'');
        compactModelActions(content);
    }
    function renderAllModelsExplorer(){
        if(!state.data?.producers){
            dom.allModelsListContainer.innerHTML=`<p class="form-hint">${__('models.empty_database')}</p>`;
            return;
        }
        const matches=filteredCatalogRows();
        if(matches!==null){renderCatalogFiltered(matches);return;}
        dom.allModelsListContainer.innerHTML=catalogGroups.map((group,gi)=>
           `<details class="producer-group" data-group-index="${gi}" ${openProducerGroups.has(gi)?'open':''}><summary>${sanitizeHTML(group.pName)} <small>(${group.series.reduce((n,series)=>n+series.rows.length,0)})</small></summary><div class="details-content">
           ${group.series.map((series,si)=>`<div class="model-series-shell"><details class="series-group ${series.hidden?'hidden-series':''}" data-group-index="${gi}" data-series-index="${si}" ${openSeriesGroups.has(gi+':'+si)?'open':''}>
             <summary><span class="series-name">${sanitizeHTML(series.sName)} ${series.hidden?__('common.hide'):''}</span><small>(${series.rows.length})</small></summary><div class="details-content"></div>
           </details><div class="series-actions">
             <button type="button" class="edit-series-desc-btn" data-pname="${sanitizeHTML(group.pName)}" data-sname="${sanitizeHTML(series.sName)}">${__('models.edit_desc')}</button>
             <button type="button" class="${series.hidden?'unhide-series-btn':'hide-series-btn'}" data-pname="${sanitizeHTML(group.pName)}" data-sname="${sanitizeHTML(series.sName)}">${series.hidden?__('common.unhide'):__('common.hide')}</button>
           </div></div>`).join('')}</div></details>`
        ).join('');
        compactModelActions(dom.allModelsListContainer);
        dom.allModelsListContainer.querySelectorAll('details.series-group[open]').forEach(el=>fillCatalogSeries(el));
    }
    function refreshCatalogOptions(){
        const toolbar=document.getElementById('model-catalog-filters');if(!toolbar)return;
        const provider=toolbar.querySelector('[data-catalog-provider]');
        const selected=provider.value;
        provider.innerHTML='<option value="">'+catalogText('Tüm sağlayıcılar','All providers')+'</option>'+catalogGroups.map(g=>`<option value="${sanitizeHTML(g.pName)}">${sanitizeHTML(g.pName)}</option>`).join('');
        provider.value=selected;
        for(const [selector,values,title] of [
          ['type',[...new Set(catalogRows.map(catalogType))],catalogText('Tüm türler','All types')],
          ['status',[...new Set(catalogRows.map(catalogStatus))],catalogText('Tüm durumlar','All statuses')]]){
            const control=toolbar.querySelector('[data-catalog-'+selector+']'),previous=control.value;
            control.innerHTML='<option value="">'+title+'</option>'+values.sort().map(x=>`<option value="${sanitizeHTML(x)}">${sanitizeHTML(x)}</option>`).join('');
            control.value=previous;
        }
    }
    function initCatalogFilters(){
        if(filtersReady)return;filtersReady=true;
        const toolbar=document.createElement('div');toolbar.id='model-catalog-filters';toolbar.className='model-catalog-filters';
        dom.allModelsListContainer.before(toolbar);
        const paint=()=>{
          const prev=Object.fromEntries(['search','provider','type','status','visibility'].map(k=>[k,toolbar.querySelector('[data-catalog-'+k+']')?.value||'']));
          toolbar.innerHTML=`<label class="catalog-search"><span>${catalogText('Model ara','Search models')}</span><input type="search" data-catalog-search placeholder="${catalogText('İsim veya model kimliği','Name or model ID')}"></label>
            <label><span>${catalogText('Sağlayıcı','Provider')}</span><select data-catalog-provider></select></label>
            <label><span>${catalogText('Tür','Type')}</span><select data-catalog-type></select></label>
            <label><span>${catalogText('Yayın durumu','Publication status')}</span><select data-catalog-status></select></label>
            <label><span>${catalogText('Görünürlük','Visibility')}</span><select data-catalog-visibility><option value="">${catalogText('Tümü','All')}</option><option value="visible">${catalogText('Görünür','Visible')}</option><option value="hidden">${catalogText('Gizli','Hidden')}</option></select></label>
            <div class="model-bulk-toolbar"><span id="model-catalog-selection-count" aria-live="polite"></span><button type="button" class="chrome-btn-outline" id="model-catalog-select-all">${catalogText('Görünenleri seç','Select visible')}</button><button type="button" class="chrome-btn-outline" id="model-catalog-clear">${catalogText('Temizle','Clear')}</button><button type="button" class="chrome-btn-outline" id="model-catalog-copy">${catalogText('Kimlikleri kopyala','Copy IDs')}</button></div>`;
          refreshCatalogOptions();
          for(const [k,v] of Object.entries(prev))toolbar.querySelector('[data-catalog-'+k+']').value=v;
          toolbar.querySelectorAll('input[data-catalog-search],select').forEach(input=>input.addEventListener('input',()=>{catalogFlatMode=false;catalogLimit=120;renderAllModelsExplorer();}));
          toolbar.querySelector('#model-catalog-select-all').onclick=()=>{catalogFlatMode=true;const rows=filteredCatalogRows()||catalogRows;rows.slice(0,catalogLimit).forEach(r=>catalogSelection.add(r.index));renderAllModelsExplorer();};
          toolbar.querySelector('#model-catalog-clear').onclick=()=>{catalogSelection.clear();catalogFlatMode=false;toolbar.querySelectorAll('input[data-catalog-search],select').forEach(el=>{el.value='';});renderAllModelsExplorer();};
          toolbar.querySelector('#model-catalog-copy').onclick=async()=>{
            const ids=[...catalogSelection].map(i=>catalogRows[i]?.model.id).filter(Boolean);
            try{await navigator.clipboard.writeText(ids.join('\n'));showToast(()=>catalogText('Model kimlikleri kopyalandı','Model IDs copied'),'success');}
            catch(error){showToast(()=>userErrorMessage(error),'error');}
          };
          updateCatalogSelection();
        };
        paint();onLangChange(()=>{paint();renderAllModelsExplorer();});
        dom.allModelsListContainer.addEventListener('change',e=>{
           if(e.target.matches('[data-select-model]')){const i=Number(e.target.dataset.selectModel);if(e.target.checked)catalogSelection.add(i);else catalogSelection.delete(i);updateCatalogSelection();}
        });
        dom.allModelsListContainer.addEventListener('click',e=>{
           const more=e.target.closest('[data-catalog-more]');if(more){catalogLimit+=120;renderAllModelsExplorer();return;}
           const seriesMore=e.target.closest('[data-series-more]');
           if(seriesMore){const details=seriesMore.closest('details.series-group');fillCatalogSeries(details,Number(seriesMore.dataset.seriesMore)+80);}
        });
        dom.allModelsListContainer.addEventListener('toggle',e=>{
           const el=e.target;if(!el.matches('details'))return;
           if(el.classList.contains('producer-group')){const gi=Number(el.dataset.groupIndex);if(el.open)openProducerGroups.add(gi);else openProducerGroups.delete(gi);}
           if(el.classList.contains('series-group')){
               const key=el.dataset.groupIndex+':'+el.dataset.seriesIndex;
               if(el.open){openSeriesGroups.add(key);fillCatalogSeries(el);}
               else {openSeriesGroups.delete(key);el.querySelector('.details-content')?.replaceChildren();}
           }
        },true);
    }
    function compactModelActions(root){
        root.querySelectorAll('.item-actions,.series-actions').forEach(actions=>{
            const originals=[...actions.querySelectorAll('button')];if(!originals.length)return;
            const source=document.createElement('div');source.hidden=true;originals.forEach(button=>source.append(button));actions.append(source);
            const trigger=document.createElement('button');trigger.type='button';trigger.className='icon-action-btn model-actions-trigger';trigger.setAttribute('aria-label',__('common.actions'));trigger.innerHTML=icon('dots');
            if(!canEditModels('models.library'))trigger.hidden=true;
            actions.append(trigger);
            trigger.onclick=e=>{e.preventDefault();e.stopPropagation();openPopover(trigger,{render:popover=>{popover.classList.add('model-menu');originals.forEach(original=>{const button=document.createElement('button');button.type='button';button.className='menu-item';button.textContent=original.textContent;button.disabled=original.disabled;button.onclick=()=>{closePopover();original.click();};popover.append(button);});}});};
        });
    }

    return { renderManualModelsList, renderAllModelsExplorer, initCatalogFilters, buildCatalogIndex, refreshCatalogOptions };
}
