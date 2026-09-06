// Cosmos — cœur métier (aucune UI). Règles de statut, projection, dates, migration, données d'exemple, modèles.
// Utilisé par Cosmos.dc.html ; réutilisable tel quel côté serveur ou dans une autre interface.
const COLORS = ['#818cf8','#34d399','#fbbf24','#fb7185','#22d3ee','#c084fc','#f472b6','#a3e635','#fb923c','#a1a1aa'];
// statut calculé : Clôturé (manuel) > Pause (manuel) > SAS (champ SAS rempli, non franchi) > Actif
const STATUTS = ['SAS','Actif','Pause','Clôturé'];
const STATUT_STYLE = {
  'SAS':['#818cf8','rgba(99,102,241,0.12)'],
  'Actif':['#34d399','rgba(16,185,129,0.1)'],
  'Pause':['#d4a054','rgba(212,160,84,0.12)'],
  'Clôturé':['#71717a','rgba(113,113,122,0.12)']
};
const hasSas = x => !!(x.sas&&x.sas.trim()&&x.sas!=='—');
// SAS daté : sasUntil (AAAA-MM-JJ) = fin du test d'entrée ; un SAS non franchi vit au rythme de cette date
const sasUntilOf = x => /^\d{4}-\d{2}-\d{2}$/.test(x.sasUntil||'')?x.sasUntil:null;
const sasPendingOf = x => hasSas(x)&&!x.sasDone;
// poids : vital > important > normal (défaut). Structurel, pas un état : il ordonne et hiérarchise, il ne colore pas.
const POIDS = ['vital','important','normal'];
const POIDS_LABEL = {vital:'Vital',important:'Important',normal:'Normal'};
const POIDS_ORDER = {vital:0,important:1,normal:2};
const poidsOf = x => POIDS.includes(x.poids)?x.poids:'normal';
// point devant le nom : plein et lumineux (vital), atténué (important), creux discret (normal)
const POIDS_DOT = {vital:{bg:'#fafafa',border:'#fafafa',glow:'0 0 6px rgba(250,250,250,0.55)'},important:{bg:'#71717a',border:'#71717a',glow:'none'},normal:{bg:'transparent',border:'#3f3f46',glow:'none'}};
const startOf = x => /^\d{4}-\d{2}-\d{2}$/.test(x.startAt||'')?x.startAt:(x.createdAt||null);
const notStarted = x => { const s=startOf(x); return !!s && s>isoD(TODAY); };
const statutOf = x => x.closed?'Clôturé':(x.pause||notStarted(x))?'Pause':(hasSas(x)&&!x.sasDone)?'SAS':'Actif';
// migration des anciens statuts manuels (Draft/Actif/Pause/Clôturé) vers les drapeaux pause / closed
const migrate = rows => rows.map(x=>{ const y={...x}; delete y.tags; if(y.pause==null) y.pause=x.statut==='Pause'; if(y.closed==null) y.closed=x.statut==='Clôturé'; if(y.sasDone==null) y.sasDone=false;
  if(sasPendingOf(y)&&!sasUntilOf(y)) y.sasUntil=inferSasUntil(y);
  if(!y.cloture||y.cloture==='Permanent'||y.cloture==='À dater') y.cloture=mandatDepuis(startOf(y)||y.createdAt); return y; });
// steps: [texte, fait]. Les champs etat/maintenance sont conservés dans les données d'exemple mais ne sont plus utilisés.
const r = (cosmos,name,objectif,sas,maintenance,entropie,alerte,kill,etat,statut,cloture,steps) =>
  ({cosmos,name,objectif,sas,maintenance,entropie,alerte,kill,etat,statut,cloture,actions:steps.map(([text,done])=>({text,done:!!done}))});
const SEED = [
  r('ENTREPRISE','Projet A','50 k€','—','Revue Ads (15 min/j)','Usure créations → Rotation visuels','< 4 000 € j25','< 3 000 € j25','stable','Actif','2026-12-31',[['Valider offre',1],['Créer page de vente',1],['Préparer 3 visuels',1],['Lancer campagne ads',0],['Atteindre 50 k€',0]]),
  r('ENTREPRISE','Projet B','30 k€','—','Analyse conv (15 min/j)','Fatigue mentale → Coucher 23h','< 50 cmd 15/11','< 40 cmd 30/11','derive','Draft','30 nov',[['Mettre en ligne',1],['Premières 10 commandes',1],['Analyser CPA',0],['Revoir landing page',0],['Atteindre 30 k€',0]]),
  r('ENTREPRISE','Trésorerie','50 k€','—','Vérif hebdo (30 min/sem)','Variations marché → Réserve 6 mois','< 35 k€ 15/11','< 30 k€ 30/11','danger','Actif','30 nov',[['Ouvrir compte réserve',1],['Automatiser vérif hebdo',1],['Relancer factures impayées',1],['Couper dépenses',0]]),
  r('ENTREPRISE','Équipe','3 recrutements','—','1 point/sem (30 min)','Conflits internes → Communication claire','1 conflit/mois','2 conflits/mois','stable','Actif','2026-12-31',[['Définir 3 fiches de poste',1],['Recruter n°1',1],['Recruter n°2',1],['Poster offre n°3',0],['Recruter n°3',0]]),
  r('ENTREPRISE','Pinterest Ads','CPA < 14 €','14 jours (CPA < 14 €)','Création 3 visuels/sem','Lancement concurrent → Différenciation','—','—','stable','Draft','30/09',[['Créer compte Ads',1],['Installer tracking',1],['Lancer 1re campagne',1],['Tester 3 créations',0],['Valider CPA < 14 €',0]]),
  r('FAMILLE','Enfants','1h/jour','—','1h présence non négociable','Fatigue parentale → Délégation','0h/1 sem','0h/3 sem','stable','Actif','Permanent',[['Bloquer 18h–19h agenda',1],['Couper notifications',1],['Rituel du soir',1],['Activité samedi',0]]),
  r('FAMILLE','Sport Léon','Natation','2 mois (30/11)','—','Désintérêt enfant → Observation','—','—','stable','Draft','30/11',[['Inscrire essai',0],['Observer 4 séances',0],['Décider inscription annuelle',0]]),
  r('FAMILLE','Couple','2h/semaine','—','1 date/semaine','Routine → Variété','0/2 sem','0/1 mois','stable','Actif','Permanent',[['Trouver babysitter',1],['Liste de 10 idées',1],['Date night vendredi',0],['Week-end à deux',0],['Bilan mensuel',0]]),
  r('FAMILLE','Maison','Propre et fonctionnelle','14 jours (20 min/j)','30 min rangement/jour','Accumulation → 30 min/jour','Désordre 1j','Désordre 3j','stable','Draft','15/09',[['Trier entrée',1],['Trier cuisine',1],['Rangement soir',0],['Trier chambre',0]]),
  r('FAMILLE','Vacances ski','1 sem/février','—','Réservation avant 1er déc','Prix élevé → Budget anticipation','Pas validé 1/12','Pas validé 15/12','derive','Draft','15/12',[['Fixer dates',1],['Réserver hébergement',0],['Réserver transport',0],['Louer matériel',0]]),
  r('FAMILLE','Scolarité','1 réunion/période','—','1 réunion/période','Manque de suivi → Agenda partagé','1 alerte/mois','2 alertes/mois','stable','Actif','Année scolaire',[['Créer agenda partagé',1],['Réunion période 1',1],['Contacter prof',0],['Réunion période 2',0],['Réunion période 3',0]]),
  r('RELATIONS','Amitiés','1 sortie/mois','—','1 appel/semaine','Éloignement → 1 sortie/mois','0/1 mois','0/3 mois','stable','Actif','Permanent',[['Lister 5 amis proches',1],['Appeler Thomas',0],['Sortie du mois',0]]),
  r('RELATIONS','Vie sociale','1 sortie/sem','—','1 invitation/mois','Isolement → Accepter invitations','0/1 mois','0/2 mois','stable','Actif','Permanent',[['Accepter 1 invitation',1],['Organiser dîner',0],['Rejoindre un club',0],['Sortie hebdo',0],['Bilan trimestriel',0]]),
  r('RELATIONS','Mentors','1 rencontre/trim','—','Préparer questions','Manque préparation → Préparer questions','0/3 mois','0/6 mois','stable','Actif','Permanent',[['Identifier 2 mentors',1],['Premier contact',1],['Préparer questions',0]]),
  r('RELATIONS','Réseau pro','1 event/mois','—','1 inscription/mois','Inaction → 1 inscription/mois','0/1 mois','0/2 mois','stable','Actif','Permanent',[['Mettre à jour profil',1],['Event de septembre',1],["S'inscrire conférence",0]]),
  r('PERSONNEL','Santé physique','3 séances/sem','—','3 séances/semaine','Blessure → Échauffement','< 2/1 sem','< 2/3 sem','stable','Actif','Permanent',[['Plan 12 semaines',1],['Semaine 1–4',1],['Semaine 5–8',1],['Course mardi 18h',0]]),
  r('PERSONNEL','Santé mentale','Revue quotidienne','—','Revue du soir (10 min)','Rumination → Revue du soir','1 jour rumination','3 jours rumination','stable','Actif','Permanent',[['Choisir carnet',1],['7 jours consécutifs',1],['30 jours consécutifs',1],['Trouver un thérapeute',1],['Faire revue ce soir',0]]),
  r('PERSONNEL','Sommeil','7h/nuit','—','Coucher à 23h','Écrans → Coucher à 23h','< 6.5h/1 nuit','< 6h/3 nuits','stable','Actif','Permanent',[['Alarme 22h30',1],['Téléphone hors chambre',1],['Coucher 22h30',0],['7 nuits à 7h',0],['Bilan sommeil',0]]),
  r('PERSONNEL','Nutrition','Alimentation saine','—','1 repas préparé/sem','Junk food → 1 repas/sem','2 écarts/sem','3 écarts/sem','stable','Actif','Permanent',[['Liste de 10 recettes',1],['Meal prep dimanche',0],['4 semaines sans écart',0],['Bilan poids',0]]),
  r('PERSONNEL','Lecture','1 livre/sem','—','30 min lecture/jour','Manque de temps → 30 min/jour','1 sem sans livre','2 sem sans livre','stable','Actif','31 déc',[['Choisir 12 livres',1],['Livre 1 terminé',1],['Finir chapitre 3',0],['Livre 2 terminé',0],['Livre 3 terminé',0]]),
  r('PERSONNEL','Réserve financière','6 mois dépenses','—','Virement auto (1er du mois)','Dépenses imprévues → 6 mois réserve','< 4 mois','< 3 mois','stable','Actif','Permanent',[['Calculer dépenses mensuelles',1],['Ouvrir livret',1],['Virement épargne',0]]),
  r('PERSONNEL','Méditation','10 min/jour','30 jours (30/09)','—','Inconstance → 30 jours test','—','—','stable','Draft','30/09',[['Tester méditation',0],['7 jours d\'affilée',0],['30 jours d\'affilée',0]])
];
// valeur actuelle + zone : ok (au-dessus de l'alerte) · alerte (entre alerte et kill) · kill (sous le kill) · none (pas de seuil)
const ACTUEL = ['38 500 €','46 cmd','29 k€','0 conflit','CPA 15,2 €',
  '1h10/jour','—','1/2 sem','Désordre 2j','Non réservé','1 alerte/mois',
  '1/1 mois','0/1 mois','1/3 mois','1/1 mois',
  '3/sem','0 jour','6h50/nuit','1 écart/sem','0 sem sans livre','4,2 mois','—'];
// clôture stockée en ISO (AAAA-MM-JJ) ou 'Permanent' / 'À dater'
const CLOTURE = {'30 nov':'2026-11-30','30/09':'2026-09-30','15/09':'2026-09-15','30/11':'2026-11-30','15/12':'2026-12-15','31 déc':'2026-12-31','Année scolaire':'2027-06-30'};
const TYPES = ['C','C','M','C','C','M','C','M','M','C','M','M','M','M','M','M','M','M','M','C','C','C'].map(t=>t==='C'?'Conquête':'Maintenance');
// ancien type Maintenance → échéance Permanent ; ancien type Conquête → échéance datée
SEED.forEach((x,i)=>{ x.id='mc-'+String(i+1).padStart(2,'0'); x.actuel=ACTUEL[i]; x.cloture=TYPES[i]==='Maintenance'?'Permanent':(CLOTURE[x.cloture]||x.cloture);
  const p=x.entropie.split(' → '); x.entropie=p[0]; x.reponse=p[1]||'—'; x.pause=x.statut==='Pause'; x.closed=false; x.sasDone=false; });
// clôture stockée : ISO 'AAAA-MM-JJ' (date précise) · 'M:AAAA-MM' (fin de mois) · 'Q:AAAA-Qn' (fin de trimestre) · 'Y:AAAA' (fin d'année)
// · 'A:AAAA-MM-JJ' (mandat d'un an : objectif continu, revu au terme puis renouvelé ou supprimé). L'ancien 'Permanent' est converti en mandat à la migration.
const isMandat = c => /^A:\d{4}-\d{2}-\d{2}$/.test(c||'');
const MOIS_S=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const lastDay=(y,m)=>isoD(new Date(y,m+1,0));
const fmtJM=iso=>{ const d=new Date(iso+'T00:00:00'); return d.getDate()+' '+MOIS_S[d.getMonth()]; };
const fmtFR=iso=>iso.split('-').reverse().join('/');
const resolveCloture=c=>{ if(!c||c==='Permanent'||c==='À dater') return null; if(CLOTURE[c]) c=CLOTURE[c]; let m;
  if(m=c.match(/^A:(\d{4}-\d{2}-\d{2})$/)) return m[1];
  if(m=c.match(/^M:(\d{4})-(\d{2})$/)) return lastDay(+m[1],+m[2]-1);
  if(m=c.match(/^Q:(\d{4})-Q([1-4])$/)) return lastDay(+m[1],+m[2]*3-1);
  if(m=c.match(/^Y:(\d{4})$/)) return lastDay(+m[1],11);
  return /^\d{4}-\d{2}-\d{2}$/.test(c)?c:null; };
const clotureLabel=c=>{ const iso=resolveCloture(c); if(!iso) return 'Permanent'; let m;
  if(isMandat(c)) return 'Mandat jusqu\u2019au '+fmtFR(iso);
  if(m=c.match(/^M:(\d{4})-(\d{2})$/)) return 'Fin '+MOIS_S[+m[2]-1]+' '+m[1]+' ('+fmtJM(iso)+')';
  if(m=c.match(/^Q:(\d{4})-Q([1-4])$/)) return 'Fin Q'+m[2]+' '+m[1]+' ('+fmtJM(iso)+')';
  if(m=c.match(/^Y:(\d{4})$/)) return 'Fin '+m[1]+' ('+fmtJM(iso)+')';
  return fmtFR(iso); };
const clotureShort=c=>isMandat(c)?'Mandat · '+fmtFR(resolveCloture(c)):clotureLabel(c).replace(/ \([^)]*\)$/,'');
const clotureInfo = c => { const iso=resolveCloture(c); if(!iso) return {label:'Permanent', short:'Permanent', sub:'', color:'#34d399'};
  return {label:clotureLabel(c), short:clotureShort(c), sub:'', color:'#d4d4d8', mandat:isMandat(c), days:Math.round((new Date(iso+'T00:00:00')-TODAY)/86400000)}; };
// menus d'échéance : jours relatifs · fins de mois (10 ans) · fins de trimestre (10 ans) · fins d'année (10 ans)
const clotureOptions=()=>{ const y0=TODAY.getFullYear(), m0=TODAY.getMonth(), q0=Math.floor(m0/3);
  const rel=[[0,'Aujourd\u2019hui'],[7,'+7 j'],[14,'+14 j'],[30,'+30 j'],[60,'+60 j'],[90,'+90 j'],[180,'+180 j'],[365,'+365 j']].map(([n,l])=>({value:daysAgo(-n),label:l+' ('+fmtFR(daysAgo(-n))+')'}));
  const monthGroups=[]; for(let i=0;i<120;i++){ const y=y0+Math.floor((m0+i)/12), m=(m0+i)%12; const v='M:'+y+'-'+String(m+1).padStart(2,'0'); let g=monthGroups[monthGroups.length-1]; if(!g||g.year!==String(y)){ g={year:String(y),items:[]}; monthGroups.push(g); } g.items.push({value:v,label:clotureLabel(v)}); }
  const quarters=[]; for(let i=0;i<40;i++){ const y=y0+Math.floor((q0+i)/4), q=(q0+i)%4+1; const v='Q:'+y+'-Q'+q; quarters.push({value:v,label:clotureLabel(v)}); }
  const years=Array.from({length:10},(_,i)=>{ const v='Y:'+(y0+i); return {value:v,label:clotureLabel(v)}; });
  return {rel,monthGroups,quarters,years}; };
const clotureSel=c=>({rel:/^\d{4}-\d{2}-\d{2}$/.test(c||'')?c:'',month:/^M:/.test(c||'')?c:'',quarter:/^Q:/.test(c||'')?c:'',year:/^Y:/.test(c||'')?c:''});
// projection : avancement dans le temps entre le début et l'échéance + jours restants / de retard
// zone (statut de projection) : ok · tension (≤ préavis alertDays) · jourj · retard · sas (test en cours : bleu, sans préavis) · continu · termine
const PROJ = {ok:['À l\u2019heure','#34d399'],sas:['Test','#818cf8'],tension:['Tension','#fbbf24'],jourj:['Jour J','#fafafa'],retard:['Retard','#fb7185'],continu:['Continu','#71717a'],termine:['Terminé','#71717a']};
const alertDaysOf = x => { const n=parseInt(x.alertDays,10); return isNaN(n)||n<0?7:n; };
// pendant un SAS non franchi, la jauge court du début à la fin du test : bleu tant que le test dure, rouge s'il est dépassé, jamais d'ambre (c'est un test) ; puis bascule vers la clôture
const projectionOf = x => {
  const eff=echeanceEffective(x); const c=eff.iso; const finalIso=eff.final;
  const finalDays=finalIso?Math.round((new Date(finalIso+'T00:00:00')-TODAY)/86400000):null;
  if(!c) return {permanent:true,sas:false,zone:'continu',color:PROJ.continu[1],zoneLabel:PROJ.continu[0],finalIso,finalPermanent:true,finalDays};
  const end=new Date(c+'T00:00:00'), start=new Date((startOf(x)||daysAgo(0))+'T00:00:00');
  const days=Math.round((end-TODAY)/86400000);
  if(x.closed) return {permanent:false,sas:false,days,pct:100,zone:'termine',color:PROJ.termine[1],zoneLabel:PROJ.termine[0],label:'terminé',finalIso,finalPermanent:!finalIso,finalDays};
  const total=Math.max(1,Math.round((end-start)/86400000)), elapsed=Math.round((TODAY-start)/86400000);
  const pct=Math.max(0,Math.min(100,Math.round(elapsed/total*100)));
  const preavis=alertDaysOf(x);
  const zone=eff.sas?(days<0?'retard':'sas'):(days<0?'retard':days===0?'jourj':days<=preavis?'tension':'ok');
  const mandat=!eff.sas&&isMandat(x.cloture);
  const zoneLabel=eff.sas?({retard:'Test dépassé',sas:days===0?'Dernier jour du test':'Test en cours'})[zone]:mandat?({retard:'Mandat dépassé',jourj:'Mandat à renouveler',tension:'Mandat à renouveler',ok:'Mandat en cours'})[zone]:PROJ[zone][0];
  return {permanent:false,sas:eff.sas,mandat,days,pct,zone,color:PROJ[zone][1],zoneLabel,label:days<0?'-'+(-days)+' j':days===0?'J+0':'+'+days+' j',preavis,finalIso,finalPermanent:!finalIso,finalDays};
};

// Même objet Date pour tous les consommateurs ; actualisé avant chaque rendu et au retour sur l'onglet.
const TODAY=new Date(); TODAY.setHours(0,0,0,0);
const refreshToday=(now=new Date())=>{ const day=new Date(now); day.setHours(0,0,0,0); const changed=TODAY.getTime()!==day.getTime(); if(changed) TODAY.setTime(day.getTime()); return changed; };
const isoD=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const daysAgo=n=>{ const d=new Date(TODAY); d.setDate(d.getDate()-n); return isoD(d); };
const plusDays=(iso,n)=>{ const d=new Date(iso+'T00:00:00'); d.setDate(d.getDate()+n); return isoD(d); };
const plusMonths=(iso,n)=>{ const d=new Date(iso+'T00:00:00'); d.setMonth(d.getMonth()+n); return isoD(d); };
// fin du test déduite du texte du SAS : date explicite « (30/09) », sinon « 14 jours » / « 2 semaines » / « 1 mois » depuis le début, sinon 14 jours
const inferSasUntil = x => { const base=startOf(x)||daysAgo(0); const t=String(x.sas||''); let m;
  if(m=t.match(/\((\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\)/)){ const y=m[3]?+m[3]:+base.slice(0,4); let iso=y+'-'+String(+m[2]).padStart(2,'0')+'-'+String(+m[1]).padStart(2,'0');
    if(!m[3]&&iso<base) iso=(y+1)+iso.slice(4); const d=new Date(iso+'T00:00:00'); if(!isNaN(d)&&isoD(d)===iso) return iso; }
  if(m=t.match(/(\d+)\s*(?:jours?|j)\b/i)) return plusDays(base,+m[1]);
  if(m=t.match(/(\d+)\s*(?:semaines?|sem)\b/i)) return plusDays(base,7*+m[1]);
  if(m=t.match(/(\d+)\s*mois\b/i)) return plusMonths(base,+m[1]);
  return plusDays(base,14); };
// mandat d'un an depuis une date de base, reporté d'année en année jusqu'à la prochaine échéance après aujourd'hui
const mandatDepuis = base => { const d=/^\d{4}-\d{2}-\d{2}$/.test(base||'')?base:daysAgo(0); const today=daysAgo(0); let end=plusMonths(d,12); let guard=0; while(end<=today&&guard++<200) end=plusMonths(end,12); return 'A:'+end; };
// échéance effective : la fin du test tant que le SAS n'est pas franchi, sinon la clôture (null = sans date)
const echeanceEffective = x => { const fin=resolveCloture(x.cloture); const su=(!x.closed&&sasPendingOf(x))?sasUntilOf(x):null; return su?{iso:su,sas:true,final:fin}:{iso:fin,sas:false,final:fin}; };
SEED.forEach((x,i)=>{ const age=20+(i*37)%110; x.createdAt=daysAgo(age); x.history=[{t:x.createdAt,type:'created'}];
  const done=x.actions.filter(a=>a.done).length; for(let j=0;j<done;j++) x.history.push({t:daysAgo(Math.max(0,Math.round(age-(j+1)*age/(done+1)))),type:'step'});
  if(sasPendingOf(x)) x.sasUntil=inferSasUntil(x); if(x.cloture==='Permanent') x.cloture=mandatDepuis(x.createdAt); });
[['ENTREPRISE','Site vitrine','Site en ligne','Conquête',12,95],['PERSONNEL','Déclaration impôts','Déclaration envoyée','Conquête',40,130]].forEach(([cosmos,name,objectif,type,closedAgo,age],k)=>{
  SEED.push({id:'mc-c'+k,cosmos,name,objectif,type,actuel:'Fait',sas:'—',maintenance:'—',entropie:'—',reponse:'—',alerte:'—',kill:'—',pause:false,closed:true,sasDone:false,cloture:daysAgo(closedAgo),createdAt:daysAgo(age),
    actions:[{text:'Préparer',done:true},{text:'Réaliser',done:true},{text:'Valider',done:true}],history:[{t:daysAgo(age),type:'created'},{t:daysAgo(Math.round(age*0.6)),type:'step'},{t:daysAgo(Math.round(age*0.3)),type:'step'},{t:daysAgo(closedAgo),type:'step'},{t:daysAgo(closedAgo),type:'statut',value:'Clôturé'}]}); });
const progOf = x => { const t=x.actions.length; const d=x.actions.filter(a=>a.done).length; return t?Math.round(d/t*100):0; };
const nextOf = x => { const n=x.actions.find(a=>!a.done); return n?n.text:(x.actions.length?'toutes les étapes faites':'—'); };
const EMPTY_FORM = {cosmos:'',name:'',poids:'normal',objectif:'',actuel:'',sas:'',sasUntil:'',entropie:'',reponse:'',alerte:'',kill:'',startAt:'',echeance:'datee',cloture:'',alertDays:7,actions:['','','','','']}
// à l'ouverture du formulaire l'échéance est datée, calendrier positionné sur aujourd'hui
const freshForm=(over={})=>({...EMPTY_FORM,startAt:daysAgo(0),cloture:daysAgo(0),...over});
const TEMPLATES = [
  ['ENTREPRISE',['Projet','Produit / offre','Pricing','Acquisition','Canal d\u2019acquisition','Publicité / Ads','SEO','Vente','Tunnel / page de vente','Rétention / churn','Communauté clients','Partenariats / affiliés','Marque / branding','Marque personnelle','Contenu / édition','Veille concurrentielle','Innovation / R&D','Test / sonde','Data / KPI','Trésorerie / cash','Comptabilité','Revue financière / reporting','Équipe','Recrutement','Formation interne','Processus internes','Automatisation','Production','Ops / livraison client','Logistique','Fournisseurs','Support client / SAV','Juridique','Conformité / RGPD','Infrastructure / IT','Sécurité','Saison / opération saisonnière']],
  ['CARRIÈRE',['Poste actuel','Évolution / promotion','Salaire / négociation','Employabilité','Réputation professionnelle','Recherche d\u2019emploi','Bilan de compétences']],
  ['FAMILLE',['Enfants','Santé des enfants','Scolarité','Activité / sport d\u2019un enfant','Couple','Communication couple','Rôles / charge mentale','Temps en solo (parent)','Traditions / rituels','Maison / organisation du foyer','Projets de maison / travaux','Organisation quotidienne','Budget familial','Vacances en famille','Événements familiaux','Anniversaires / dates clés','Famille élargie / parents / fratrie','Santé d\u2019un proche','Animaux','Administratif familial','Transmission / héritage']],
  ['RELATIONS',['Amitié','Vie sociale / sorties','Cercle / communauté','Voisinage','Mentor / conseiller','Réseau professionnel','Relations professionnelles clés','Partenariat / collaboration','Relation à maintenir','Relations à risque / limites','Conflits à résoudre','Nouveaux contacts','Gratitude / remerciements','Communication relationnelle','Projets collaboratifs']],
  ['PERSONNEL',['Santé physique','Santé mentale','Gestion du stress','Énergie / sieste','Sommeil','Nutrition / alimentation','Cuisine','Hydratation','Sport / performance','Étirements / mobilité','Posture / ergonomie','Prévention santé','Vue / dentaire','Vie sexuelle','Addictions / habitudes à couper','Lecture','Apprentissage / étude','Formation / certification','Compétence spécifique','Apprentissage d\u2019une langue','Apprentissage musical','Créativité / écriture','Spiritualité / stoïcisme','Journal / gratitude / réflexion','Attention','Pensées / rumination','Discipline','Confiance / prise de parole','Gestion du temps','Routine matinale','Routine du soir','Digital detox / écrans','Médias / consommation','Loisirs','Vêtements / apparence']],
  ['FINANCES / PATRIMOINE',['Budget personnel','Finances personnelles','Épargne','Réserve financière / fonds d\u2019urgence','Investissements / placements','Revenus passifs','Immobilier','Dette','Crédit / score','Assurance','Fiscalité','Retraite','Gros achat','Dons / générosité','Patrimoine','Transmission patrimoniale']],
  ['ENVIRONNEMENT / LOGISTIQUE',['Logement','Bureau','Objets / matériel','Garde-robe capsule','Plantes / jardin','Fichiers / documents','Photos / souvenirs','Espace numérique','Mail / inbox','Mots de passe','Téléphone','Abonnements','Sécurité numérique','Sauvegardes / backups','Vie administrative / papiers','Automobile / véhicule','Mobilité']],
  ['CONTRIBUTION',['Bénévolat','Engagement local','Mentorat donné','Dons','Écologie personnelle','Transmission de savoir']],
  ['CRÉATION',['Projet artistique','Side project','Portfolio','Publication / livre','Jeu / prototype','Musique / album','Chaîne / podcast']],
  ['SENS / IDENTITÉ',['Valeurs','Mission de vie','Bilan annuel','Projets de vie à 5 ans','Legs / trace laissée','Retraite spirituelle']],
  ['EXPÉRIENCES / TEMPORAIRE',['Voyage','Vacances','Événement','Challenge','Expérience personnelle','Achat important','Déménagement','Formation ponctuelle','Préparation compétition','Année sabbatique','Deuil / transition']]
];
const chipOff = {color:'#71717a',bg:'#09090b',border:'#27272a'};
const chipOn = {color:'#f4f4f5',bg:'rgba(63,63,70,0.55)',border:'rgba(113,113,122,0.7)'};

export { COLORS, STATUTS, STATUT_STYLE, hasSas, sasUntilOf, sasPendingOf, isMandat, mandatDepuis, POIDS, POIDS_LABEL, POIDS_ORDER, POIDS_DOT, poidsOf, inferSasUntil, echeanceEffective, plusDays, plusMonths, startOf, notStarted, statutOf, migrate, r, SEED, ACTUEL, CLOTURE, TYPES, MOIS_S, lastDay, fmtJM, fmtFR, resolveCloture, clotureLabel, clotureShort, clotureInfo, clotureOptions, clotureSel, PROJ, alertDaysOf, projectionOf, TODAY, refreshToday, isoD, daysAgo, progOf, nextOf, EMPTY_FORM, freshForm, TEMPLATES, chipOff, chipOn };
