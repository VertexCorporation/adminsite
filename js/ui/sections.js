// Shared form grouping used by the console's long management editors.
export function groupFields(container, groups) {
 const elements=new Map();
 for(const group of groups)for(const name of group.keys){
  const input=container.querySelector('[name="'+name+'"]');
  if(input)elements.set(name,input.closest('.form-group-field'));
 }
 for(const group of groups){
  const details=document.createElement('details');details.className='ui-section';details.open=!!group.open;
  const summary=document.createElement('summary');summary.textContent=group.label;details.append(summary);
  const grid=document.createElement('div');grid.className='form-grid';details.append(grid);
  for(const name of group.keys){const wrapper=elements.get(name);if(wrapper)grid.append(wrapper);}
  container.append(details);
 }
 container.classList.remove('form-grid');
 const leftovers=[...container.children].filter(el=>!el.matches('.ui-section'));
 if(leftovers.length){
  const details=document.createElement('details');details.className='ui-section';
  const summary=document.createElement('summary');summary.textContent='Other';details.append(summary);
  const grid=document.createElement('div');grid.className='form-grid';
  details.append(grid);leftovers.forEach(el=>grid.append(el));container.append(details);
 }
 container.addEventListener('invalid',event=>{
  const section=event.target.closest('.ui-section');if(section)section.open=true;
 },true);
}
