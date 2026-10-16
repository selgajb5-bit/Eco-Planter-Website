/* EcoPlanter website v1.0
 * Offline-friendly demo UI and optional ESP32 WebSocket bridge.
 * Camera image is NOT a live feed; see README.md for firmware contract.
 */
(()=>{
 'use strict';
 const $=(sel,root=document)=>root.querySelector(sel);
 const $$=(sel,root=document)=>Array.from(root.querySelectorAll(sel));
 const KEY='ecoplanter-site-v1';
 const initial={ moisture:34,seeds:24,waterEvents:3,battery:82, waterLevel:76,
  moistureHistory:[53,51,48,50,46,45,43,42,39,42,38,34],
  settings:{threshold:40,waterSeconds:3,spacing:15,seedsPerSpot:1},
  records:[
   {time:new Date(Date.now()-1000*60*4).toISOString(),event:'Demo initialized', detail:'Simulated planting system ready',source:'Demo'},
   {time:new Date(Date.now()-1000*60*16).toISOString(),event:'Moisture reading', detail:'Soil moisture at 34% (simulated)',source:'Demo'},
   {time:new Date(Date.now()-1000*60*33).toISOString(),event:'Seed dispensed',detail:'1 seed release recorded (simulated)',source:'Demo'},
   {time:new Date(Date.now()-1000*60*51).toISOString(),event:'Watering complete',detail:'3-second demo watering event',source:'Demo'}
  ]};
 let stored={};
 try{stored=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
 const state={
  moisture:validNumber(stored.moisture,34,0,100),seeds:validNumber(stored.seeds,24,0,100000),waterEvents:validNumber(stored.waterEvents,3,0,100000),battery:validNumber(stored.battery,82,0,100),waterLevel:76,
  moistureHistory:Array.isArray(stored.moistureHistory)?stored.moistureHistory.slice(-16).map(v=>validNumber(v,34,0,100)):initial.moistureHistory.slice(),
  settings:{...initial.settings,...(stored.settings||{})},records:Array.isArray(stored.records)?stored.records.slice(0,200):initial.records.slice(),
  mode:'demo',opmode:'automatic',running:false,step:0,status:'Ready for planting',detail:'The robot is idle and waiting for a command.',pump:false,probe:'Raised',seedArm:'Home',waterArm:'Home',emergency:false,
  socket:null,connectionUrl:String(stored.connectionUrl||''),lastMove:null
 };
 let cycleTimer=null,pumpTimer=null,toastTimer=null;
 const stepNames=['Align with planting location','Measure soil moisture','Position and release seed','Water if dry','Count and finish'];
 const time=(iso)=>new Date(iso).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
 function validNumber(v,backup,min,max){const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):backup;}
 function save(){try{localStorage.setItem(KEY,JSON.stringify({moisture:state.moisture,seeds:state.seeds,waterEvents:state.waterEvents,battery:state.battery,moistureHistory:state.moistureHistory,settings:state.settings,records:state.records,connectionUrl:state.connectionUrl}))}catch(e){}}
 function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3300)}
 function log(event,detail,source=state.mode==='hardware'?'Hardware':'Demo'){
  state.records.unshift({time:new Date().toISOString(),event,detail,source});state.records=state.records.slice(0,200);save();renderRecords();renderActivity();
 }
 function setStatus(title,detail){state.status=title;state.detail=detail;renderStatus()}
 function renderStatus(){
  $('#robotCurrentStatus').textContent=state.status;$('#robotCurrentDetail').textContent=state.detail;
  $('#driveState').textContent=state.lastMove|| (state.running?'Automatic cycle running':'Idle');
  $('#probePosition').textContent=state.probe;$('#seedPosition').textContent=state.seedArm;$('#waterPosition').textContent=state.pump?'Pump active':state.waterArm;
  $('#operatingModeText').textContent=state.opmode==='automatic'?'Automatic mode enabled':'Manual mode enabled';
  $('#operatingModeDetail').textContent=state.opmode==='automatic'?'Ready to follow the planting sequence.':'Direct controls are enabled.';
  $$('#cycleSegments span').forEach((el,i)=>el.classList.toggle('done',i<state.step));
  $('#cycleProgressLabel').textContent=`${state.step} / 5 stages`;
  $$('.mode-choice').forEach(el=>el.classList.toggle('active',el.dataset.opmode===state.opmode));
  $('#pumpState').textContent=state.pump?'Watering':'Standby';$('#waterFoot').textContent=state.pump?'Water pump activated':'Awaiting dry-soil check';
  $('#pumpPill').classList.toggle('on',state.pump);$('#pumpPill').innerHTML=`<i></i>${state.pump?'On':'Off'}`;
  $('#headStartButton').disabled=state.running||state.emergency;$('#quickStart').disabled=state.running||state.emergency;$('#controlStart').disabled=state.running||state.emergency;
  $$('[data-action], [data-move]').forEach(b=>{b.disabled=state.emergency});
 }
 function renderSummary(){
  $('#moistureNum').textContent=Math.round(state.moisture);$('#seedCount').textContent=state.seeds;$('#batteryNum').textContent=Math.round(state.battery);$('#batteryBar').style.width=`${state.battery}%`;
  const label=state.moisture<state.settings.threshold?'DRY SOIL':state.moisture>75?'WET SOIL':'GOOD MOISTURE';
  $('#moistureState').textContent=label;
  $('#moistureFoot').textContent=state.moisture<state.settings.threshold?'Below threshold':'No watering needed';
  $('#recordSeeds').textContent=state.seeds;$('#recordWater').textContent=state.waterEvents;$('#recordEvents').textContent=state.records.length;
  renderStatus();drawChart();
 }
 function drawChart(){
  const arr=state.moistureHistory.length>1?state.moistureHistory:[50,50];
  const points=arr.map((n,i)=>`${(i/(arr.length-1)*600).toFixed(1)},${(204-n*2.04).toFixed(1)}`);
  $('#chartLine').setAttribute('points',points.join(' '));
  $('#chartArea').setAttribute('d',`M0,204 L${points.join(' L')} L600,204 Z`);
 }
 function renderActivity(){const target=$('#activityList');target.replaceChildren();const records=state.records.slice(0,4);
  if(!records.length){target.textContent='No activity yet.';return}
  records.forEach(item=>{
   const wrapper=document.createElement('div');wrapper.className='activity-item';
   const ico=document.createElement('span');ico.className='activity-icon';ico.innerHTML='<svg class="icon"><use href="#i-clock"/></svg>';
   const content=document.createElement('div');content.className='activity-copy';
   const title=document.createElement('strong');title.textContent=item.event;const detail=document.createElement('p');detail.textContent=item.detail;
   content.append(title,detail);const when=document.createElement('time');when.className='activity-time';when.textContent=time(item.time);
   wrapper.append(ico,content,when);target.append(wrapper);
  });
 }
 function renderRecords(){const target=$('#recordsBody');target.replaceChildren();
  if(!state.records.length){const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=4;td.className='empty-table';td.textContent='No events recorded yet.';tr.append(td);target.append(tr)}
  state.records.forEach(item=>{const tr=document.createElement('tr');[new Date(item.time).toLocaleString(),item.event,item.detail,item.source].forEach(value=>{const cell=document.createElement('td');cell.textContent=value;tr.append(cell)});target.append(tr)})
  $('#recordEvents').textContent=state.records.length;
 }
 function renderConnection(){const live=state.mode==='hardware';
  $('#hardwareStatus').textContent=live?'Connected to ESP32 WebSocket':'Demo only — no real device connected';
  $('#sidebar-connection').textContent=live?'ESP32 connected':'Demo environment';
  $('#sidebar-connection-detail').textContent=live?'Hardware commands enabled':'No physical robot connected';
  $('#modeTag').textContent=live?'● HARDWARE CONNECTED':'● DEMO MODE';
  $('#controlsModeTag').textContent=live?'● HARDWARE CONNECTED':'● DEMO MODE';
  $('#connectButton').disabled=live;
 }
 function addMoisture(reading){state.moisture=validNumber(reading,state.moisture,0,100);state.moistureHistory.push(state.moisture);state.moistureHistory=state.moistureHistory.slice(-16);save();renderSummary()}
 function setPump(active){state.pump=active;renderStatus()}
 function canAct(){if(state.emergency){toast('Emergency stop active. Reset Demo Mode in Settings.');return false}return true}
 function sendHardware(command,params={}){if(state.mode!=='hardware'||!state.socket||state.socket.readyState!==WebSocket.OPEN){toast('No physical robot connected.');return false}
  try{state.socket.send(JSON.stringify({type:'command',command,...params}));return true}catch(e){toast('Unable to send the command.');return false}}
 function hardwareOrDemo(cmd,action){if(!canAct())return;if(state.mode==='hardware'){if(sendHardware(cmd)){log('Command sent',cmd,'Hardware')}}else{action()}}
 function finishDemoCycle(){state.running=false;state.step=5;state.seedArm='Home';state.waterArm='Home';state.probe='Raised';setStatus('Cycle completed','One simulated planting cycle finished.');log('Cycle completed',`Soil: ${Math.round(state.moisture)}%; seeds total: ${state.seeds}`);renderSummary();toast('Planting cycle completed')}
 function autoStep(){if(!state.running)return;
  const index=state.step;
  if(index>=5){clearInterval(cycleTimer);cycleTimer=null;finishDemoCycle();return}
  switch(index){
   case 0:setStatus('Aligning to planting spot','Positioning with calibrated reference markers.');log('Robot aligned',`Simulated ${state.settings.spacing} cm planting distance`);break;
   case 1:state.probe='Lowered';setStatus('Checking soil moisture',`Soil reading: ${Math.round(state.moisture)}%`);log('Soil moisture checked',`${Math.round(state.moisture)}% (simulated)`);break;
   case 2:state.probe='Raised';state.seedArm='Targeted';state.seeds+=state.settings.seedsPerSpot;setStatus('Dispensing seed',`${state.settings.seedsPerSpot} seed release command(s) simulated.`);log('Seed dispensed',`${state.settings.seedsPerSpot} release command(s); actual passage unverified`);break;
   case 3:state.seedArm='Home';state.waterArm='Targeted';if(state.moisture<state.settings.threshold){state.pump=true;state.waterEvents++;addMoisture(Math.min(100,state.moisture+6));setStatus('Watering the planting spot',`${state.settings.waterSeconds}-second simulated watering command.`);log('Watering activated',`${state.settings.waterSeconds} seconds (simulated)`)}else{state.pump=false;setStatus('Watering skipped','The moisture is above the dry-soil threshold.');log('Watering skipped','Soil moisture sufficient for configured threshold')}break;
   case 4:state.pump=false;state.waterArm='Home';state.battery=Math.max(0,state.battery-1);setStatus('Updating planting record','Finalizing simulated counter and activity.');log('Counter updated',`${state.seeds} total seed release commands`);break;
  }
  state.step++;save();renderSummary();
 }
 function startAuto(){if(!canAct()||state.running)return;if(state.opmode!=='automatic'){toast('Switch to Automatic Mode to start a cycle.');return}
  if(state.mode==='hardware'){if(sendHardware('start_auto')){state.running=true;state.step=0;setStatus('Start command sent','Waiting for ESP32 telemetry.');log('Automatic start requested','Command delivered to connected robot','Hardware')}return}
  state.running=true;state.step=0;log('Automatic cycle started','Demo simulation sequence');autoStep();cycleTimer=setInterval(autoStep,2200);toast('Simulated planting cycle started');
 }
 function stopMotion(){if(state.mode==='hardware'&&state.lastMove)sendHardware('stop_motion');state.lastMove=null;renderStatus()}
 function stopAction(){if(state.mode==='hardware'){sendHardware('stop');log('Stop requested','Stop command sent','Hardware')}clearInterval(cycleTimer);cycleTimer=null;clearTimeout(pumpTimer);pumpTimer=null;state.running=false;state.pump=false;state.lastMove=null;state.seedArm='Home';state.waterArm='Home';state.probe='Raised';setStatus('Stopped','Waiting for the next command.');renderSummary();toast('Action stopped')}
 function emergencyStop(){if(state.mode==='hardware')sendHardware('emergency_stop');clearInterval(cycleTimer);cycleTimer=null;clearTimeout(pumpTimer);pumpTimer=null;state.running=false;state.pump=false;state.lastMove=null;state.emergency=true;state.step=0;setStatus('EMERGENCY STOP','Controls locked. Physical hardware must implement its own safe shutdown.');log('Emergency stop','Local commands disabled; hardware stop requested');renderSummary();toast('Emergency stop activated')}
 function waterDemo(){if(!canAct()||state.running)return;if(state.mode==='hardware'){hardwareOrDemo('water_now',()=>{});return}
  clearTimeout(pumpTimer);state.waterArm='Targeted';setPump(true);state.waterEvents++;log('Manual watering',`Simulated watering for ${state.settings.waterSeconds} seconds`);setStatus('Watering selected spot','Pump active in demo simulation.');renderSummary();
  pumpTimer=setTimeout(()=>{state.pump=false;state.waterArm='Home';addMoisture(Math.min(100,state.moisture+6));setStatus('Watering finished','Watering simulation completed.');renderSummary()},state.settings.waterSeconds*1000);
 }
 function manualAction(name){if(!canAct())return;if(state.running){toast('Stop the running cycle first.');return}
  if(state.opmode!=='manual'){toast('Select Manual Mode to use arm controls.');return}
  if(state.mode==='hardware'){if(sendHardware(name))log('Arm command sent',name,'Hardware');return}
  if(name==='seed_position'){state.seedArm='Targeted';log('Seed arm positioned','Aiming at calibrated soil spot')}
  else if(name==='seed_drop'){state.seeds+=state.settings.seedsPerSpot;log('Seed dispensed',`${state.settings.seedsPerSpot} simulated release command(s)`)}
  else if(name==='water_position'){state.waterArm='Targeted';log('Water nozzle positioned','Aiming at selected soil spot')}
  else if(name==='water_now'){waterDemo();return}
  else if(name==='probe_raise'){state.probe='Raised';log('Soil probe raised','Sensor retracted')}
  else if(name==='probe_check'){state.probe='Lowered';log('Soil probe checked',`Simulated moisture ${state.moisture}%`)}
  save();renderSummary();toast('Demo command completed')
 }
 function move(direction){if(!canAct())return;if(state.opmode!=='manual'){toast('Select Manual Mode to drive.');return}if(state.running){toast('Stop the running cycle first.');return}
  state.lastMove=direction.toUpperCase();if(state.mode==='hardware'){sendHardware('move',{direction});return}
  log('Drive control',`Simulated movement: ${direction}`);renderStatus();toast(`Demo movement: ${direction}`);
 }
 function updateTheme(){const dark=document.body.classList.toggle('dark');$('#themeButton').innerHTML=dark?'<svg class="icon"><use href="#i-sun"/></svg>':'<svg class="icon"><use href="#i-moon"/></svg>';try{localStorage.setItem('ecoplanter-theme',dark?'dark':'light')}catch(e){}}
 function routeTo(name){const names=['home','dashboard','controls','records','settings','about'];if(!names.includes(name))name='dashboard';
  $$('.page').forEach(el=>el.classList.toggle('active',el.dataset.page===name));$$('.nav-link').forEach(el=>el.classList.toggle('selected',el.dataset.route===name));
  const labels={home:'Home',dashboard:'Dashboard',controls:'Robot Controls',records:'Planting Records',settings:'Settings',about:'About EcoPlanter'};
  $('#breadcrumbName').textContent=labels[name];document.title=`${labels[name]} | EcoPlanter`;$('#sidebar').classList.remove('open');$('#mobileBackdrop').hidden=true;
  window.scrollTo({top:0,behavior:'instant'});
 }
 function renderSettings(){$('#thresholdRange').value=state.settings.threshold;$('#thresholdValue').textContent=state.settings.threshold+'%';
  $('#wateringRange').value=state.settings.waterSeconds;$('#wateringValue').textContent=state.settings.waterSeconds+'s';
  $('#spacingInput').value=String(state.settings.spacing);$('#seedsInput').value=String(state.settings.seedsPerSpot);$('#wsUrl').value=state.connectionUrl;
 }
 function connectHardware(){if(state.mode==='hardware')return;const address=$('#wsUrl').value.trim();if(!/^wss?:\/\//i.test(address)){toast('Enter a valid ws:// or wss:// address.');return}
  if(location.protocol==='https:'&&address.startsWith('ws://')){toast('HTTPS pages usually require wss:// hardware connections.');return}
  state.connectionUrl=address;save();let socket;try{socket=new WebSocket(address)}catch(e){toast('WebSocket address is not valid.');return}
  $('#hardwareStatus').textContent='Connecting…';state.socket=socket;
  socket.onopen=()=>{if(state.socket!==socket)return;state.mode='hardware';state.emergency=false;state.running=false;clearInterval(cycleTimer);cycleTimer=null;setStatus('Hardware connected','Waiting for live telemetry from your ESP32.');renderConnection();log('ESP32 connected',address,'Hardware');toast('Connected to ESP32 WebSocket')};
  socket.onmessage=(event)=>{try{const data=JSON.parse(event.data);if(data.type!=='telemetry')return;
    if(typeof data.moisture==='number')addMoisture(data.moisture);
    if(typeof data.seeds_dispensed==='number')state.seeds=validNumber(data.seeds_dispensed,state.seeds,0,1e7);
    if(typeof data.battery_pct==='number')state.battery=validNumber(data.battery_pct,state.battery,0,100);
    if(typeof data.pump_on==='boolean')state.pump=data.pump_on;
    if(typeof data.running==='boolean')state.running=data.running;
    if(typeof data.step==='number')state.step=validNumber(data.step,state.step,0,5);
    if(typeof data.status==='string')setStatus(data.status.slice(0,80),'Live ESP32 telemetry');
    if(typeof data.estop==='boolean')state.emergency=data.estop;
    save();renderSummary();
   }catch(e){}}
  socket.onerror=()=>{if(socket.readyState!==WebSocket.OPEN)toast('Connection failed. Check the ESP32 firmware and address.')};
  socket.onclose=()=>{if(state.socket!==socket)return;state.mode='demo';state.socket=null;state.running=false;state.lastMove=null;state.pump=false;state.step=0;setStatus('Disconnected','Hardware link lost. The robot must have an onboard stop failsafe.');renderConnection();renderSummary();log('Hardware disconnected','Switched back to Demo Mode','Demo');toast('ESP32 disconnected — returned to Demo Mode')};
 }
 function disconnect(){if(state.socket){const old=state.socket;state.socket=null;old.close()}state.mode='demo';state.running=false;state.pump=false;state.lastMove=null;state.emergency=false;setStatus('Ready for planting','Demo Mode active. No real robot connected.');renderConnection();renderSummary();toast('Returned to Demo Mode')}
 function exportCsv(){const rows=[['Timestamp','Event','Details','Source'],...state.records.map(i=>[i.time,i.event,i.detail,i.source])];const body=rows.map(row=>row.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\r\n');
  const blob=new Blob(['\ufeff'+body],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='EcoPlanter_planting_records.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('CSV records downloaded')}
 function resetDemo(){if(state.mode==='hardware'){toast('Disconnect hardware before resetting demo.');return}
  clearInterval(cycleTimer);clearTimeout(pumpTimer);state.running=false;state.step=0;state.pump=false;state.emergency=false;state.probe='Raised';state.seedArm='Home';state.waterArm='Home';state.seeds=24;state.waterEvents=3;state.battery=82;state.moisture=34;state.moistureHistory=initial.moistureHistory.slice();state.records=initial.records.slice();setStatus('Ready for planting','Demo reset to starting values.');save();renderAll();toast('Demo data reset')}
 function renderAll(){renderSettings();renderConnection();renderSummary();renderRecords();renderActivity()}
 function bind(){
  $$('[data-route]').forEach(el=>el.addEventListener('click',evt=>{evt.preventDefault();const name=el.dataset.route;if(location.hash!==`#${name}`)location.hash=name;else routeTo(name)}));
  window.addEventListener('hashchange',()=>routeTo(location.hash.slice(1)));
  $('#menuButton').addEventListener('click',()=>{$('#sidebar').classList.add('open');$('#mobileBackdrop').hidden=false});
  $('#mobileBackdrop').addEventListener('click',()=>{$('#sidebar').classList.remove('open');$('#mobileBackdrop').hidden=true});
  $('#themeButton').addEventListener('click',updateTheme);
  $('#headStartButton').addEventListener('click',startAuto);$('#quickStart').addEventListener('click',startAuto);$('#controlStart').addEventListener('click',startAuto);$('#controlStop').addEventListener('click',stopAction);$('#emergencyStop').addEventListener('click',emergencyStop);
  $('#quickWater').addEventListener('click',()=>hardwareOrDemo('water_now',waterDemo));
  $$('.mode-choice').forEach(el=>el.addEventListener('click',()=>{if(state.running){toast('Stop the current cycle before changing modes.');return}state.opmode=el.dataset.opmode;if(state.mode==='hardware')sendHardware('set_mode',{mode:state.opmode});renderStatus();toast(`${state.opmode==='manual'?'Manual':'Automatic'} mode selected`)}));
  $$('[data-action]').forEach(el=>el.addEventListener('click',()=>manualAction(el.dataset.action)));
  $$('[data-move]').forEach(el=>{
   el.addEventListener('pointerdown',evt=>{evt.preventDefault();el.setPointerCapture(evt.pointerId);el.classList.add('held');move(el.dataset.move)});
   ['pointerup','pointercancel','lostpointercapture'].forEach(name=>el.addEventListener(name,()=>{el.classList.remove('held');stopMotion()}));
  });
  $('#pivotLeft').addEventListener('click',()=>{move('pivot_left');stopMotion()});$('#pivotRight').addEventListener('click',()=>{move('pivot_right');stopMotion()});
  $('#exportCsv').addEventListener('click',exportCsv);
  $('#clearRecords').addEventListener('click',()=>{if(!confirm('Clear the saved activity history in this browser?'))return;state.records=[];save();renderRecords();renderActivity();toast('Activity history cleared')});
  $('#thresholdRange').addEventListener('input',e=>$('#thresholdValue').textContent=e.target.value+'%');
  $('#wateringRange').addEventListener('input',e=>$('#wateringValue').textContent=e.target.value+'s');
  $('#saveSettings').addEventListener('click',()=>{state.settings.threshold=validNumber($('#thresholdRange').value,40,15,75);state.settings.waterSeconds=validNumber($('#wateringRange').value,3,1,10);state.settings.spacing=Number($('#spacingInput').value);state.settings.seedsPerSpot=Number($('#seedsInput').value);save();renderSummary();log('Settings updated','Planting preferences saved in browser');toast('Settings saved')});
  $('#connectButton').addEventListener('click',connectHardware);$('#disconnectButton').addEventListener('click',disconnect);
  $('#applyMoisture').addEventListener('click',()=>{if(state.mode==='hardware'){toast('Demo readings unavailable while hardware is connected.');return}addMoisture(Number($('#demoMoisture').value));log('Demo soil changed',`Reading set to ${state.moisture}%`);toast(`Simulated soil moisture: ${state.moisture}%`)});
  $('#resetDemo').addEventListener('click',resetDemo);
 }
 function clocks(){const now=new Date();$('#currentTime').textContent=now.toLocaleDateString([], {month:'short',day:'numeric',year:'numeric'});$('#cameraClock').textContent=now.toLocaleTimeString([]);$('#greeting').textContent=now.getHours()<12?'morning':now.getHours()<17?'afternoon':'evening'}
 function init(){
  let savedTheme='light';try{savedTheme=localStorage.getItem('ecoplanter-theme')||'light'}catch(e){};if(savedTheme==='dark'){document.body.classList.add('dark');$('#themeButton').innerHTML='<svg class="icon"><use href="#i-sun"/></svg>'}
  $('#year').textContent=new Date().getFullYear();bind();renderAll();routeTo(location.hash.slice(1)||'dashboard');clocks();setInterval(clocks,1000);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
