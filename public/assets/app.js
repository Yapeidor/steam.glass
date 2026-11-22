const pages=[...document.querySelectorAll('.wizard-page')];
  const dots=[...document.querySelectorAll('.stepdot')];
  const fill=document.getElementById('progressFill');
  const win=document.getElementById('appWindow');
  const drag=document.getElementById('dragBar');
  const desktop=document.getElementById('desktop');
  let current=0,maximized=false,previousRect=null,updateStarted=false,updateReady=false,downloadOpened=false,installStarted=false,installComplete=false;
  let releaseInfo=null,dragging=false,dragOffsetX=0,dragOffsetY=0,lastGhostAt=0,lastDragX=0,lastDragY=0;
  function showPage(n) {
    current=Math.max(0,Math.min(4,n));
    pages.forEach((page,i)=>page.classList.toggle('active',i===current));
    dots.forEach((dot,i)=>dot.classList.toggle('active',i===current));
    fill.style.width=((current+1)*20)+'%';
    document.getElementById('mainScroll').scrollTop=0;
    if(current===2&&!updateStarted)startUpdateSequence();
    if(current===3&&!installStarted)startInstallSequence();
  }
  document.querySelectorAll('.wizard-page[data-page="0"] .next').forEach(button=>button.addEventListener('click',()=>showPage(1)));
  document.querySelector('.wizard-page[data-page="1"] .next').addEventListener('click',()=>showPage(2));
  document.getElementById('back1').onclick=()=>showPage(0);
  document.getElementById('back2').onclick=()=>showPage(1);
  document.getElementById('back3').onclick=()=> {
    if(!installStarted)showPage(2)
  };
  document.getElementById('restart').onclick=()=> {
    updateStarted=false;
    updateReady=false;
    downloadOpened=false;
    installStarted=false;
    installComplete=false;
    document.getElementById('downloadProgress').style.width='0%';
    document.getElementById('installProgress').style.width='0%';
    document.getElementById('toInstall').disabled=true;
    document.getElementById('finishInstall').disabled=true;
    document.getElementById('downloadRelease').disabled=!releaseInfo;
    document.getElementById('downloadRelease').textContent='↓ Download update';
    showPage(0);
  };
  document.getElementById('finishInstall').onclick=()=> {
    if(installComplete)showPage(4)
  };
  // Classic GNOME panel actions and panel clock.
  const taskWindowButton=document.getElementById('taskWindowButton');
  const applicationsButton=document.getElementById('applicationsButton');
  const systemButton=document.getElementById('systemButton');
  const panelClock=document.getElementById('panelClock');
  const serverIndicator=document.getElementById('serverIndicator');
  const systemPopover=document.getElementById('systemPopover');
  const systemInfoContent=document.getElementById('systemInfoContent');

  function openSetupWindow() {
    win.style.display='flex';
    win.classList.remove('is-minimized');
    win.style.height='min(650px, calc(100vh - 96px))';
    win.style.minHeight='420px';
    win.querySelector('main').style.display='flex';
    const shortcut=document.querySelector('.desktop-shortcut');
    if(shortcut)shortcut.remove();
  }

  taskWindowButton.addEventListener('click',openSetupWindow);
  applicationsButton.addEventListener('click',openSetupWindow);
  async function loadSystemInfo() {
    systemInfoContent.textContent='Reading host information…';
    try {
      const response=await fetch('/api/system', {cache:'no-store'});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const info=await response.json();
      const uptimeHours=Math.floor(info.uptimeSeconds/3600);
      const uptimeMinutes=Math.floor((info.uptimeSeconds%3600)/60);
      const lines=[
        'STEAMGLASS SYSTEM MONITOR',
        '-------------------------',
        'STATUS:      ONLINE',
        'RUNTIME:     '+info.nodeVersion,
        'PLATFORM:    '+info.platform+' / '+info.arch,
        'UPTIME:      '+uptimeHours+'h '+uptimeMinutes+'m',
        'HOST MEMORY: '+info.hostMemory.usedMb+' MB / '+info.hostMemory.totalMb+' MB',
        'APP MEMORY:  '+info.processMemory.rssMb+' MB RSS',
        'LOAD AVG:    '+info.loadAverage.join(' / '),
        '',
        'Server time: '+new Date(info.timestamp).toLocaleString()
      ];
      systemInfoContent.textContent=lines.join('\n');
    }
    catch(error) {
      systemInfoContent.textContent='BACKEND OFFLINE\n\nCould not read /api/system.\n'+error.message;
    }
  }

  systemButton.addEventListener('click',()=>{
    systemPopover.hidden=!systemPopover.hidden;
    if(!systemPopover.hidden)loadSystemInfo();
  });
  document.getElementById('closeSystemPopover').addEventListener('click',()=>{
    systemPopover.hidden=true;
  });
  document.getElementById('refreshSystemInfo').addEventListener('click',loadSystemInfo);

  async function checkServerHealth() {
    try {
      const response=await fetch('/api/health', {cache:'no-store'});
      if(!response.ok)throw new Error('Server returned '+response.status);
      serverIndicator.classList.add('online');
      serverIndicator.classList.remove('offline');
      serverIndicator.title='SteamGlass backend online';
    }
    catch(error) {
      serverIndicator.classList.add('offline');
      serverIndicator.classList.remove('online');
      serverIndicator.title='SteamGlass backend unavailable';
    }
  }
  checkServerHealth();
  window.setInterval(checkServerHealth,60000);

  function updatePanelClock() {
    const now=new Date();
    panelClock.textContent=now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  }
  updatePanelClock();
  window.setInterval(updatePanelClock,30000);

  // Latest release metadata is fetched from the official GitLab API.
  const GITLAB_RELEASE_API='https://gitlab.com/api/v4/projects/justiex%2Fsteamglass/releases/permalink/latest';
  const RELEASES_URL='https://gitlab.com/justiex/steamglass/-/releases';
  const releaseStatus=document.getElementById('releaseStatus');
  const downloadLatest=document.getElementById('downloadLatest');
  const downloadRelease=document.getElementById('downloadRelease');
  function findReleaseAsset(release) {
    const links=(release&&release.assets&&release.assets.links)?release.assets.links:[];
    const selectedFormat=document.getElementById('installType')?.selectedIndex||0;
    const packageAsset=links.find(a=>/\.pkg\.tar\.zst(?:$|\?)/i.test((a.name||'')+' '+(a.url||'')));
    const archiveAsset=links.find(a=>/\.tar\.gz(?:$|\?)/i.test((a.name||'')+' '+(a.url||'')));
    return selectedFormat===0?(packageAsset||archiveAsset):(archiveAsset||packageAsset);
  }
  function releaseDownloadUrl() {
    if(!releaseInfo)return RELEASES_URL;
    const asset=findReleaseAsset(releaseInfo);
    return asset?(asset.direct_asset_url||asset.url):'https://gitlab.com/justiex/steamglass/-/archive/'+encodeURIComponent(releaseInfo.tag_name)+'/steamglass-'+encodeURIComponent(releaseInfo.tag_name)+'.tar.gz';
  }
  async function fetchLatestRelease() {
    releaseStatus.textContent='Contacting GitLab…';
    try {
      const response=await fetch(GITLAB_RELEASE_API, {
        headers: {
          'Accept':'application/json'
        },cache:'no-store'
      });
      if(!response.ok)throw new Error('GitLab returned HTTP '+response.status);
      const data=await response.json();
      if(!data||!data.tag_name)throw new Error('No release tag was returned');
      releaseInfo=data;
      const asset=findReleaseAsset(data);
      releaseStatus.textContent='Latest release: '+data.tag_name+' — '+(asset?'download is ready':'source archive is available');
      downloadLatest.disabled=false;
      downloadRelease.disabled=false;
      return data;
    }
    catch(error) {
      releaseStatus.textContent='Could not check GitLab: '+error.message+'. You can still browse the official release archive.';
      downloadLatest.disabled=false;
      downloadRelease.disabled=false;
      return null;
    }
  }
  function openOfficialDownload() {
    const url=releaseDownloadUrl();
    const link=document.createElement('a');
    link.href=url;
    link.target='_blank';
    link.rel='noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
    downloadOpened=true;
    document.getElementById('toInstall').disabled=false;
    document.getElementById('updateStatus').textContent='Download link opened in a new tab. Press Next to continue to the installation demo.';
    document.getElementById('updateConsole').textContent+='\n[UPDATE] Download link opened: '+(releaseInfo?releaseInfo.tag_name:'official releases');
    downloadRelease.textContent='↻ Open download again';
  }
  downloadLatest.addEventListener('click',()=>openOfficialDownload());
  downloadRelease.addEventListener('click',()=>openOfficialDownload());
  document.getElementById('openReleases').onclick=()=>window.open(RELEASES_URL,'_blank','noopener');
  async function startUpdateSequence() {
    updateStarted=true;
    const bar=document.getElementById('downloadProgress');
    const state=document.getElementById('updateStatus');
    const log=document.getElementById('updateConsole');
    const stages=[
    ['Initializing update service…','[UPDATE] Initializing update service…'],
    ['Connecting to GitLab…','[NETWORK] Establishing secure connection…'],
    ['Reading release information…','[MANIFEST] Reading latest release metadata…'],
    ['Preparing package link…','[PACKAGE] Preparing download link…']
    ];
    state.textContent='Checking for updates…';
    for(let i=0;i<stages.length;i++) {
      state.textContent=stages[i][0];
      log.textContent+='\n'+stages[i][1];
      bar.style.width=((i+1)*18)+'%';
      await new Promise(resolve=>setTimeout(resolve,420+Math.random()*380));
    }
    if(!releaseInfo)await fetchLatestRelease();
    for(let i=5;i<=10;i++) {
      bar.style.width=(i*10)+'%';
      log.textContent+='\n[UPDATE] '+(i===10?'Release check complete.':'Verifying release channel… '+(i*10)+'%');
      await new Promise(resolve=>setTimeout(resolve,230+Math.random()*210));
    }
    updateReady=true;
    downloadRelease.disabled=false;
    document.getElementById('openReleases').disabled=false;
    state.textContent=releaseInfo?'Update check complete — '+releaseInfo.tag_name+' is ready.':'Release server unavailable — open the official release archive instead.';
    log.textContent+='\n[OK] Update check finished.';
    document.getElementById('toInstall').disabled=!downloadOpened;
  }
  async function startInstallSequence() {
    installStarted=true;
    const bar=document.getElementById('installProgress');
    const log=document.getElementById('installConsole');
    const state=document.getElementById('installStatus');
    const button=document.getElementById('finishInstall');
    button.disabled=true;
    const tasks=[
    ['Preparing installation environment…','[SETUP] Preparing installation environment…'],
    ['Checking package structure…','[CHECK] Verifying package structure…'],
    ['Extracting theme files…','[FILES] Extracting theme files…'],
    ['Registering SteamGlass components…','[CONFIG] Registering components…'],
    ['Refreshing desktop entries…','[DESKTOP] Refreshing application entries…'],
    ['Finalizing setup…','[FINAL] Finalizing installation sequence…']
    ];
    log.textContent='[SETUP] Starting SteamGlass setup…';
    for(let i=0;i<tasks.length;i++) {
      state.textContent=tasks[i][0];
      log.textContent+='\n'+tasks[i][1];
      // Deliberately uneven, old-computer-style pacing for the retro update feel.
      const target=Math.round(((i+1)/tasks.length)*100);
      for(let p=Math.round((i/tasks.length)*100)+1;p<=target;p+=5) {
        bar.style.width=Math.min(p,target)+'%';
        await new Promise(resolve=>setTimeout(resolve,90+Math.random()*100));
      }
      await new Promise(resolve=>setTimeout(resolve,260+Math.random()*340));
    }
    installComplete=true;
    state.textContent='Setup sequence complete. No system files were changed.';
    log.textContent+='\n[OK] Demo setup complete.\n[INFO] No system files were changed by this browser demo.';
    button.disabled=false;
  }
  document.getElementById('toInstall').onclick=()=> {
    if(downloadOpened)showPage(3)
  };
  // Classic window controls.
  document.getElementById('maxBtn').onclick=()=> {
    if(!maximized) {
      previousRect= {
        width:win.style.width,height:win.style.height,left:win.style.left,top:win.style.top,position:win.style.position,margin:win.style.margin
      };
      win.style.position='relative';
      win.style.left='';
      win.style.top='';
      win.style.width='calc(100vw - 32px)';
      win.style.height='calc(100vh - 90px)';
      win.style.margin='0 auto';
      maximized=true;
    }
    else {
      win.style.width=previousRect?.width||'min(760px, calc(100vw - 32px))';
      win.style.height=previousRect?.height||'min(650px, calc(100vh - 96px))';
      win.style.position=previousRect?.position||'relative';
      win.style.left=previousRect?.left||'';
      win.style.top=previousRect?.top||'';
      win.style.margin=previousRect?.margin||'0 auto';
      maximized=false;
    }
  };
  document.getElementById('minBtn').onclick=()=> {
    const minimized=win.classList.toggle('is-minimized');
    if(minimized) {
      win.style.height='34px';
      win.style.minHeight='34px';
      win.querySelector('main').style.display='none';
    }
    else {
      win.style.height='min(650px, calc(100vh - 96px))';
      win.style.minHeight='420px';
      win.querySelector('main').style.display='flex';
    }
  };
  document.getElementById('closeBtn').onclick=()=> {
    win.style.display='none';

    const shortcuts=document.getElementById('desktopShortcuts');
    if (shortcuts.querySelector('.desktop-shortcut')) return;

    const reopen=document.createElement('button');
    reopen.type='button';
    reopen.className='desktop-shortcut';
    reopen.setAttribute('aria-label', 'Open SteamGlass Setup');
    reopen.title='Open SteamGlass Setup';

    const icon=document.createElement('img');
    icon.src='assets/firefox-2004.png';
    icon.alt='';
    icon.draggable=false;

    const label=document.createElement('span');
    label.textContent='SteamGlass Setup';

    reopen.append(icon, label);
    reopen.onclick=()=> {
      openSetupWindow();
      reopen.remove();
    };

    shortcuts.appendChild(reopen);
  };
  // DOS-inspired dragging: pixel-step movement and a long monochrome afterimage trail.
  function addGhost(rect) {
    const ghost=document.createElement('div');
    ghost.className='dos-ghost';
    ghost.style.left=rect.left+'px';
    ghost.style.top=rect.top+'px';
    ghost.style.width=rect.width+'px';
    ghost.style.height=rect.height+'px';
    desktop.appendChild(ghost);
    window.setTimeout(() => ghost.remove(), 900);
  }
  drag.addEventListener('pointerdown',event=> {
    if(event.target.closest('button')||maximized)return;
    dragging=true;
    document.body.classList.add('is-dragging');
    const rect=win.getBoundingClientRect();
    dragOffsetX=event.clientX-rect.left;
    dragOffsetY=event.clientY-rect.top;
    lastDragX=rect.left;
    lastDragY=rect.top;
    lastGhostAt=0;
    win.style.position='fixed';
    win.style.margin='0';
    win.style.left=rect.left+'px';
    win.style.top=rect.top+'px';
    drag.setPointerCapture(event.pointerId);
  });
  drag.addEventListener('pointermove',event=> {
    if(!dragging)return;
    const rawX=event.clientX-dragOffsetX,rawY=event.clientY-dragOffsetY;
    const maxX=Math.max(0,window.innerWidth-win.offsetWidth),maxY=Math.max(0,window.innerHeight-32);
    const x=Math.max(0,Math.min(maxX,Math.round(rawX/4)*4));
    const y=Math.max(0,Math.min(maxY,Math.round(rawY/4)*4));
    const now=performance.now();
    if(now-lastGhostAt>34&&(Math.abs(x-lastDragX)+Math.abs(y-lastDragY)>3)) {
      addGhost( {
        left:lastDragX,top:lastDragY,width:win.offsetWidth,height:win.offsetHeight
      });
      lastGhostAt=now;
      lastDragX=x;
      lastDragY=y;
    }
    win.style.left=x+'px';
    win.style.top=y+'px';
  });
  function stopDragging() {
    dragging=false;
    document.body.classList.remove('is-dragging')
  }
  drag.addEventListener('pointerup',stopDragging);
  drag.addEventListener('pointercancel',stopDragging);
  window.addEventListener('blur',stopDragging);
  // Slightly uneven scroll response, like an old CRT browser repaint.
  const scroller=document.getElementById('mainScroll');
  let scrollTimer=0;
  scroller.addEventListener('scroll',()=> {
    if(scrollTimer)return;
    scrollTimer=window.setTimeout(()=> {
      scroller.style.transform='translateX(1px)';
      requestAnimationFrame(()=> {
        scroller.style.transform='translateX(0)'
      });
      scrollTimer=0;
    },55);
  }, {
    passive:true
  });
  fetchLatestRelease();
