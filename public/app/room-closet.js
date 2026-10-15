import { sync, room } from './services.js?v=4.29';
import { $, esc } from './format.js?v=4.29';
import { openDialog, closeDialog, safe, toast } from './ui.js?v=4.29';

const outfits = [
  ['bandanna', 'Blue bandanna', '/photos/winnie-room-v3.png'],
  ['harness', 'Adventure harness', '/photos/winnie-harness-v2.png'],
  ['stripes', 'Striped shirt', '/photos/winnie-stripes-v2.png'],
];

export function openCloset() {
  const current=sync.view().profile.roomOutfit || 'bandanna';
  openDialog(`<h2 id="dialog-title">Winnie's closet</h2><p>Pick his outfit.</p><div class="closet-outfits">${outfits.map(([id,name,src])=>`<button class="closet-outfit" data-outfit="${id}" aria-pressed="${id===current}"><span class="outfit-preview" aria-hidden="true" style="background-image:url('${src}')"></span><strong>${esc(name)}</strong><span>${id===current ? 'Wearing now' : 'Wear this'}</span></button>`).join('')}</div><p class="fine closet-note">His harness comes on for bathroom trips. Then he returns to your pick.</p><p id="form-error" class="error" role="alert"></p>`);
  document.querySelectorAll('[data-outfit]').forEach(button=>button.onclick=safe(async()=>{
    const choice=button.dataset.outfit;
    if(choice===current) { closeDialog(); return; }
    const buttons=[...document.querySelectorAll('[data-outfit]')];
    buttons.forEach(b=>b.disabled=true);
    try {
      await sync.enqueue('profile',null,{roomOutfit:choice});
      room.set({outfit:choice});
      closeDialog();
      toast(`${outfits.find(([id])=>id===choice)[1]} on.`,null);
    } finally { buttons.forEach(b=>b.disabled=false); }
  }));
  $('dialog-content').scrollTop=0;
}
