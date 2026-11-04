  document.addEventListener('click', async e => {
    const button = (e.target as Element).closest<HTMLButtonElement>('[data-copy-email], [data-copy-text]');
    if(!button) return;
    const status=button.parentElement?.querySelector('[data-copy-status]');
    try { await navigator.clipboard.writeText(button.dataset.copyEmail || button.dataset.copyText || ''); if(status)status.textContent='Копирано!';setTimeout(()=>{if(status)status.textContent='';},2500); }
    catch { if(status)status.textContent='Копирай текста ръчно.'; }
  });
