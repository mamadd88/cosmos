import { createRef } from 'react';
import {
  COSMOS_FLOORS,
  FLOOR_TITLE_MAX_LENGTH,
  floorTitle,
  normalizeFloorTitles,
} from '../../cosmos-floors.js';
import {
  validateMini,
  isDraft,
  COLORS,
  STATUT_STYLE,
  hasSas,
  sasUntilOf,
  isMandat,
  mandatDepuis,
  POIDS,
  POIDS_LABEL,
  POIDS_ORDER,
  POIDS_DOT,
  poidsOf,
  inferSasUntil,
  echeanceEffective,
  plusDays,
  plusMonths,
  startOf,
  notStarted,
  statutOf,
  migrate,
  SEED,
  fmtFR,
  resolveCloture,
  clotureLabel,
  clotureShort,
  clotureInfo,
  clotureOptions,
  clotureSel,
  PROJ,
  alertDaysOf,
  projectionOf,
  TODAY,
  refreshToday,
  isoD,
  daysAgo,
  EMPTY_FORM,
  freshForm,
  TEMPLATES,
  chipOff,
  chipOn,
} from '../../cosmos-core.js';
import { normalizeOrganization } from '../../cosmos-sections.js';
import { createSync } from '../../cosmos-sync.js';
import { valueChangeEvent, valueChangeJournal } from '../../cosmos-journal.js';
import { ObservableStore } from './ObservableStore.js';
import { canonicalPath, readRoute, routeUrl } from './routing.ts';
import { readStartupCache, writeStartupCache, clearStartupCache } from './startup-cache.ts';

export function createControllerClass(environment = {}) {
  const {
    document = globalThis.document,
    window = globalThis.window,
    location = globalThis.location,
    localStorage = globalThis.localStorage,
    makeSync = createSync,
  } = environment;
  // Trois étages fixes, dans l'ordre de chute. Un cosmos appartient à un étage (Logos par défaut) ; l'ordre dans un étage est l'ordre du tableau des cosmos restreint à l'étage.
  const ETAGES = [
    ['ethos', 'Ethos', 'ce qui porte l’opérateur : s’il tombe, tout tombe', 'Le caractère'],
    ['logos', 'Logos', 'ce qu’il fait tourner : la règle et le moteur', 'L’ordre'],
    ['pathos', 'Pathos', 'ce pour quoi tout existe : la source des poids', 'L’énergie'],
  ];
  const ETAGE_ORDER = { ethos: 0, logos: 1, pathos: 2 },
    ETAGE_LABEL = { ethos: 'Ethos', logos: 'Logos', pathos: 'Pathos' };
  const SEED_ETAGES = { PERSONNEL: 'ethos', FAMILLE: 'pathos', RELATIONS: 'pathos' };
  const etageDeNom = (E, n) => {
    const e = E && E[n];
    return ETAGE_ORDER[e] != null ? e : 'logos';
  };
  // insère (ou replace) une pièce en fin de son étage, le tableau des cosmos restant rangé par étage
  const rangerParEtage = (list, E) =>
    [...(list || [])]
      .map((n, i) => [n, i])
      .sort((a, b) => ETAGE_ORDER[etageDeNom(E, a[0])] - ETAGE_ORDER[etageDeNom(E, b[0])] || a[1] - b[1])
      .map((p) => p[0]);
  const placerEnFinEtage = (list, name, etage, E) => {
    const c = list.filter((n) => n !== name);
    let at = c.length;
    for (let k = 0; k < c.length; k++) {
      if (ETAGE_ORDER[etageDeNom(E, c[k])] > ETAGE_ORDER[etage]) {
        at = k;
        break;
      }
    }
    c.splice(at, 0, name);
    return c;
  };

  return class CosmosController extends ObservableStore {
    /** @type {((path: string) => void) | undefined} */
    routerNavigate;
    _bootVersion = 0;
    _lifecycle = 0;
    _userId = '';
    state = {
      bootError: '',
      syncRefreshing: false,
      ready: false,
      cosmos: [],
      etageDe: {},
      etages: {},
      titresEtages: /** @type {Record<string, string>} */ ({}),
      editFloor: /** @type {string | null} */ (null),
      newEtage: 'logos',
      titresDe: {},
      sections: [],
      sectionDe: {},
      editSection: /** @type {{ id: string | null, etage: string, name: string } | null} */ (null),
      sectionError: '',
      cosmosAction: /** @type {{ type: 'rename' | 'delete' | 'rubrique', cosmos: string } | null} */ (null),
      miniDeleteId: /** @type {string | null} */ (null),
      miniNameEditId: /** @type {string | null} */ (null),
      groupAction: /** @type {{ type: 'rename' | 'delete' | 'create', id: string } | null} */ (null),
      rubriqueAction: /** @type {{ type: 'rename' | 'delete', cosmos: string, name: string } | null} */ (
        null
      ),
      createdCosmos: /** @type {string | null} */ (null),
      revealCosmos: /** @type {string | null} */ (null),
      quickDrafts: /** @type {Record<string, {name: string, error: string}>} */ ({}),
      rows: [],
      journal: [],
      selected: null,
      showCosmosModal: false,
      showMiniModal: false,
      cosmosName: '',
      form: /** @type {ReturnType<typeof freshForm> | null} */ (null),
      tab: 0,
      toast: null,
      clock: '',
      needsLogin: false,
      loginEmail: '',
      loginPassword: '',
      loginError: '',
      loginBusy: false,
      propositions: [],
      agents: [],
      showAgents: false,
      newAgentName: '',
      newAgentDirect: false,
      newAgentKey: '',
      newAgentKeyName: '',
    };
    setState(update, callback) {
      super.setState((previous) => {
        const patch = typeof update === 'function' ? update(previous) : update;
        if (
          patch &&
          ['cosmos', 'etageDe', 'sections', 'sectionDe'].some((key) => Object.hasOwn(patch, key))
        ) {
          const organization = normalizeOrganization({ ...previous, ...patch });
          const drafts = patch.quickDrafts || previous.quickDrafts || {};
          const cleanup = Object.keys(drafts).some((name) => !organization.cosmos.includes(name));
          return {
            ...patch,
            ...organization,
            ...(cleanup
              ? {
                  quickDrafts: Object.fromEntries(
                    Object.entries(drafts).filter(([name]) => organization.cosmos.includes(name)),
                  ),
                }
              : {}),
          };
        }
        return patch;
      }, callback);
    }
    routeState() {
      return readRoute(this._routePath || location?.pathname || '/cosmos');
    }
    applyRoute(pathname) {
      this._routePath = canonicalPath(pathname);
      const next = readRoute(pathname);
      if (next.view !== this.state.view || next.selected !== this.state.selected)
        this.setState({ ...next, confirmDeleteMini: false });
    }
    syncHash() {
      if (!this.state.ready || !this.routerNavigate) return;
      const want = routeUrl(this.state.view || 'table', this.state.selected);
      if ((this._routePath || location.pathname) !== want) this.routerNavigate(want);
    }
    // persistance locale — un seul document JSON versionné, même format que l'export
    STORE_KEY = 'cosmos-app-v1';
    serialize() {
      const s = this.state;
      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        cosmos: s.cosmos,
        miniCosmos: s.rows,
        journal: valueChangeJournal(s.journal),
        journalArchive: valueChangeJournal(s.journalArchive),
        etageDe: s.etageDe || {},
        etages: s.etages || {},
        titresEtages: normalizeFloorTitles(s.titresEtages),
        titresDe: s.titresDe || {},
        sections: s.sections || [],
        sectionDe: s.sectionDe || {},
        view: s.view || 'table',
      };
    }
    // le journal vivant garde 12 mois ; le reste part dans journalArchive (conservé dans l'export JSON)
    archiveOld() {
      if (this.sync) return;
      const s = this.state;
      const J = s.journal || [];
      const cut = new Date();
      cut.setFullYear(cut.getFullYear() - 1);
      const c = cut.toISOString();
      const old = J.filter((e) => e.t < c);
      if (!old.length) return;
      this.setState({
        journal: J.filter((e) => e.t >= c),
        journalArchive: [...old, ...(s.journalArchive || [])],
      });
    }
    load() {
      try {
        const raw = localStorage.getItem(this.STORE_KEY);
        if (!raw) return null;
        const d = JSON.parse(raw);
        if (d && d.version === 1 && Array.isArray(d.cosmos) && Array.isArray(d.miniCosmos)) return d;
      } catch (e) {}
      return null;
    }
    // en mode base : sauvegarde différentielle regroupée (cosmos-sync.js) ; sinon localStorage
    persist() {
      if (this.state.syncRefreshing || this._unmounted) return;
      if (this.sync) {
        const s = this.state;
        this.sync.save({
          cosmos: s.cosmos,
          etageDe: s.etageDe || {},
          etages: s.etages || {},
          titresEtages: normalizeFloorTitles(s.titresEtages),
          titresDe: s.titresDe || {},
          sections: s.sections || [],
          sectionDe: s.sectionDe || {},
          rows: s.rows,
          journal: this._replace ? [...(s.journal || []), ...(this._replaceArchive || [])] : s.journal || [],
          replace: !!this._replace,
        });
        this._replace = false;
        this._replaceArchive = null;
        return;
      }
      try {
        localStorage.setItem(this.STORE_KEY, JSON.stringify(this.serialize()));
      } catch (e) {}
    }
    componentDidMount() {
      this._unmounted = false;
      const lifecycle = ++this._lifecycle;
      this.tick();
      this.t = setInterval(() => this.tick(), 30000);
      this._onVis = () => {
        if (document.visibilityState === 'visible') this.tick();
      };
      document.addEventListener('visibilitychange', this._onVis);
      this._onUnload = (e) => {
        if (
          (this.state.editing &&
            JSON.stringify(this.state.editDraft) !== JSON.stringify(this.state.editSnap)) ||
          this.sync?.hasPending()
        ) {
          e.preventDefault();
          e.returnValue = '';
        }
      };
      window.addEventListener('beforeunload', this._onUnload);
      this.onKey = (e) => {
        if (e.key !== 'Escape') return;
        const s = this.state;
        if (s.showCosmosModal || s.showMiniModal || s.showAgents)
          this.setState({ showCosmosModal: false, showMiniModal: false, showAgents: false });
        else if (s.selected && !s.editing) this.setState({ selected: null, confirmDeleteMini: false });
      };
      window.addEventListener('keydown', this.onKey);
      this.bootTask = Promise.resolve()
        .then(async () => {
          const sync = await makeSync({ author: this.props.author ?? 'Toi' });
          if (this._unmounted || lifecycle !== this._lifecycle) {
            sync?.dispose?.();
            return;
          }
          if (!sync) {
            this.bootLocal();
            return;
          }
          this.sync = sync;
          sync.onError((e) => {
            if (this._unmounted) return;
            if (e.code === 'P4090') this.setState({ syncConflict: e.message });
            else this.flash('Sauvegarde impossible — ' + e.message);
          });
          this._unsubscribeAuth = sync.onAuth((ev, session) => {
            if (this._unmounted) return;
            if (ev === 'SIGNED_OUT') this.clearSession();
            // Ne pas attendre une opération Supabase dans le callback d'authentification.
            if (ev === 'SIGNED_IN' && this._userId && session?.user?.id !== this._userId) {
              this.clearSession();
              queueMicrotask(() => {
                if (!this._unmounted) this.bootDb(session);
              });
            }
          });
          const version = this._bootVersion;
          const session = await sync.session();
          if (this._unmounted || lifecycle !== this._lifecycle || version !== this._bootVersion) return;
          if (session) await this.bootDb(session);
          else this.setState({ needsLogin: true });
        })
        .catch((e) => {
          if (this._unmounted || lifecycle !== this._lifecycle) return;
          console.error('Démarrage Cosmos', e);
          this.setState({ bootError: String(e.message || e) });
        });
    }
    clearSession() {
      clearStartupCache(localStorage, this.sync?.cacheScope, this._userId);
      this._userId = '';
      this._bootVersion++;
      this.__snap = null;
      this._replace = false;
      this._replaceArchive = null;
      this.setState({
        ready: false,
        syncRefreshing: false,
        needsLogin: true,
        bootError: '',
        dataMenu: false,
        selected: null,
        cosmos: [],
        quickDrafts: {},
        rows: [],
        etageDe: {},
        etages: {},
        titresEtages: {},
        titresDe: {},
        sections: [],
        sectionDe: {},
        journal: [],
        journalArchive: [],
        journalArchived: 0,
        propositions: [],
        agents: [],
        editing: false,
        editSnap: null,
        editDraft: null,
        editEvents: [],
        showAgents: false,
        showMiniModal: false,
        showCosmosModal: false,
        syncConflict: '',
        editSection: null,
        sectionError: '',
        cosmosAction: null,
        groupAction: null,
        miniNameEditId: null,
        miniDeleteId: null,
        rubriqueAction: null,
        editFloor: null,
        revealCosmos: null,
        createdCosmos: null,
      });
    }
    cacheConfirmed(state) {
      writeStartupCache(localStorage, this.sync?.cacheScope, this._userId, state);
    }
    bootLocal() {
      const d = this.load();
      const base = d
        ? {
            cosmos: d.cosmos,
            etageDe: d.etageDe || {},
            etages: d.etages || {},
            titresEtages: normalizeFloorTitles(d.titresEtages),
            titresDe: d.titresDe || {},
            sections: d.sections || [],
            sectionDe: d.sectionDe || {},
            rows: migrate(d.miniCosmos),
            journal: valueChangeJournal(d.journal),
            view: d.view || 'table',
          }
        : {
            cosmos: ['ENTREPRISE', 'FAMILLE', 'RELATIONS', 'PERSONNEL'],
            etageDe: { ...SEED_ETAGES },
            etages: {},
            titresEtages: {},
            titresDe: {},
            sections: [],
            sectionDe: {},
            rows: SEED,
            journal: this.journalFromRows(SEED),
            view: 'table',
          };
      base.cosmos = rangerParEtage(base.cosmos, base.etageDe);
      this.setState(
        {
          ...base,
          journalArchive: valueChangeJournal(d?.journalArchive),
          form: freshForm(),
          ready: true,
          ...this.routeState(),
        },
        () => this.archiveOld(),
      );
    }
    // La copie locale accélère l'affichage ; seule la réponse serveur autorise l'édition.
    async bootDb(session) {
      const version = ++this._bootVersion;
      try {
        session = session || (await this.sync.session());
        if (this._unmounted || version !== this._bootVersion) return;
        if (!session) {
          this.clearSession();
          return;
        }
        this._userId = session.user.id;
        const cached = readStartupCache(localStorage, this.sync.cacheScope, this._userId);
        this.setState({
          syncRefreshing: true,
          bootError: '',
          needsLogin: false,
          ...(cached
            ? {
                ...cached,
                rows: migrate(cached.rows),
                journal: [],
                journalArchive: [],
                journalArchived: 0,
                propositions: [],
                form: freshForm(),
                ready: true,
                ...this.routeState(),
              }
            : {}),
        });
        const d = await this.sync.load();
        if (this._unmounted || version !== this._bootVersion) return;
        let base;
        if (d.empty) {
          const l = this.load();
          if (l) {
            base = {
              cosmos: l.cosmos,
              etageDe: l.etageDe || {},
              etages: l.etages || {},
              titresEtages: normalizeFloorTitles(l.titresEtages),
              titresDe: l.titresDe || {},
              sections: l.sections || [],
              sectionDe: l.sectionDe || {},
              rows: migrate(l.miniCosmos),
              journal: valueChangeJournal(l.journal),
            };
            this._replaceArchive = valueChangeJournal(l.journalArchive);
            this.flash('Données de ce navigateur reprises dans la base');
          } else
            base = {
              cosmos: ['ENTREPRISE', 'FAMILLE', 'RELATIONS', 'PERSONNEL'],
              etageDe: { ...SEED_ETAGES },
              etages: {},
              titresEtages: {},
              titresDe: {},
              sections: [],
              sectionDe: {},
              rows: SEED,
              journal: this.journalFromRows(SEED),
            };
          this._replace = true;
        } else {
          base = {
            cosmos: d.cosmos,
            etageDe: d.etageDe || {},
            etages: d.etages || {},
            titresEtages: normalizeFloorTitles(d.titresEtages),
            titresDe: d.titresDe || {},
            sections: d.sections || [],
            sectionDe: d.sectionDe || {},
            rows: migrate(d.rows),
            journal: d.journal,
          };
          this.sync.prime(base);
          this.cacheConfirmed(base);
        }
        base.cosmos = rangerParEtage(base.cosmos, base.etageDe);
        this.installAssist();
        this.__snap = null;
        this.setState({
          ...base,
          syncRefreshing: false,
          view: 'table',
          journalArchive: [],
          journalArchived: d.journalArchived || 0,
          propositions: d.propositions || [],
          needsLogin: false,
          loginError: '',
          bootError: '',
          form: freshForm(),
          ready: true,
          ...this.routeState(),
        });
        this.loadAgents();
      } catch (e) {
        if (this._unmounted || version !== this._bootVersion) return;
        console.error('bootDb', e);
        this.setState({
          bootError: String(e && e.message ? e.message : e),
          needsLogin: false,
          syncRefreshing: this.state.ready,
        });
      }
    }
    // l'assistant du volet gauche passe par /api/assist (la clé Anthropic reste côté serveur)
    installAssist() {
      if (window.claude && window.claude.complete) return;
      const sync = this.sync;
      this._assistBridge = { complete: (req) => sync.assist(req) };
      window.claude = this._assistBridge;
    }
    async loadAgents() {
      const version = this._bootVersion;
      try {
        const agents = await this.sync.listAgents();
        if (!this._unmounted && version === this._bootVersion) this.setState({ agents });
      } catch (e) {
        console.error('agents', e);
      }
    }
    // Relève différée pendant une édition ou un déplacement pour préserver les champs en cours de saisie.
    pollState() {
      const s = this.state;
      return this._unmounted ||
        !s.ready ||
        s.syncRefreshing ||
        this._replace ||
        s.editing ||
        s.editFloor ||
        s.editSection ||
        s.cosmosAction ||
        s.groupAction ||
        s.miniNameEditId ||
        s.miniDeleteId ||
        s.rubriqueAction ||
        Object.values(s.quickDrafts).some((draft) => draft.name.trim()) ||
        s.drag ||
        s.showMiniModal ||
        s.showCosmosModal
        ? null
        : s;
    }
    // ce qui a changé ailleurs (agents, autre appareil) : état complet toutes les 30 s et au retour sur l'onglet
    async pollDb() {
      if (!this.sync || !this.state.ready || this._polling) return;
      this._polling = true;
      try {
        await this.sync.poll(
          () => this.pollState(),
          (d, changes) => {
            this.cacheConfirmed(d);
            const before = new Set((this.state.propositions || []).map((p) => p.id));
            this.setState((s) => {
              const patch = {
                cosmos: d.cosmos,
                etageDe: d.etageDe,
                etages: d.etages,
                titresEtages: d.titresEtages || {},
                titresDe: d.titresDe,
                sections: d.sections || [],
                sectionDe: d.sectionDe || {},
                rows: d.rows,
                journal: d.journal,
                journalArchived: d.journalArchived,
                propositions: d.propositions,
              };
              if (s.selected && !d.rows.some((x) => x.id === s.selected))
                Object.assign(patch, {
                  selected: null,
                  editing: false,
                  editSnap: null,
                  confirmDeleteMini: false,
                  aiDetail: null,
                });
              return patch;
            });
            changes.rows.forEach((r) =>
              this.flash(
                (r.data.name || 'Mini-cosmos') + ' mis à jour par ' + (r.updatedBy || 'un autre appareil'),
              ),
            );
            if (changes.deleted.length)
              this.flash(
                changes.deleted.length +
                  ' mini-cosmos supprimé' +
                  (changes.deleted.length > 1 ? 's' : '') +
                  ' depuis un autre appareil',
              );
            const p = d.propositions.find((p) => !before.has(p.id));
            if (p) this.flash('Nouvelle proposition de ' + p.agent);
          },
        );
      } catch (e) {
        console.error('poll', e);
      } finally {
        this._polling = false;
      }
    }
    async resolveSyncConflict() {
      if (this.state.syncConflictBusy || !this.finishEdit()) return;
      this.setState({ syncConflictBusy: true });
      try {
        await this.exportJson(false);
        const d = await this.sync.reloadAfterConflict();
        const rows = migrate(d.rows),
          base = {
            cosmos: d.cosmos,
            etageDe: d.etageDe,
            etages: d.etages,
            titresEtages: normalizeFloorTitles(d.titresEtages),
            titresDe: d.titresDe,
            sections: d.sections || [],
            sectionDe: d.sectionDe || {},
            rows,
            journal: d.journal,
          };
        this.sync.prime(base);
        this.cacheConfirmed(base);
        this.setState({
          ...base,
          journalArchived: d.journalArchived,
          propositions: d.propositions,
          selected: rows.some((x) => x.id === this.state.selected) ? this.state.selected : null,
          syncConflict: '',
          syncConflictBusy: false,
        });
        this.flash('Copie locale exportée, version synchronisée chargée');
      } catch (e) {
        this.setState({ syncConflictBusy: false });
        this.flash('Rechargement impossible — ' + e.message);
      }
    }
    async doLogin() {
      const s = this.state;
      if (!(s.loginEmail || '').trim() || !s.loginPassword || s.loginBusy) return;
      this.setState({ loginBusy: true, loginError: '' });
      try {
        const session = await this.sync.login(s.loginEmail.trim(), s.loginPassword);
        this.setState({ loginPassword: '', loginBusy: false });
        await this.bootDb(session);
      } catch (e) {
        this.setState({ loginBusy: false, loginError: e && e.message ? e.message : String(e) });
      }
    }
    async logout() {
      if (!this.finishEdit()) return;
      try {
        await this.sync.flush();
        if (this.sync.hasPending()) {
          this.flash('Termine la sauvegarde avant de te déconnecter.');
          return;
        }
        await this.sync.logout();
        this.clearSession();
      } catch (e) {
        this.flash('Déconnexion impossible — ' + e.message);
      }
    }
    async createAgent() {
      const s = this.state;
      const name = (s.newAgentName || '').trim();
      if (!name) return;
      try {
        const key = await this.sync.createAgent(name, !!s.newAgentDirect);
        this.setState({ newAgentKey: key, newAgentKeyName: name, newAgentName: '', newAgentDirect: false });
        this.logJ({
          type: 'donnees',
          detail:
            'Agent « ' + name + ' » créé (' + (s.newAgentDirect ? 'écriture directe' : 'propositions') + ')',
        });
        this.loadAgents();
      } catch (e) {
        this.flash('Création impossible — ' + (e && e.message ? e.message : e));
      }
    }
    async revokeAgent(a) {
      try {
        await this.sync.revokeAgent(a.id);
        this.logJ({ type: 'donnees', detail: 'Agent « ' + a.name + ' » révoqué' });
        this.flash('Agent ' + a.name + ' révoqué');
        this.loadAgents();
      } catch (e) {
        this.flash('Révocation impossible — ' + (e && e.message ? e.message : e));
      }
    }
    // poids : vital / important / normal — un clic sur le point fait tourner la valeur, tracé dans le Journal
    cyclePoids(row) {
      const cur = poidsOf(row);
      this.setPoids(row, POIDS[(POIDS.indexOf(cur) + 1) % POIDS.length]);
    }
    setPoids(row, p) {
      if (poidsOf(row) === p) return;
      this.update(row.id, { poids: p }, { type: 'modification', detail: 'Poids → ' + POIDS_LABEL[p] });
      this.flash(row.name + ' : ' + POIDS_LABEL[p].toLowerCase());
    }
    // applique un patch (assistant IA ou proposition d'agent) : champs texte remplacés, étapes ajoutées sans doublon
    applyPatch(sel, p, label) {
      sel =
        this.state.editing && this.state.editDraft?.id === sel.id
          ? this.state.editDraft
          : this.state.rows.find((x) => x.id === sel.id) || sel;
      const patch = {};
      ['objectif', 'actuel', 'entropie', 'reponse', 'sas', 'sasUntil', 'alerte', 'kill'].forEach((k) => {
        if (p[k] != null && p[k] !== '') patch[k] = p[k];
      });
      if (POIDS.includes(p.poids)) patch.poids = p.poids;
      if (patch.sasUntil && !/^\d{4}-\d{2}-\d{2}$/.test(patch.sasUntil)) delete patch.sasUntil;
      if (patch.sas && !patch.sasUntil && !sasUntilOf(sel))
        patch.sasUntil = inferSasUntil({ ...sel, sas: patch.sas });
      const add = p.etapes || (p.etape != null ? [p.etape] : []);
      if (add.length) {
        const have = new Set(sel.actions.map((a) => a.text));
        const fresh = add.filter((t) => t && !have.has(t));
        if (fresh.length) patch.actions = [...sel.actions, ...fresh.map((t) => ({ text: t, done: false }))];
      }
      const changes = this.miniChanges(sel, { ...sel, ...patch });
      if (!changes.length) return false;
      this.update(sel.id, patch, {
        type: 'modification',
        detail: label + ' : ' + changes.map((c) => c.field).join(', '),
        changes,
      });
      return true;
    }
    async decideProposal(p, sel, ok) {
      if (!this.finishEdit()) return;
      sel = this.state.rows.find((x) => x.id === sel.id);
      if (!sel) return;
      if (ok) {
        if (!this.applyPatch(sel, p.patch || {}, 'Proposition de ' + p.agent + ' acceptée'))
          this.logJ({
            type: 'proposition',
            mini: sel.name,
            miniId: sel.id,
            cosmos: sel.cosmos,
            detail: 'Proposition de ' + p.agent + ' acceptée (rien à changer)',
          });
      } else
        this.logJ({
          type: 'proposition',
          mini: sel.name,
          miniId: sel.id,
          cosmos: sel.cosmos,
          detail: 'Proposition de ' + p.agent + ' refusée',
        });
      this.setState((s) => ({ propositions: (s.propositions || []).filter((x) => x.id !== p.id) }));
      this.flash(ok ? 'Proposition appliquée' : 'Proposition refusée');
      try {
        await this.sync.decideProposition(p.id, ok ? 'acceptee' : 'refusee');
      } catch (e) {
        this.flash('Décision non enregistrée — ' + (e && e.message ? e.message : e));
      }
    }
    componentDidUpdate() {
      const s = this.state;
      if (!s.ready || s.syncRefreshing) return;
      this.syncHash();
      const k = [
        s.cosmos,
        s.etageDe,
        s.etages,
        s.titresEtages,
        s.titresDe,
        s.sections,
        s.sectionDe,
        s.rows,
        s.view,
        s.journal,
        s.journalArchive,
      ];
      if (!this.__snap || k.some((v, i) => v !== this.__snap[i])) {
        this.__snap = k;
        this.persist();
      }
    }
    componentWillUnmount() {
      this._unmounted = true;
      this._lifecycle++;
      this._bootVersion++;
      this._unsubscribeAuth?.();
      this.sync?.dispose?.();
      if (this._assistBridge && window.claude === this._assistBridge) delete window.claude;
      clearTimeout(this.tt);
      clearInterval(this.t);
      window.removeEventListener('keydown', this.onKey);
      if (this._onUnload) window.removeEventListener('beforeunload', this._onUnload);
      if (this._onVis) document.removeEventListener('visibilitychange', this._onVis);
    }
    async exportJson(withArchive = true) {
      try {
        localStorage.setItem(this.STORE_KEY + ':lastExport', new Date().toISOString());
      } catch (e) {}
      this.setState({ lastExport: new Date().toISOString() });
      let doc = this.serialize();
      if (this.sync && withArchive) {
        try {
          doc = { ...doc, journalArchive: await this.sync.journalArchive() };
        } catch (e) {
          this.flash('Archive du journal non récupérée — ' + (e && e.message ? e.message : e));
        }
      }
      const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'cosmos-' + daysAgo(0) + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      this.flash('Export JSON téléchargé');
    }
    importJson(file) {
      if (!file) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const d = JSON.parse(r.result);
          if (!(d && d.version === 1 && Array.isArray(d.cosmos) && Array.isArray(d.miniCosmos))) throw 0;
          this._replace = true;
          this._replaceArchive = valueChangeJournal(d.journalArchive);
          this.setState({
            cosmos: rangerParEtage(d.cosmos, d.etageDe || {}),
            etageDe: d.etageDe || {},
            etages: d.etages || {},
            titresEtages: normalizeFloorTitles(d.titresEtages),
            titresDe: d.titresDe || {},
            sections: d.sections || [],
            sectionDe: d.sectionDe || {},
            rows: migrate(d.miniCosmos),
            journal: valueChangeJournal(d.journal),
            journalArchive: this.sync ? [] : valueChangeJournal(d.journalArchive),
            journalArchived: valueChangeJournal(d.journalArchive).length,
            propositions: [],
          });
          this.logJ({
            type: 'donnees',
            detail: 'Import JSON — ' + d.miniCosmos.length + ' mini-cosmos, ' + d.cosmos.length + ' cosmos',
          });
          this.flash(d.miniCosmos.length + ' mini-cosmos importés');
        } catch (e) {
          this.flash('Fichier invalide');
        }
      };
      r.readAsText(file);
    }
    resetData() {
      this._replace = true;
      this._replaceArchive = [];
      this.setState({
        cosmos: ['ENTREPRISE', 'FAMILLE', 'RELATIONS', 'PERSONNEL'],
        etageDe: { ...SEED_ETAGES },
        etages: {},
        titresEtages: {},
        titresDe: {},
        sections: [],
        sectionDe: {},
        rows: SEED,
        journal: this.journalFromRows(SEED),
        journalArchive: [],
        journalArchived: 0,
        propositions: [],
        confirmReset: false,
      });
      this.logJ({ type: 'donnees', detail: 'Données d\u2019exemple restaurées' });
      this.flash('Données d\u2019exemple restaurées');
    }
    // Assistant IA : propositions (entropies, SAS, étapes, seuils) à partir du nom et de l'objectif — rien n'est appliqué sans clic
    async runAI(key, ctx) {
      if (!(window.claude && window.claude.complete)) {
        this.setState({ [key]: { error: 'Assistant indisponible dans cet environnement' } });
        return;
      }
      this.setState({ [key]: { loading: true } });
      try {
        const system =
          'Tu es l\u2019assistant de « Cosmos », une application de gouvernance personnelle. Un Cosmos est un grand domaine de vie ; un Mini-cosmos est un terrain précis gouverné à l\u2019intérieur, avec : un objectif ; une entropie (le danger concret qui le guette) ; une réponse à l\u2019entropie (la parade régulière, une action) ; un SAS (test d\u2019entrée borné — petite exposition, durée limitée, critère de réussite — avant d\u2019admettre le terrain) ; des étapes concrètes ; un seuil Alerte (signal de correction) et un seuil Kill (point de non-retour) ; un poids (vital, important ou normal) qui dit combien ce terrain pèse : pour un terrain vital, propose des seuils plus stricts et des étapes de sécurité d\u2019abord. Tu travailles en RELECTURE : l\u2019utilisateur a déjà écrit son mini-cosmos. Le nom et l\u2019objectif sont ta source de compréhension. Ses entropies, réponses, SAS, étapes et seuils sont le point de départ : ne les répète jamais, propose ce qu\u2019il n\u2019a pas vu, reformule en plus précis ce qui est vague (chiffre, fréquence, durée), et signale toute incohérence entre objectif, seuils et échéance. Réponds en français, concret, court, sans jargon ni conseil générique. Réponds UNIQUEMENT avec un JSON valide, sans texte autour : {"remarque":"…","entropies":[{"entropie":"…","reponse":"…"}],"sas":["…"],"etapes":["…"],"alerte":"…","kill":"…"} — remarque : 1 phrase (ou vide) sur ce qui cloche ou manque ; 3 entropies nouvelles ou affinées ; 2 SAS (bornés : durée en jours ou date de fin, montant, critère) ; jusqu\u2019à 5 étapes manquantes seulement ; alerte et kill : une version plus mesurable des siens, ou une proposition s\u2019ils sont vides. Chaque texte fait au plus 60 caractères.';
        const v = (x) => (x && x !== '—' ? x : '(vide)');
        const user =
          'Cosmos : ' +
          ctx.cosmos +
          '\nMini-cosmos : ' +
          ctx.name +
          '\nPoids : ' +
          POIDS_LABEL[ctx.poids || 'normal'] +
          '\nObjectif : ' +
          ctx.objectif +
          '\nValeur actuelle : ' +
          v(ctx.actuel) +
          '\n\nCe que l\u2019utilisateur a déjà écrit :\nEntropie : ' +
          v(ctx.entropie) +
          '\nRéponse à l\u2019entropie : ' +
          v(ctx.reponse) +
          '\nSAS : ' +
          v(ctx.sas) +
          '\nÉtapes : ' +
          ((ctx.etapes || []).length ? ctx.etapes.join(' · ') : '(aucune)') +
          '\nAlerte : ' +
          v(ctx.alerte) +
          '\nKill : ' +
          v(ctx.kill) +
          '\nClôture : ' +
          (ctx.cloture || '—');
        const txt = await window.claude.complete({
          system,
          messages: [{ role: 'user', content: user }],
          max_tokens: 1200,
        });
        const m = String(txt).match(/\{[\s\S]*\}/);
        const data = JSON.parse(m ? m[0] : txt);
        data.entropies = (data.entropies || []).slice(0, 3);
        data.sas = (data.sas || []).slice(0, 2);
        data.etapes = (data.etapes || []).slice(0, 5);
        data.remarque = (data.remarque || '').trim();
        this.setState({ [key]: { data } });
        this.logJ({
          type: 'donnees',
          mini: ctx.name,
          cosmos: ctx.cosmos,
          detail: 'Propositions IA générées',
        });
      } catch (e) {
        this.setState({ [key]: { error: 'Génération impossible — ' + (e && e.message ? e.message : e) } });
      }
    }
    aiVals(key, ctx, apply) {
      const a = this.state[key] || {};
      const d = a.data;
      const ready = !!(ctx.cosmos && (ctx.name || '').trim() && (ctx.objectif || '').trim());
      return {
        ready,
        notReady: !ready,
        loading: !!a.loading,
        error: a.error || '',
        hasError: !!a.error,
        has: !!d,
        idle: !d && !a.loading && !a.error,
        btnLabel: d ? 'Relire à nouveau' : 'Relire et proposer',
        btnOpacity: ready && !a.loading ? 1 : 0.4,
        run: () => {
          if (ready && !a.loading) this.runAI(key, ctx);
        },
        entropies: (d ? d.entropies : []).map((e) => ({
          entropie: e.entropie,
          reponse: e.reponse,
          use: () => apply({ entropie: e.entropie, reponse: e.reponse }),
        })),
        sas: (d ? d.sas : []).map((t) => ({ text: t, use: () => apply({ sas: t }) })),
        etapes: (d ? d.etapes : []).map((t) => ({ text: t, use: () => apply({ etape: t }) })),
        remarque: d ? d.remarque : '',
        hasRemarque: !!(d && d.remarque),
        alerte: d ? d.alerte : '',
        kill: d ? d.kill : '',
        useSeuils: () => d && apply({ alerte: d.alerte, kill: d.kill }),
        applyAll: () => {
          if (!d) return;
          apply({
            entropie: d.entropies[0] && d.entropies[0].entropie,
            reponse: d.entropies[0] && d.entropies[0].reponse,
            sas: d.sas[0],
            etapes: d.etapes,
            alerte: d.alerte,
            kill: d.kill,
          });
        },
      };
    }
    tick() {
      const d = new Date();
      const changed = refreshToday && refreshToday(d);
      this.setState({
        clock:
          d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) +
          ' · ' +
          d.toTimeString().slice(0, 5),
      });
      if (changed && this.state.ready) this.archiveOld();
      if (this.sync && this.state.ready && document?.visibilityState !== 'hidden') this.pollDb();
    }
    flash(msg) {
      this.setState({ toast: msg });
      clearTimeout(this.tt);
      this.tt = setTimeout(() => this.setState({ toast: null }), 2600);
    }
    setField(k) {
      return (e) => this.setState((s) => ({ form: { ...s.form, [k]: e.target.value } }));
    }
    // Seule une modification réelle de la valeur actuelle est journalisée.
    logJ(event) {
      const e = valueChangeEvent(event);
      if (!e) return;
      this.setState((s) => ({
        journal: [
          {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            t: new Date().toISOString(),
            author: this.props.author ?? 'Toi',
            ...e,
          },
          ...(s.journal || []),
        ],
      }));
    }
    miniChanges(before, after) {
      const labels = {
        name: 'Nom',
        cosmos: 'Cosmos',
        titre: 'Titre',
        poids: 'Poids',
        objectif: 'Objectif',
        actuel: 'Valeur actuelle',
        sas: 'SAS',
        sasUntil: 'Fin du test',
        entropie: 'Entropie',
        reponse: 'Réponse entropie',
        alerte: 'Alerte',
        kill: 'Kill',
        startAt: 'Début',
        cloture: 'Clôture',
        alertDays: 'Préavis',
      };
      const fmt = (k, v) =>
        k === 'cloture'
          ? clotureLabel(v)
          : k === 'startAt' || k === 'sasUntil'
            ? fmtFR(v || '')
            : k === 'poids'
              ? POIDS_LABEL[v] || 'Normal'
              : (v ?? '');
      const changes = Object.keys(labels)
        .filter((k) =>
          k === 'poids' ? poidsOf(before) !== poidsOf(after) : (before[k] ?? '') !== (after[k] ?? ''),
        )
        .map((k) => ({ field: labels[k], before: fmt(k, before[k]), after: fmt(k, after[k]) }));
      const steps = (x) => (x.actions || []).map((a) => a.text);
      if (JSON.stringify(steps(before)) !== JSON.stringify(steps(after)))
        changes.push({ field: 'Étapes', before: steps(before).join('\n'), after: steps(after).join('\n') });
      return changes;
    }
    update(id, patch, ev) {
      const row = this.state.rows.find((x) => x.id === id);
      if (!row) return false;
      const current = this.state.editing && this.state.editDraft?.id === id ? this.state.editDraft : row;
      if (isDraft(current) && patch.pause === false) {
        const error = validateMini({ ...current, ...patch }, this.state.rows);
        if (error) {
          this.setState({ editError: error });
          this.flash('À compléter avant de reprendre : ' + error);
          return false;
        }
        patch = { ...patch, draft: false };
      }
      if (this.state.editing && this.state.editDraft?.id === id) {
        this.setState((s) => ({
          editDraft: { ...s.editDraft, ...patch },
          editError: '',
        }));
        return true;
      }
      const after = { ...row, ...patch };
      const entry = this.valueEntry(row, after);
      this.setState((s) => ({
        rows: s.rows.map((x) => (x.id === id ? after : x)),
        ...(entry ? { journal: [entry, ...(s.journal || [])] } : {}),
        editError: '',
      }));
      return true;
    }
    deleteMini(id) {
      const s = this.state;
      if (!s.ready || s.syncRefreshing || s.needsLogin) return false;
      const row = s.rows.find((item) => item.id === id);
      if (!row) return false;
      this.setState((st) => ({
        rows: st.rows
          .filter((item) => item.id !== id)
          .map((item) =>
            Array.isArray(item.dependDe) && item.dependDe.includes(id)
              ? { ...item, dependDe: item.dependDe.filter((dependency) => dependency !== id) }
              : item,
          ),
        ...(st.selected === id
          ? { selected: null, confirmDeleteMini: false, editing: false, editDraft: null, editSnap: null }
          : {}),
        ...(st.miniNameEditId === id ? { miniNameEditId: null } : {}),
      }));
      this.flash(row.name + ' supprimé');
      return true;
    }
    renameMini(id, raw) {
      const s = this.state;
      if (!s.ready || s.syncRefreshing || s.needsLogin || s.editing)
        return 'La modification est momentanément indisponible.';
      const row = s.rows.find((item) => item.id === id);
      if (!row) return 'Ce mini-cosmos n’existe plus.';
      const name = raw.trim();
      if (!name) return 'Le nom est obligatoire.';
      if (
        s.rows.some(
          (item) =>
            item.id !== id &&
            item.cosmos === row.cosmos &&
            item.name.trim().toLowerCase() === name.toLowerCase(),
        )
      )
        return 'Ce nom existe déjà dans ce cosmos.';
      this.update(id, { name });
      return '';
    }
    setQuickName(cosmos, name) {
      this.setState((s) => ({ quickDrafts: { ...s.quickDrafts, [cosmos]: { name, error: '' } } }));
    }
    quickCreate(cosmos) {
      const s = this.state;
      if (!s.ready || s.syncRefreshing || s.needsLogin) return false;
      const name = (s.quickDrafts[cosmos]?.name || '').trim();
      const row = {
        id: 'mc-' + globalThis.crypto.randomUUID(),
        cosmos,
        name,
        draft: true,
        objectif: '',
        actuel: '',
        entropie: '',
        reponse: '',
        alerte: '',
        kill: '',
        sas: '',
        sasUntil: '',
        startAt: '',
        cloture: '',
        poids: 'normal',
        pause: true,
        closed: false,
        sasDone: false,
        alertDays: 7,
        actions: [],
        history: [],
        createdAt: daysAgo(0),
      };
      const error = !s.cosmos.includes(cosmos) ? 'Ce cosmos n’existe plus.' : validateMini(row, s.rows);
      if (error) {
        this.setState((st) => ({
          quickDrafts: { ...st.quickDrafts, [cosmos]: { name: st.quickDrafts[cosmos]?.name || '', error } },
        }));
        return false;
      }
      const titre = this.titresOf(cosmos).at(-1);
      if (titre) row.titre = titre;
      this.setState((st) => ({
        rows: [...st.rows, row],
        quickDrafts: { ...st.quickDrafts, [cosmos]: { name: '', error: '' } },
      }));
      this.flash(name + ' créé en pause — à compléter');
      return true;
    }
    valueEntry(before, after) {
      return valueChangeEvent({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        t: new Date().toISOString(),
        author: this.props.author ?? 'Toi',
        type: 'modification',
        mini: after.name,
        miniId: after.id,
        cosmos: after.cosmos,
        changes: [{ field: 'Valeur actuelle', before: before.actuel ?? '', after: after.actuel ?? '' }],
      });
    }
    beginEdit(id) {
      const row = this.state.rows.find((x) => x.id === id);
      if (!row) return;
      this.setState({
        editing: true,
        editSnap: JSON.parse(JSON.stringify(row)),
        editDraft: JSON.parse(JSON.stringify(row)),
        editEvents: [],
        editError: '',
      });
    }
    cancelMiniEdit() {
      this.setState({ editing: false, editSnap: null, editDraft: null, editEvents: [], editError: '' });
    }
    finishEdit() {
      const s = this.state;
      if (!s.editing) return true;
      const row = s.editDraft,
        snap = s.editSnap;
      if (!row || !snap) {
        this.cancelMiniEdit();
        return true;
      }
      if (JSON.stringify(row) === JSON.stringify(snap)) {
        this.cancelMiniEdit();
        return true;
      }
      const error = validateMini(row, s.rows);
      if (error) {
        this.setState({ editError: error });
        return false;
      }
      const entry = this.valueEntry(snap, row);
      this.setState((st) => ({
        rows: st.rows.map((x) => (x.id === row.id ? { ...row, name: row.name.trim() } : x)),
        ...(entry ? { journal: [entry, ...(st.journal || [])] } : {}),
        editing: false,
        editSnap: null,
        editDraft: null,
        editEvents: [],
        editError: '',
      }));
      return true;
    }
    navigate(patch) {
      if (!this.finishEdit()) return false;
      this.setState(patch);
      return true;
    }
    journalFromRows() {
      // L'exemple et les anciennes fiches ne recréent aucun événement historique.
      return [];
    }
    renameCosmos(name, raw) {
      const n = (raw || '').trim().toUpperCase();
      if (!this.state.cosmos.includes(name)) return { name: null, error: 'Ce cosmos n’existe plus.' };
      if (!n) return { name: null, error: 'Saisis un nom pour le cosmos.' };
      if (this.state.cosmos.some((c) => c !== name && c.toUpperCase() === n))
        return { name: null, error: 'Ce nom de cosmos existe déjà.' };
      if (n === name) return { name: n, error: '' };
      this.setState((st) => {
        const etageDe = { ...(st.etageDe || {}) };
        const titresDe = { ...(st.titresDe || {}) };
        if (Object.hasOwn(etageDe, name)) etageDe[n] = etageDe[name];
        if (Object.hasOwn(titresDe, name)) titresDe[n] = titresDe[name];
        delete etageDe[name];
        delete titresDe[name];
        return {
          cosmos: st.cosmos.map((c) => (c === name ? n : c)),
          rows: st.rows.map((x) => (x.cosmos === name ? { ...x, cosmos: n } : x)),
          sectionDe: { ...st.sectionDe, [n]: st.sectionDe[name], [name]: undefined },
          quickDrafts: Object.fromEntries(
            Object.entries(st.quickDrafts).map(([key, draft]) => [key === name ? n : key, draft]),
          ),
          etageDe,
          titresDe,
        };
      });
      this.logJ({ type: 'cosmos', cosmos: n, detail: 'Cosmos renommé : ' + name + ' → ' + n });
      this.flash(name + ' renommé en ' + n);
      return { name: n, error: '' };
    }
    deleteCosmos(name) {
      if (!this.state.cosmos.includes(name)) return false;
      const count = this.state.rows.filter((x) => x.cosmos === name).length;
      this.setState((st) => {
        const etageDe = { ...(st.etageDe || {}) };
        const titresDe = { ...(st.titresDe || {}) };
        delete etageDe[name];
        delete titresDe[name];
        const selectedRemoved = st.rows.some((x) => x.cosmos === name && x.id === st.selected);
        return {
          cosmos: st.cosmos.filter((c) => c !== name),
          rows: st.rows.filter((x) => x.cosmos !== name),
          etageDe,
          titresDe,
          ...(selectedRemoved
            ? {
                selected: null,
                editing: false,
                editDraft: null,
                editSnap: null,
                editEvents: [],
                editError: '',
              }
            : {}),
        };
      });
      this.logJ({ type: 'cosmos', cosmos: name, detail: 'Cosmos supprimé avec ' + count + ' mini-cosmos' });
      this.flash('Cosmos ' + name + ' supprimé');
      return true;
    }
    // drag & drop — lignes (dans ou entre cosmos) et cartes cosmos
    // titres : des séparations dans une pièce — liste ordonnée par cosmos (titresDe), titre du terrain dans data.titre
    titresOf(cosmos) {
      const t = (this.state.titresDe || {})[cosmos];
      return Array.isArray(t) ? t : [];
    }
    setTitres(cosmos, list) {
      this.setState((st) => ({ titresDe: { ...(st.titresDe || {}), [cosmos]: list } }));
    }
    creerTitre(cosmos, raw) {
      const name = (raw || '').trim().slice(0, 60);
      if (!name) return false;
      const L = this.titresOf(cosmos);
      if (L.some((t) => t.toLowerCase() === name.toLowerCase())) {
        this.flash('Ce titre existe déjà dans ' + cosmos);
        return false;
      }
      this.setTitres(cosmos, [...L, name]);
      this.logJ({ type: 'cosmos', cosmos, detail: 'Titre « ' + name + ' » créé' });
      this.flash('Titre ' + name + ' créé — glisse des terrains dessous');
      return true;
    }
    renommerTitre(cosmos, oldName, raw) {
      const name = (raw || '').trim();
      const L = this.titresOf(cosmos);
      const names = [
        ...L,
        ...this.state.rows.filter((x) => x.cosmos === cosmos && x.titre).map((x) => x.titre),
      ];
      if (!this.state.cosmos.includes(cosmos) || !names.includes(oldName) || !name || name.length > 60)
        return false;
      if (name === oldName) return true;
      if (names.some((t) => t !== oldName && t.toLowerCase() === name.toLowerCase())) {
        this.flash('Ce titre existe déjà');
        return false;
      }
      this.setState((st) => ({
        titresDe: {
          ...(st.titresDe || {}),
          [cosmos]: L.includes(oldName) ? L.map((t) => (t === oldName ? name : t)) : [...L, name],
        },
        rows: st.rows.map((x) => (x.cosmos === cosmos && x.titre === oldName ? { ...x, titre: name } : x)),
      }));
      this.logJ({ type: 'cosmos', cosmos, detail: 'Titre renommé : ' + oldName + ' → ' + name });
      return true;
    }
    supprimerTitre(cosmos, name) {
      const n = this.state.rows.filter((x) => x.cosmos === cosmos && x.titre === name).length;
      const L = this.titresOf(cosmos);
      if (!this.state.cosmos.includes(cosmos) || (!L.includes(name) && !n)) return false;
      this.setState((st) => ({
        titresDe: { ...(st.titresDe || {}), [cosmos]: L.filter((t) => t !== name) },
        rows: st.rows.map((x) => {
          if (x.cosmos === cosmos && x.titre === name) {
            const y = { ...x };
            delete y.titre;
            return y;
          }
          return x;
        }),
      }));
      this.logJ({
        type: 'cosmos',
        cosmos,
        detail:
          'Titre « ' +
          name +
          ' » supprimé' +
          (n ? ' (' + n + ' terrain' + (n > 1 ? 's' : '') + ' sans titre)' : ''),
      });
      this.flash('Titre ' + name + ' supprimé, les terrains restent');
      return true;
    }
    // ranger un terrain sous un titre de sa pièce, ou l'en sortir (titre vide)
    rangerSous(id, titre) {
      const row =
        this.state.editing && this.state.editDraft?.id === id
          ? this.state.editDraft
          : this.state.rows.find((x) => x.id === id);
      if (!row) return;
      const cur = row.titre || '';
      if (cur === (titre || '')) return;
      this.update(
        id,
        { titre: titre || undefined },
        { type: 'deplacement', detail: titre ? 'Rangé sous « ' + titre + ' »' : 'Sorti de « ' + cur + ' »' },
      );
    }
    // déposée sur la ligne d'un titre : le terrain rejoint la fin de la pièce, sous ce titre
    deposerSurTitre(dragId, cosmos, titre) {
      const item0 = this.state.rows.find((x) => x.id === dragId);
      if (!item0) return;
      this.setState((st) => {
        const rows = [...st.rows];
        const from = rows.findIndex((x) => x.id === dragId);
        if (from < 0) return {};
        const [item] = rows.splice(from, 1);
        const np = { ...item, cosmos, titre };
        const last = rows.map((x) => x.cosmos).lastIndexOf(cosmos);
        rows.splice(last + 1, 0, np);
        return { rows };
      });
      if (item0.cosmos !== cosmos)
        this.logJ({
          type: 'deplacement',
          mini: item0.name,
          miniId: item0.id,
          cosmos,
          detail: 'Cosmos parent : ' + item0.cosmos + ' → ' + cosmos,
        });
      if ((item0.titre || '') !== titre)
        this.logJ({
          type: 'deplacement',
          mini: item0.name,
          miniId: item0.id,
          cosmos,
          detail: 'Rangé sous « ' + titre + ' »',
        });
    }
    // déposée sur une ligne : elle prend sa place et son titre ; déposée sur la pièce : fin de pièce, sans titre
    moveRow(dragId, targetId, cosmos, placement = 'before') {
      if (dragId === targetId) return;
      const S = this.state;
      const item0 = S.rows.find((x) => x.id === dragId);
      if (!item0) return;
      const target = targetId ? S.rows.find((x) => x.id === targetId) : null;
      const titre = target && target.cosmos === cosmos ? target.titre || '' : '';
      this.setState((s) => {
        const rows = [...s.rows];
        const from = rows.findIndex((x) => x.id === dragId);
        if (from < 0) return {};
        const [item] = rows.splice(from, 1);
        if (item.cosmos !== cosmos)
          setTimeout(
            () =>
              this.logJ({
                type: 'deplacement',
                mini: item.name,
                miniId: item.id,
                cosmos,
                detail: 'Cosmos parent : ' + item.cosmos + ' → ' + cosmos,
              }),
            0,
          );
        const np = { ...item, cosmos };
        if (titre) np.titre = titre;
        else delete np.titre;
        const to = targetId ? rows.findIndex((x) => x.id === targetId) : -1;
        if (to < 0) {
          const last = rows.map((x) => x.cosmos).lastIndexOf(cosmos);
          rows.splice(last + 1, 0, np);
        } else rows.splice(to + (placement === 'after' ? 1 : 0), 0, np);
        return { rows };
      });
      if (item0.cosmos === cosmos && (item0.titre || '') !== titre)
        this.logJ({
          type: 'deplacement',
          mini: item0.name,
          miniId: item0.id,
          cosmos,
          detail: titre ? 'Rangé sous « ' + titre + ' »' : 'Sorti de « ' + item0.titre + ' »',
        });
    }
    renameFloor(id, raw) {
      const s = this.state;
      if (!s.ready || s.syncRefreshing || s.needsLogin || !COSMOS_FLOORS.some((floor) => floor.id === id))
        return false;
      const title = typeof raw === 'string' ? raw.trim() : '';
      if (!title || title.length > FLOOR_TITLE_MAX_LENGTH) return false;
      if (floorTitle(s.titresEtages, id) === title) return true;
      this.setState({ titresEtages: { ...s.titresEtages, [id]: title } });
      this.flash('Titre de l’espace modifié');
      return true;
    }
    etageOf(name) {
      return etageDeNom(this.state.etageDe, name);
    }
    /** @param {string} raw @param {string | null} sectionId */
    creerCosmos(raw, sectionId = null) {
      if (!this.state.ready || this.state.syncRefreshing || this.state.needsLogin) return false;
      const section = sectionId ? this.state.sections.find((group) => group.id === sectionId) : null;
      if (sectionId && !section) return false;
      const n = (raw || '').trim().toUpperCase();
      if (!n || this.state.cosmos.some((name) => name.toUpperCase() === n)) return false;
      const et = section?.etage || this.state.newEtage || 'logos';
      this.setState((st) => {
        const E = { ...(st.etageDe || {}), [n]: et };
        const firstInGroup = section
          ? st.cosmos.findIndex((name) => st.sectionDe[name] === section.id && etageDeNom(E, name) === et)
          : -1;
        const cosmos = firstInGroup < 0 ? placerEnFinEtage(st.cosmos, n, et, E) : [...st.cosmos];
        if (firstInGroup >= 0) cosmos.splice(firstInGroup, 0, n);
        return {
          cosmos,
          ...(section ? { sectionDe: { ...st.sectionDe, [n]: section.id } } : {}),
          etageDe: E,
          showCosmosModal: false,
          createdCosmos: n,
        };
      });
      this.logJ({ type: 'cosmos', cosmos: n, detail: 'Cosmos créé · étage ' + ETAGE_LABEL[et] });
      this.flash('Cosmos ' + n + ' créé dans ' + (section?.name || ETAGE_LABEL[et]));
      return true;
    }
    // déposer une pièce sur une autre : elle prend sa place et son étage (glisser-déposer libre entre étages)
    moveCosmos(dragName, targetName, placement = 'auto') {
      if (dragName === targetName) return;
      const from = this.etageOf(dragName),
        to = this.etageOf(targetName);
      this.setState((s) => {
        const c = [...s.cosmos];
        const i = c.indexOf(dragName),
          j = c.indexOf(targetName);
        if (i < 0 || j < 0) return {};
        c.splice(i, 1);
        const target = placement === 'auto' ? j : c.indexOf(targetName) + (placement === 'after' ? 1 : 0);
        c.splice(target, 0, dragName);
        return {
          cosmos: c,
          etageDe: { ...(s.etageDe || {}), [dragName]: to },
          sectionDe: { ...s.sectionDe, [dragName]: s.sectionDe[targetName] },
        };
      });
      if (from !== to)
        this.logJ({
          type: 'cosmos',
          cosmos: dragName,
          detail: 'Étage : ' + ETAGE_LABEL[from] + ' → ' + ETAGE_LABEL[to],
        });
    }
    // déposer une pièce sur l'en-tête (ou la zone vide) d'un étage : elle rejoint la fin de cet étage
    moveCosmosToEtage(name, etage) {
      const from = this.etageOf(name);
      this.setState((s) => {
        const E = { ...(s.etageDe || {}), [name]: etage };
        return {
          cosmos: placerEnFinEtage(s.cosmos, name, etage, E),
          etageDe: E,
          sectionDe: { ...s.sectionDe, [name]: undefined },
        };
      });
      if (from !== etage)
        this.logJ({
          type: 'cosmos',
          cosmos: name,
          detail: 'Étage : ' + ETAGE_LABEL[from] + ' → ' + ETAGE_LABEL[etage],
        });
    }
    saveSection(draft = this.state.editSection) {
      if (!draft) return false;
      if (draft.id && !this.state.sections.some((section) => section.id === draft.id)) {
        this.setState({ sectionError: 'Ce groupe n’existe plus.' });
        return false;
      }
      const name = draft.name.trim();
      if (!name || name.length > 60) {
        this.setState({ sectionError: 'Choisis un nom de 1 à 60 caractères.' });
        return false;
      }
      if (
        this.state.sections.some(
          (x) => x.id !== draft.id && x.etage === draft.etage && x.name.toLowerCase() === name.toLowerCase(),
        )
      ) {
        this.setState({ sectionError: 'Ce nom existe déjà dans cet étage.' });
        return false;
      }
      const section = { id: draft.id || 'sec-' + globalThis.crypto.randomUUID(), etage: draft.etage, name };
      this.setState((s) => ({
        sections: draft.id
          ? s.sections.map((x) => (x.id === draft.id ? section : x))
          : [section, ...s.sections],
        editSection: null,
        sectionError: '',
      }));
      return true;
    }
    deleteSection(id) {
      this.setState((s) => ({
        sections: s.sections.filter((x) => x.id !== id),
        editSection: null,
      }));
      this.flash('Séparation supprimée, cosmos conservés dans leur étage');
    }
    assignSection(name, id) {
      const section = this.state.sections.find((x) => x.id === id);
      if (!this.state.cosmos.includes(name) || (id && !section)) return;
      this.setState((s) => ({
        cosmos: [...s.cosmos.filter((n) => n !== name), name],
        etageDe: { ...s.etageDe, [name]: section?.etage || this.etageOf(name) },
        sectionDe: { ...s.sectionDe, [name]: id || undefined },
      }));
    }
    moveSection(id, targetId, placement = 'auto') {
      this.setState((s) => {
        const a = s.sections.findIndex((x) => x.id === id),
          b = s.sections.findIndex((x) => x.id === targetId);
        if (a < 0 || b < 0 || a === b || s.sections[a].etage !== s.sections[b].etage) return {};
        const sections = [...s.sections];
        const [section] = sections.splice(a, 1);
        const target =
          placement === 'auto'
            ? b
            : sections.findIndex((x) => x.id === targetId) + (placement === 'after' ? 1 : 0);
        sections.splice(target, 0, section);
        return { sections };
      });
    }
    decorate(x) {
      const statut = statutOf(x);
      const st = STATUT_STYLE[statut];

      const noDate = isDraft(x) && !resolveCloture(x.closed ? x.closedAt || x.cloture : x.cloture);
      const c = noDate
        ? { label: '—', short: '—', mandat: false }
        : clotureInfo(x.closed ? x.closedAt || x.cloture : x.cloture);
      let entropie = x.entropie,
        reponse = x.reponse;
      if (reponse == null && / → /.test(entropie || '')) {
        const p = entropie.split(' → ');
        entropie = p[0];
        reponse = p[1];
      }
      const pj = projectionOf(x);
      const su = pj.sas ? echeanceEffective(x).iso : null;
      const sasPending = hasSas(x) && !x.sasDone;
      const thenLabel = su
        ? pj.finalPermanent
          ? 'puis objectif continu (∞)'
          : 'puis échéance finale : ' +
            c.label +
            (pj.finalDays != null
              ? ' (' + (pj.finalDays < 0 ? '-' + -pj.finalDays : '+' + pj.finalDays) + ' j)'
              : '')
        : '';
      return {
        ...x,
        statut,
        entropie,
        reponse: reponse || '—',
        actuel: x.actuel || '—',
        cloture: su ? fmtFR(su) : c.label,
        clotureShort: su ? fmtFR(su) : c.short,
        clotureIsSas: !!su,
        clotureFinal: c.label,
        clotureColor: st[0],
        poids: poidsOf(x),
        poidsLabel: POIDS_LABEL[poidsOf(x)],
        poidsBg: POIDS_DOT[poidsOf(x)].bg,
        poidsBorder: POIDS_DOT[poidsOf(x)].border,
        poidsGlow: POIDS_DOT[poidsOf(x)].glow,
        poidsTitle: 'Poids : ' + POIDS_LABEL[poidsOf(x)].toLowerCase() + ' — cliquer pour changer',
        cyclePoids: (ev) => {
          ev.stopPropagation();
          this.cyclePoids(x);
        },
        sasUntil: sasUntilOf(x) || '',
        sasUntilLabel: sasUntilOf(x) ? fmtFR(sasUntilOf(x)) : '',
        projIsSas: !!pj.sas,
        projPreavisLabel: pj.sas
          ? 'bleu tout le temps du test, rouge s\u2019il est dépassé'
          : 'tension à ' + (pj.preavis != null ? pj.preavis : alertDaysOf(x)) + ' j',
        projThen: thenLabel,
        hasSas: hasSas(x),
        sasPending,
        sas: x.sas || '',
        statutColor: st[0],
        statutBg: st[1],
        isPermanent: pj.permanent && !pj.undated,
        isDated: !pj.permanent,
        projPct: (pj.pct || 0) + '%',
        projColor: pj.color,
        projLabel: pj.label || '',
        projDays: pj.permanent ? null : pj.days,
        projZoneLabel: pj.zoneLabel,
        alertDays: alertDaysOf(x),
        projRange: pj.permanent
          ? ''
          : (su ? 'test du ' : c.mandat ? 'mandat du ' : 'du ') +
            (startOf(x) || daysAgo(0)).split('-').reverse().join('/') +
            ' au ' +
            (su ? fmtFR(su) : c.mandat ? fmtFR(resolveCloture(x.cloture)) : c.label),
        startLabel: startOf(x) ? fmtFR(startOf(x)) : isDraft(x) ? '—' : fmtFR(daysAgo(0)),
        startDate: startOf(x) || (isDraft(x) ? '' : daysAgo(0)),
        notStarted: notStarted(x),
        alerte: x.alerte,
        kill: x.kill,
        open: () =>
          this.navigate({ selected: x.id, confirmDeleteMini: false, editing: false, aiDetail: null }),
        titre: x.titre || '',
      };
    }
    // Une même sélection pour la liste, les compteurs et les comparaisons ; les jours suivent le fuseau du navigateur.
    journalContext() {
      const s = this.state,
        tf = s.jType || 'Tous',
        ja = s.jAuthor || 'Tous',
        jp = s.jPeriod || 0,
        q = (s.jQuery || '').trim().toLowerCase();
      const text = (v) => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v));
      const events = (s.journal || [])
        .map((e) => {
          const dt = new Date(e.t),
            stamp = dt.getTime();
          const changeLines = (Array.isArray(e.changes) ? e.changes : [])
            .filter((c) => c && typeof c === 'object')
            .map((c) => ({ field: text(c.field), before: text(c.before), after: text(c.after) }));
          return {
            ...e,
            author: e.author || '—',
            stamp,
            day: Number.isFinite(stamp) ? isoD(dt) : '',
            changeLines,
            search: [
              e.mini,
              e.cosmos,
              e.detail,
              e.author,
              ...changeLines.flatMap((c) => [c.field, c.before, c.after]),
            ]
              .join(' ')
              .toLowerCase(),
          };
        })
        .sort(
          (a, b) =>
            (Number.isFinite(b.stamp) ? b.stamp : -Infinity) -
            (Number.isFinite(a.stamp) ? a.stamp : -Infinity),
        );
      const midnight = (n) => new Date(daysAgo(n) + 'T00:00:00').getTime();
      const from = jp ? midnight(jp - 1) : -Infinity,
        prevFrom = jp ? midnight(2 * jp - 1) : -Infinity,
        end = midnight(-1);
      const select = ({ type = tf, author = ja, previous = false } = {}) =>
        events.filter(
          (e) =>
            (type === 'Tous' || e.type === type) &&
            (author === 'Tous' || e.author === author) &&
            (!q || e.search.includes(q)) &&
            (!jp || (previous ? e.stamp >= prevFrom && e.stamp < from : e.stamp >= from && e.stamp < end)),
        );
      return { events, select, tf, ja, jp, q };
    }
    journalVals() {
      const s = this.state;
      if ((s.view || 'table') !== 'journal') return {};
      const { events: J, select, tf, ja, jp, q } = this.journalContext();
      const TYPES = {
        creation: ['Création', '#34d399'],
        statut: ['Statut', '#818cf8'],
        etape: ['Étape', '#22d3ee'],
        modification: ['Modification', '#d4d4d8'],
        deplacement: ['Déplacement', '#c084fc'],
        suppression: ['Suppression', '#fb7185'],
        cosmos: ['Cosmos', '#fafafa'],
        donnees: ['Données', '#71717a'],
        proposition: ['Proposition', '#c084fc'],
        note: ['Note', '#22d3ee'],
      };
      const list = select();
      const periodChips = [
        [0, 'Tout'],
        [7, '7 j'],
        [30, '30 j'],
        [90, '90 j'],
      ].map(([d, label]) => ({
        label,
        ...(jp === d ? chipOn : chipOff),
        onClick: () => this.setState({ jPeriod: d, jPage: 0 }),
      }));
      const authors = [...new Set([...J.map((e) => e.author), ...(ja !== 'Tous' ? [ja] : [])])];
      const authorChips = ['Tous', ...authors.filter((a) => a !== 'Tous')].map((a) => ({
        label: a,
        ...(ja === a ? chipOn : chipOff),
        count: select({ author: a }).length,
        onClick: () => this.setState({ jAuthor: a, jPage: 0 }),
      }));
      const PAGE = 50;
      const pages = Math.max(1, Math.ceil(list.length / PAGE));
      const page = Math.max(0, Math.min(s.jPage || 0, pages - 1));
      const slice = list.slice(page * PAGE, (page + 1) * PAGE);
      const ids = new Set(s.rows.map((x) => x.id));
      const typeChips = [
        ['Tous', 'Tous', null],
        ...Object.keys(TYPES).map((k) => [k, TYPES[k][0], TYPES[k][1]]),
      ].map(([k, label, dot]) => ({
        label,
        dot: dot || 'transparent',
        dotW: dot ? '6px' : '0px',
        ...(tf === k ? chipOn : chipOff),
        count: select({ type: k }).length,
        onClick: () => this.setState({ jType: k, jPage: 0 }),
      }));
      const today = daysAgo(0),
        yest = daysAgo(1);
      const MOIS = [
        'janv.',
        'févr.',
        'mars',
        'avr.',
        'mai',
        'juin',
        'juil.',
        'août',
        'sept.',
        'oct.',
        'nov.',
        'déc.',
      ];
      const dayLabel = (d) =>
        !d
          ? 'Date inconnue'
          : d === today
            ? 'Aujourd’hui'
            : d === yest
              ? 'Hier'
              : +d.slice(8, 10) + ' ' + MOIS[+d.slice(5, 7) - 1] + ' ' + d.slice(0, 4);
      const groups = [];
      slice.forEach((e) => {
        const dt = new Date(e.stamp),
          d = e.day;
        const time = d
          ? String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0')
          : '—';
        let g = groups[groups.length - 1];
        if (!g || g.day !== d) {
          g = { day: d, label: dayLabel(d), items: [] };
          groups.push(g);
        }
        // Le nom peut être réutilisé : seul l'identifiant relie une entrée à sa fiche.
        const ty = TYPES[e.type] || [e.type, '#a1a1aa'];
        const mid = e.miniId && ids.has(e.miniId) && e.type !== 'suppression' ? e.miniId : null;
        const linkable = !!mid;
        g.items.push({
          ...e,
          time,
          typeLabel: ty[0],
          typeColor: ty[1],
          hasMini: !!e.mini,
          mini: e.mini || '',
          cosmos: e.cosmos || '',
          linkable,
          unlinked: !linkable,
          hasChanges: e.changeLines.length > 0,
          changeLines: e.changeLines.map((c) => ({ ...c, before: c.before || '—', after: c.after || '—' })),
          openLabel: linkable
            ? 'Ouvrir ' + e.mini + ' — ' + e.cosmos
            : (e.mini || '') + ' — fiche indisponible',
          miniHint: linkable ? 'Ouvrir le mini-cosmos' : 'Fiche indisponible',
          miniColor: linkable ? '#fafafa' : '#a1a1aa',
          miniCursor: linkable ? 'pointer' : 'default',
          openMini: () => {
            if (linkable)
              this.navigate({ view: 'table', selected: mid, editing: false, confirmDeleteMini: false });
          },
          authorColor: e.author === 'Toi' ? '#fafafa' : e.author === 'Exemple' ? '#52525b' : '#c084fc',
        });
      });
      groups.forEach((g) => (g.count = g.items.length));
      return {
        jGroups: groups,
        jEmpty: groups.length === 0,
        jTypeChips: typeChips,
        jPeriodChips: periodChips,
        jAuthorChips: authorChips,
        jArchived: this.sync ? s.journalArchived || 0 : (s.journalArchive || []).length,
        jHasArchive: (this.sync ? s.journalArchived || 0 : (s.journalArchive || []).length) > 0,
        jQuery: s.jQuery || '',
        setJQuery: (e) => this.setState({ jQuery: e.target.value, jPage: 0 }),
        jTotal: J.length,
        jShown: list.length,
        jHasFilters: tf !== 'Tous' || ja !== 'Tous' || !!jp || !!q,
        resetJournalFilters: () =>
          this.setState({ jType: 'Tous', jAuthor: 'Tous', jPeriod: 0, jQuery: '', jPage: 0 }),
        jPageLabel: 'Page ' + (page + 1) + ' / ' + pages,
        jRange: list.length ? page * PAGE + 1 + '–' + Math.min(list.length, (page + 1) * PAGE) : '0',
        jHasPrev: page > 0,
        jHasNext: page < pages - 1,
        jMultiPage: pages > 1,
        jPrevDisabled: page === 0,
        jNextDisabled: page === pages - 1,
        jPrev: () => this.setState({ jPage: Math.max(0, page - 1) }),
        jNext: () => this.setState({ jPage: Math.min(pages - 1, page + 1) }),
        jFirst: () => this.setState({ jPage: 0 }),
        jLast: () => this.setState({ jPage: pages - 1 }),
        jPrevColor: page > 0 ? '#f4f4f5' : '#3f3f46',
        jNextColor: page < pages - 1 ? '#f4f4f5' : '#3f3f46',
      };
    }
    // filtres de temps, communs aux pages Cosmos et Échéances : délai (7 / 30 / 90 j), trimestre, mois, année de l'échéance effective
    setPeriodFilter(kind, value) {
      this.setState((s) => {
        if (kind === 'year') return { yearFilter: value, monthFilter: '', quarterFilter: '' };
        return {
          [kind + 'Filter']: value,
          [kind === 'month' ? 'quarterFilter' : 'monthFilter']: '',
          ...(value && s.yearFilter ? { yearFilter: value.slice(0, 4) } : {}),
        };
      });
    }
    timeFilter() {
      const s = this.state;
      const tf = s.timeFilter || 0,
        mf = s.monthFilter || '',
        yf = s.yearFilter || '',
        qf = typeof s.quarterFilter === 'string' ? s.quarterFilter : '';
      const isoOf = (x) => echeanceEffective(x).iso,
        joursAvant = (x) => {
          const c = isoOf(x);
          return c ? Math.round((new Date(c + 'T00:00:00') - TODAY) / 86400000) : null;
        };
      const trimestre = (c) => c.slice(0, 4) + '-Q' + (Math.floor((+c.slice(5, 7) - 1) / 3) + 1);
      const dansPeriode = (x) => {
        if (!mf && !yf && !qf) return true;
        const c = isoOf(x);
        if (!c) return false;
        return (!yf || c.slice(0, 4) === yf) && (!mf || c.slice(0, 7) === mf) && (!qf || trimestre(c) === qf);
      };
      // Un délai court couvre aujourd'hui et les jours à venir. Les retards restent accessibles avec « Tous ».
      const inTime = (x, delay = tf) => {
        if (!delay) return dansPeriode(x);
        const d = joursAvant(x);
        return d != null && d >= 0 && d <= delay && dansPeriode(x);
      };
      return { tf, mf, yf, qf, joursAvant, inTime, any: !!(tf || mf || yf || qf) };
    }
    // page Échéances : tout ce qui a une date, de la plus proche à la plus lointaine, SAS et mandats compris — l'axe du temps vit ici
    echeancesVals() {
      const s = this.state;
      if ((s.view || 'table') !== 'echeances') return {};
      const rows = s.rows.filter((x) => !x.closed && !x.pause).map((x) => ({ ...x, statut: statutOf(x) }));
      const live = rows.map((x) => ({ x, p: projectionOf(x) })).filter((o) => !o.p.permanent);
      const T = this.timeFilter();
      const tf = T.tf,
        dansDelai = T.inTime,
        zf = s.echZone || 'Tous';
      const eq = (s.eQuery || '').trim().toLowerCase();
      const matchEq = (x) =>
        !eq || [x.name, x.cosmos, x.actuel, x.objectif].join(' ').toLowerCase().includes(eq);
      const searched = live.filter((o) => matchEq(o.x));
      const zoneBase = searched.filter((o) => dansDelai(o.x));
      const inZone = (o) => zf === 'Tous' || o.p.zone === zf;
      const shown = zoneBase
        .filter(inZone)
        .sort(
          (a, b) =>
            a.p.days - b.p.days || (POIDS_ORDER[poidsOf(a.x)] ?? 2) - (POIDS_ORDER[poidsOf(b.x)] ?? 2),
        );
      const echeances = shown.map(({ x, p }) => ({
        id: x.id,
        name: x.name,
        openLabel: 'Ouvrir ' + x.name + ' — ' + x.cosmos,
        poidsBg: POIDS_DOT[poidsOf(x)].bg,
        poidsBorder: POIDS_DOT[poidsOf(x)].border,
        cosmos: x.cosmos,
        cosmosColor: COLORS[Math.max(0, s.cosmos.indexOf(x.cosmos)) % COLORS.length],
        actuel: x.actuel || '—',
        pct: (p.pct || 0) + '%',
        color: p.color,
        label: p.label,
        cloture: p.sas ? fmtFR(echeanceEffective(x).iso) : clotureShort(x.cloture),
        isSas: !!p.sas,
        statut: notStarted(x) ? 'À venir' : x.statut,
        statutHint: notStarted(x) ? 'Débute le ' + fmtFR(startOf(x)) : x.statut,
        statutColor: STATUT_STYLE[x.statut][0],
        statutBg: STATUT_STYLE[x.statut][1],
        open: () =>
          this.navigate({ selected: x.id, editing: false, confirmDeleteMini: false, aiDetail: null }),
      }));
      const zones = [
        ['Tous', 'Tous', null],
        ['ok', PROJ.ok[0], PROJ.ok[1]],
        ['sas', PROJ.sas[0], PROJ.sas[1]],
        ['tension', PROJ.tension[0], PROJ.tension[1]],
        ['jourj', PROJ.jourj[0], PROJ.jourj[1]],
        ['retard', PROJ.retard[0], PROJ.retard[1]],
      ];
      const n = (k) => shown.filter((o) => o.p.zone === k).length;
      // Chaque compteur annonce le résultat du clic : tous les autres critères sont conservés.
      const echZoneChips = zones.map(([k, label, dot]) => ({
        label,
        dot: dot || 'transparent',
        dotW: dot ? '6px' : '0px',
        ...(zf === k ? chipOn : chipOff),
        count: zoneBase.filter((o) => k === 'Tous' || o.p.zone === k).length,
        vitalW:
          (k === 'tension' || k === 'jourj' || k === 'retard') &&
          zoneBase.some((o) => poidsOf(o.x) === 'vital' && o.p.zone === k)
            ? '6px'
            : '0px',
        onClick: () => this.setState({ echZone: k }),
      }));
      const echTimeChips = [
        [0, 'Tous'],
        [7, '7 j'],
        [30, '30 j'],
        [90, '90 j'],
      ].map(([d, label]) => ({
        label,
        title: d ? 'Aujourd’hui et les ' + d + ' prochains jours' : 'Toutes les échéances, retards compris',
        ...(tf === d ? chipOn : chipOff),
        count: searched.filter((o) => inZone(o) && dansDelai(o.x, d)).length,
        onClick: () => this.setState({ timeFilter: d }),
      }));
      const echKpis = [
        { label: 'à l’heure', value: n('ok'), color: '#34d399' },
        { label: 'en test', value: n('sas'), color: '#818cf8' },
        { label: 'tension', value: n('tension'), color: '#fbbf24' },
        { label: 'jour J', value: n('jourj'), color: '#fafafa' },
        { label: 'retard', value: n('retard'), color: '#fb7185' },
        { label: 'mandats', value: shown.filter((o) => isMandat(o.x.cloture)).length, color: '#71717a' },
      ];
      const anyF = zf !== 'Tous' || T.any || !!eq;
      return {
        eQuery: s.eQuery || '',
        setEQuery: (e) => this.setState({ eQuery: e.target.value }),
        echeances,
        echCount: live.length,
        echShown: shown.length,
        noEcheances: shown.length === 0,
        echEmptyLabel: anyF ? 'aucune échéance pour ces filtres' : 'aucune échéance active ou à venir',
        echZoneChips,
        echTimeChips,
        echKpis,
        echHasFilters: anyF,
        resetEcheancesFilters: () =>
          this.setState({
            echZone: 'Tous',
            timeFilter: 0,
            monthFilter: '',
            quarterFilter: '',
            yearFilter: '',
            eQuery: '',
          }),
      };
    }
    // Les événements restent la source des statistiques, même si leur mini-cosmos a été supprimé.
    activityVals() {
      const s = this.state;
      if ((s.view || 'table') !== 'journal') return {};
      const { events, select, jp: P } = this.journalContext(),
        ALL = P === 0,
        current = select(),
        previous = ALL ? [] : select({ previous: true });
      const delta = (cur, prev) => {
        const d = cur - prev;
        return {
          deltaLabel: ALL ? 'journal des 12 derniers mois' : (d > 0 ? '+' : '') + d + ' vs période préc.',
          deltaColor: ALL ? '#52525b' : d > 0 ? '#34d399' : d < 0 ? '#fb7185' : '#52525b',
        };
      };
      const checked = (e) => e.type === 'etape' && /^Étape cochée(?:\s|:|$)/i.test(e.detail || '');
      const metric = (label, pred, color) => {
        const cur = current.filter(pred).length;
        return { label, value: cur, color, ...delta(cur, previous.filter(pred).length) };
      };
      const activity = [
        metric('créés', (e) => e.type === 'creation', '#fafafa'),
        metric('admis', (e) => e.type === 'statut' && /^SAS franchi/.test(e.detail || ''), '#818cf8'),
        metric(
          'clôturés',
          (e) => e.type === 'statut' && /^Statut\s*→\s*Clôturé(?:\s|$)/i.test(e.detail || ''),
          '#71717a',
        ),
        metric('supprimés', (e) => e.type === 'suppression', '#fb7185'),
        metric('étapes cochées', checked, '#34d399'),
      ];
      const oldest = events.reduce((a, e) => (e.day && e.day < a ? e.day : a), daysAgo(0));
      const ordinal = (d) => Date.parse(d + 'T00:00:00Z') / 86400000;
      const spanDays = ALL ? Math.max(7, ordinal(daysAgo(0)) - ordinal(oldest) + 1) : P;
      const periodLabel = ALL ? 'journal des 12 derniers mois' : P + ' derniers jours';
      return {
        jActivity: activity.map((m) => ({
          ...m,
          title: m.label + ' · ' + periodLabel + ' · filtres actifs · ' + m.deltaLabel,
        })),
        jStepsPerWeek: (current.filter(checked).length / (spanDays / 7)).toFixed(1),
        jPeriodLabel: periodLabel,
      };
    }
    renderVals() {
      if (refreshToday) refreshToday();
      const s = this.state;
      const TAB_OFF = { color: '#a1a1aa', bg: 'transparent', border: 'transparent' };
      if (!s.ready)
        return {
          booting: !s.needsLogin,
          needsLogin: !!s.needsLogin,
          bootError: s.bootError || '',
          lastExportLabel: '',
          lastExportColor: 'transparent',
          tabTable: TAB_OFF,
          tabEch: TAB_OFF,
          tabTpl: TAB_OFF,
          tabJournal: TAB_OFF,
          loginEmail: s.loginEmail || '',
          loginPassword: s.loginPassword || '',
          loginError: s.loginError || '',
          hasLoginError: !!s.loginError,
          loginLabel: s.loginBusy ? 'Connexion…' : 'Se connecter',
          loginBtnOpacity: s.loginBusy ? 0.5 : 1,
          setLoginEmail: (e) => this.setState({ loginEmail: e.target.value }),
          setLoginPassword: (e) => this.setState({ loginPassword: e.target.value }),
          loginKey: (e) => {
            if (e.key === 'Enter') this.doLogin();
          },
          doLogin: () => this.doLogin(),
        };
      const rowsN = s.rows.map((x) => ({ ...x, statut: statutOf(x) }));
      const isoOf = (x) => echeanceEffective(x).iso;
      const clotureOpts = clotureOptions();
      const mf = s.monthFilter || '',
        yf = s.yearFilter || '',
        qf = typeof s.quarterFilter === 'string' ? s.quarterFilter : '';
      const y0 = TODAY.getFullYear();
      // Inclure les années des échéances et des filtres actifs, même après le Nouvel An ou une suppression distante.
      const yearSet = new Set(Array.from({ length: 11 }, (_, i) => String(y0 + i)));
      [mf, yf, qf, ...s.rows.map(isoOf)].forEach((v) => {
        if (/^\d{4}(?:-|$)/.test(v || '')) yearSet.add(v.slice(0, 4));
      });
      const years = [...yearSet].sort((a, b) => Number(a) - Number(b));
      const yearOptions = [{ value: '', label: 'Année' }, ...years.map((y) => ({ value: y, label: y }))];
      const MOIS = [
        'janv.',
        'févr.',
        'mars',
        'avr.',
        'mai',
        'juin',
        'juil.',
        'août',
        'sept.',
        'oct.',
        'nov.',
        'déc.',
      ];
      const monthGroups = years.map((y) => ({
        year: y,
        items: MOIS.map((m, i) => ({ value: y + '-' + String(i + 1).padStart(2, '0'), label: m + ' ' + y })),
      }));
      const quarterGroups = years.map((y) => ({
        year: y,
        items: [1, 2, 3, 4].map((q) => ({ value: y + '-Q' + q, label: 'Q' + q + ' ' + y })),
      }));
      // largeur des listes déroulantes : celle de leur titre, ou de la valeur choisie — jamais celle de la plus longue option
      const selW = (t) => Math.round(t.length * 7.2 + 44) + 'px';
      const quarterW = selW(qf ? 'Q' + qf.slice(6) + ' ' + qf.slice(0, 4) : 'Trimestre'),
        monthW = selW(mf ? MOIS[+mf.slice(5, 7) - 1] + ' ' + mf.slice(0, 4) : 'Mois'),
        yearW = selW(yf || 'Année');
      const selStyle = (v) => (v ? chipOn : chipOff);
      const sel =
        s.editing && s.editDraft && s.editDraft.id === s.selected
          ? s.editDraft
          : s.rows.find((x) => x.id === s.selected);
      let detail = null;
      if (sel) {
        const d = this.decorate(sel);
        const edit = {};
        [
          'name',
          'objectif',
          'actuel',
          'entropie',
          'reponse',
          'alerte',
          'kill',
          'cloture',
          'startAt',
          'sasUntil',
          'alertDays',
        ].forEach((k) => {
          edit[k] = (e) => {
            if ((k === 'cloture' || k === 'startAt' || k === 'sasUntil') && !e.target.value && !isDraft(sel))
              return;
            this.update(sel.id, { [k]: e.target.value });
          };
        });
        // un SAS saisi sans date reçoit sa fin de test déduite du texte (ou 14 j), ajustable ensuite
        edit.sas = (e) => {
          const v = e.target.value;
          const patch = { sas: v };
          if (v.trim() && v !== '—' && !sasUntilOf(sel) && !isDraft(sel))
            patch.sasUntil = inferSasUntil({ ...sel, sas: v });
          this.update(sel.id, patch);
        };
        const sasStart = startOf(sel) || daysAgo(0);
        const sasCur = sasUntilOf(sel) || (isDraft(sel) ? '' : inferSasUntil(sel));
        const sasFinal = resolveCloture(sel.cloture);
        const badSasStart = hasSas(sel) && !!sasCur && sasCur < sasStart,
          badSasEnd = hasSas(sel) && !!sasFinal && sasCur > sasFinal;
        const sasVals = {
          sasUntil: sasCur,
          sasUntilBorder: badSasStart || badSasEnd ? '#fb7185' : '#27272a',
          sasHintColor: badSasStart || badSasEnd ? '#fb7185' : '#71717a',
          sasHint: !sasCur
            ? 'Date de fin du test à définir.'
            : badSasStart
              ? 'la fin du test est avant le début (' + fmtFR(sasStart) + ')'
              : badSasEnd
                ? 'la fin du test dépasse la clôture finale (' + fmtFR(sasFinal) + ')'
                : 'test du ' +
                  fmtFR(sasStart) +
                  ' au ' +
                  fmtFR(sasCur) +
                  ' · ' +
                  (sasFinal ? 'puis échéance finale ' + clotureLabel(sel.cloture) : 'puis objectif continu'),
          sasChips: [7, 14, 30].map((n) => {
            const v = plusDays(sasStart, n);
            return {
              label: n + ' j',
              ...(sasCur === v ? chipOn : chipOff),
              onClick: () => this.update(sel.id, { sasUntil: v }),
            };
          }),
        };
        const poidsVals = {
          poidsChips: POIDS.map((p) => ({
            label: POIDS_LABEL[p],
            dotBg: POIDS_DOT[p].bg,
            dotBorder: POIDS_DOT[p].border,
            ...(poidsOf(sel) === p ? chipOn : chipOff),
            onClick: () => this.update(sel.id, { poids: p }),
          })),
        };
        const selMandat = isMandat(sel.cloture);
        const isDate = !selMandat && (!!resolveCloture(sel.cloture) || isDraft(sel));
        const selStatut = statutOf(sel);
        const allDone =
          sel.actions.length > 0 &&
          sel.actions.every((a) => a.done) &&
          !sel.closed &&
          !(hasSas(sel) && !sel.sasDone);
        const closeIt = () => {
          this.update(
            sel.id,
            { closed: true, closedAt: daysAgo(0) },
            {
              type: 'statut',
              value: 'Clôturé',
              detail: 'Statut → Clôturé (date effective ' + daysAgo(0) + ')',
            },
          );
          this.flash(sel.name + ' clôturé');
        };
        const reopen = () => {
          this.update(
            sel.id,
            { closed: false, closedAt: undefined },
            { type: 'statut', value: statutOf({ ...sel, closed: false }), detail: 'Réouvert' },
          );
          this.flash(sel.name + ' réouvert');
        };
        const togglePause = () => {
          const p = !sel.pause;
          const saved = this.update(
            sel.id,
            { pause: p },
            {
              type: 'statut',
              value: p ? 'Pause' : statutOf({ ...sel, pause: false }),
              detail: p ? 'Mis en pause' : 'Repris',
            },
          );
          if (saved) this.flash(sel.name + (p ? ' en pause' : ' repris'));
        };
        const toggleSas = () => {
          const v = !sel.sasDone;
          this.update(
            sel.id,
            { sasDone: v },
            {
              type: 'statut',
              value: v ? 'Actif' : 'SAS',
              detail: v ? 'SAS franchi → admis dans le cosmos' : 'SAS rouvert',
            },
          );
          this.flash(v ? sel.name + ' admis — SAS franchi' : sel.name + ' de retour en SAS');
        };
        const statutHints = {
          SAS:
            'en test d\u2019entrée' +
            (d.sasUntilLabel ? ' jusqu\u2019au ' + d.sasUntilLabel : '') +
            (d.projIsSas && d.projDays < 0
              ? ' — test dépassé : admets-le (coche le SAS), déplace la date ou clôture'
              : ' — coche l\u2019étape SAS pour l\u2019admettre dans le cosmos'),
          Actif: 'statut calculé automatiquement',
          Pause: isDraft(sel)
            ? 'À compléter — renseigne les informations et les dates avant de reprendre.'
            : d.notStarted
              ? 'démarre le ' +
                d.startLabel +
                ' — en pause jusque-là, puis passe en ' +
                (hasSas(sel) && !sel.sasDone ? 'SAS' : 'Actif') +
                ' tout seul'
              : 'en pause — la projection continue de courir',
          Clôturé: 'clôturé le ' + d.cloture,
        };
        const aiD = this.aiVals(
          'aiDetail',
          {
            cosmos: sel.cosmos,
            name: sel.name,
            poids: poidsOf(sel),
            objectif: sel.objectif,
            actuel: sel.actuel,
            entropie: sel.entropie,
            reponse: sel.reponse,
            sas: sel.sas,
            etapes: sel.actions.map((a) => a.text).filter(Boolean),
            alerte: sel.alerte,
            kill: sel.kill,
            cloture: clotureLabel(sel.cloture),
          },
          (p) => {
            if (this.applyPatch(sel, p, 'Proposition IA appliquée')) this.flash('Proposition appliquée');
          },
        );
        const agentProps = (s.propositions || [])
          .filter((p) => p.miniId === sel.id)
          .map((p) => ({
            id: p.id,
            agent: p.agent,
            motif: p.motif || '',
            hasMotif: !!p.motif,
            lines: Object.keys(p.patch || {}).map((k) => ({
              label:
                {
                  objectif: 'Objectif',
                  actuel: 'Valeur actuelle',
                  entropie: 'Entropie',
                  reponse: 'Réponse',
                  sas: 'SAS',
                  sasUntil: 'Fin du test',
                  alerte: 'Alerte',
                  kill: 'Kill',
                  etapes: 'Étapes',
                  poids: 'Poids',
                }[k] || k,
              value: Array.isArray(p.patch[k]) ? p.patch[k].join(' · ') : String(p.patch[k]),
            })),
            accept: () => this.decideProposal(p, sel, true),
            refuse: () => this.decideProposal(p, sel, false),
          }));
        const titresSel = this.titresOf(sel.cosmos);
        detail = {
          ...d,
          ...sasVals,
          ...poidsVals,
          cosmosLabel: sel.cosmos,
          titreCrumb: sel.titre && titresSel.includes(sel.titre) ? ' › ' + sel.titre : '',
          hasTitres: titresSel.length > 0,
          titreChips: [{ id: '', label: 'Aucun' }, ...titresSel.map((t) => ({ id: t, label: t }))].map(
            (o) => ({
              label: o.label,
              ...((sel.titre || '') === o.id ? chipOn : chipOff),
              onClick: () => this.rangerSous(sel.id, o.id),
            }),
          ),
          editing: s.editing,
          notEditing: !s.editing,
          edit,
          raw: sel,
          allDone,
          closeIt,
          toggleSas,
          ai: aiD,
          agentProps,
          hasAgentProps: agentProps.length > 0,
          agentPropsCount: agentProps.length,
          statutHint: statutHints[selStatut],
          sasEdit: hasSas(sel) ? sel.sas : '',
          sasMark: sel.sasDone ? '✓' : '',
          sasBoxBg: sel.sasDone ? '#818cf8' : '#09090b',
          sasBoxBorder: sel.sasDone ? '#818cf8' : '#3f3f46',
          sasColor: sel.sasDone ? '#52525b' : '#f4f4f5',
          sasDeco: sel.sasDone ? 'line-through' : 'none',
          isClosed: !!sel.closed,
          notClosed: !sel.closed,
          alertChips: [3, 7, 15, 30].map((n) => ({
            label: n + ' j',
            ...(alertDaysOf(sel) === n ? chipOn : chipOff),
            onClick: () => this.update(sel.id, { alertDays: n }),
          })),
          togglePause,
          canPause: !sel.closed && (isDraft(sel) || !d.notStarted),
          pauseLabel: sel.pause ? 'Reprendre' : 'Mettre en pause',
          pauseColor: sel.pause ? '#f4f4f5' : '#d4a054',
          pauseBg: sel.pause ? 'rgba(63,63,70,0.55)' : 'rgba(212,160,84,0.12)',
          toggleClose: sel.closed ? reopen : closeIt,
          closeLabel: sel.closed ? 'Réouvrir' : 'Clôturer',
          duplicate: () => {
            const copy = {
              ...sel,
              id: 'mc-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
              name: sel.name + ' (copie)',
              actions: sel.actions.map((a) => ({ text: a.text, done: false })),
              sasDone: false,
              pause: false,
              closed: false,
              closedAt: undefined,
              startAt: daysAgo(0),
              cloture: isMandat(sel.cloture)
                ? mandatDepuis(daysAgo(0))
                : resolveCloture(sel.cloture)
                  ? daysAgo(-90)
                  : mandatDepuis(daysAgo(0)),
              createdAt: daysAgo(0),
              history: [],
            };
            if (isDraft(sel))
              Object.assign(copy, { pause: true, startAt: sel.startAt || '', cloture: sel.cloture || '' });
            if (hasSas(sel) && !isDraft(sel)) {
              const s0 = startOf(sel) || daysAgo(0),
                s1 = sasUntilOf(sel) || plusDays(s0, 14);
              copy.sasUntil = plusDays(
                daysAgo(0),
                Math.max(1, Math.round((new Date(s1 + 'T00:00:00') - new Date(s0 + 'T00:00:00')) / 86400000)),
              );
            } else if (!hasSas(sel)) delete copy.sasUntil;
            const i = s.rows.findIndex((x) => x.id === sel.id);
            this.setState((st) => {
              const rows = [...st.rows];
              rows.splice(i + 1, 0, copy);
              return {
                rows,
                selected: copy.id,
                editing: true,
                editSnap: JSON.parse(JSON.stringify(copy)),
                editDraft: JSON.parse(JSON.stringify(copy)),
                editEvents: [],
                editError: '',
              };
            });
            this.logJ({
              type: 'creation',
              mini: copy.name,
              miniId: copy.id,
              cosmos: copy.cosmos,
              detail: 'Dupliqué depuis « ' + sel.name + ' » — étapes remises à zéro, échéance à revoir',
            });
            this.flash('Copie créée — ajuste le nom et l\u2019échéance');
          },
          parentChips: s.cosmos.map((c, i) => ({
            label: c,
            dot: COLORS[i % COLORS.length],
            ...(sel.cosmos === c ? chipOn : chipOff),
            onClick: () => {
              if (c !== sel.cosmos) {
                this.update(
                  sel.id,
                  { cosmos: c, titre: undefined },
                  { type: 'deplacement', detail: 'Cosmos parent : ' + sel.cosmos + ' → ' + c },
                );
                this.flash(sel.name + ' → ' + c);
              }
            },
          })),
          clotureDate: resolveCloture(sel.cloture) || '',
          clotureSel: clotureSel(sel.cloture),
          clotureOpts,
          pickCloture: (e) => {
            const v = e.target.value;
            if (v) this.update(sel.id, { cloture: v });
          },
          echeanceChips: [
            ['datee', 'Datée'],
            ['mandat', 'Mandat 1 an'],
          ].map(([k, label]) => ({
            label,
            ...((selMandat ? 'mandat' : 'datee') === k ? chipOn : chipOff),
            onClick: () => {
              if (k === 'mandat' && !selMandat) {
                const c = mandatDepuis(startOf(sel));
                this.update(
                  sel.id,
                  { cloture: c },
                  {
                    type: 'modification',
                    detail: 'Échéance → mandat d\u2019un an jusqu\u2019au ' + fmtFR(resolveCloture(c)),
                  },
                );
                this.flash(sel.name + ' : mandat d\u2019un an');
              }
              if (k === 'datee' && selMandat)
                this.update(
                  sel.id,
                  { cloture: daysAgo(-90) },
                  { type: 'modification', detail: 'Échéance → datée (' + fmtFR(daysAgo(-90)) + ')' },
                );
            },
          })),
          isMandat: selMandat,
          isDatee: isDate,
          mandatLabel: selMandat ? 'Mandat jusqu\u2019au ' + fmtFR(resolveCloture(sel.cloture)) : '',
          renouvelerMandat: () => {
            const end = resolveCloture(sel.cloture) || daysAgo(0);
            const base = end > daysAgo(0) ? end : daysAgo(0);
            const c = 'A:' + plusMonths(base, 12);
            this.update(
              sel.id,
              { cloture: c },
              { type: 'modification', detail: 'Mandat renouvelé jusqu\u2019au ' + fmtFR(resolveCloture(c)) },
            );
            this.flash(sel.name + ' : mandat renouvelé jusqu\u2019au ' + fmtFR(resolveCloture(c)));
          },
          toggleEdit: () => (s.editing ? this.finishEdit() : this.beginEdit(sel.id)),
          cancelEdit: () => this.cancelMiniEdit(),
          editError: s.editError || '',
          addStep: () => this.update(sel.id, { actions: [...sel.actions, { text: '', done: false }] }),
          actionCount: sel.actions.length,
          doneCount: sel.actions.filter((a) => a.done).length,
          actions: sel.actions.map((a, i) => ({
            text: a.text,
            color: a.done ? '#52525b' : '#f4f4f5',
            deco: a.done ? 'line-through' : 'none',
            mark: a.done ? '✓' : '',
            boxBg: a.done ? '#34d399' : '#09090b',
            boxBorder: a.done ? '#34d399' : '#3f3f46',
            toggle: () =>
              this.update(
                sel.id,
                { actions: sel.actions.map((b, j) => (j === i ? { ...b, done: !b.done } : b)) },
                a.done
                  ? { type: 'unstep', detail: 'Étape décochée : ' + a.text }
                  : { type: 'step', detail: 'Étape cochée : ' + a.text },
              ),
            onText: (e) =>
              this.update(sel.id, {
                actions: sel.actions.map((b, j) => (j === i ? { ...b, text: e.target.value } : b)),
              }),
            up: () => {
              if (i === 0) return;
              const a = [...sel.actions];
              [a[i - 1], a[i]] = [a[i], a[i - 1]];
              this.update(sel.id, { actions: a });
            },
            down: () => {
              if (i === sel.actions.length - 1) return;
              const a = [...sel.actions];
              [a[i + 1], a[i]] = [a[i], a[i + 1]];
              this.update(sel.id, { actions: a });
            },
            upColor: i === 0 ? '#27272a' : '#71717a',
            downColor: i === sel.actions.length - 1 ? '#27272a' : '#71717a',
            remove: () => this.update(sel.id, { actions: sel.actions.filter((b, j) => j !== i) }),
          })),
        };
      }
      const f = s.form;
      /** @type {Record<string, (event: {target: {value: string}}) => void>} */
      const set = {};
      Object.keys(EMPTY_FORM).forEach((k) => {
        if (k !== 'actions') set[k] = this.setField(k);
      });
      const tabs = [
        ['01–04', 'Identité'],
        ['05–08', 'Gouvernance'],
        ['09–10', 'Suivi'],
        ['11–14', 'Échéance'],
      ].map(([num, label], i) => ({
        num,
        label,
        color: s.tab === i ? '#fafafa' : '#71717a',
        line: s.tab === i ? '#fafafa' : 'transparent',
        onClick: () => this.setState({ tab: i }),
      }));
      const dupName = !!(
        f.cosmos &&
        f.name.trim() &&
        s.rows.some(
          (x) => x.cosmos === f.cosmos && x.name.trim().toLowerCase() === f.name.trim().toLowerCase(),
        )
      );
      const badOrder =
        f.echeance === 'datee' &&
        !!resolveCloture(f.cloture) &&
        /^\d{4}-\d{2}-\d{2}$/.test(f.startAt || '') &&
        resolveCloture(f.cloture) < f.startAt;
      const noGov = !(f.entropie || '').trim() || !(f.reponse || '').trim();
      // SAS daté : la fin du test doit être entre le début et la clôture finale (14 j par défaut)
      const formStartBase = /^\d{4}-\d{2}-\d{2}$/.test(f.startAt || '') ? f.startAt : daysAgo(0);
      const formHasSas = !!(f.sas || '').trim() && f.sas !== '—';
      const formSasUntilEff = /^\d{4}-\d{2}-\d{2}$/.test(f.sasUntil || '')
        ? f.sasUntil
        : inferSasUntil({ sas: f.sas, startAt: formStartBase });
      const formFinal =
        f.echeance === 'datee'
          ? resolveCloture(f.cloture)
          : f.echeance === 'mandat'
            ? resolveCloture(mandatDepuis(formStartBase))
            : null;
      const badSasStart = formHasSas && formSasUntilEff < formStartBase,
        badSasEnd = formHasSas && !!formFinal && formSasUntilEff > formFinal;
      const formError = validateMini(
        {
          ...f,
          startAt: formStartBase,
          cloture: f.echeance === 'mandat' ? mandatDepuis(formStartBase) : f.cloture,
          sasUntil: formHasSas ? formSasUntilEff : undefined,
        },
        s.rows,
      );
      const miniInvalid = !!formError;
      const cosmosInvalid = !s.cosmosName.trim() || s.cosmos.includes(s.cosmosName.trim().toUpperCase());
      const q = (s.tplQuery || '').toLowerCase();
      const tplGroups = TEMPLATES.map(([domain, items], i) => {
        const list = items.filter(
          (t) => !q || t.toLowerCase().includes(q) || domain.toLowerCase().includes(q),
        );
        const exists = s.cosmos.includes(domain);
        return {
          domain,
          color: COLORS[i % COLORS.length],
          count: list.length,
          exists,
          missing: !exists,
          createCosmos: () => {
            this.setState((st) => ({ cosmos: [...st.cosmos, domain] }));
            this.logJ({ type: 'cosmos', cosmos: domain, detail: 'Cosmos créé depuis les modèles' });
            this.flash('Cosmos ' + domain + ' créé');
          },
          items: list.map((t) => ({
            label: t,
            use: () =>
              this.setState({
                showMiniModal: true,
                tab: 0,
                form: freshForm({ name: t, cosmos: exists ? domain : '' }),
                aiForm: null,
              }),
          })),
        };
      }).filter((g) => g.count > 0);
      const etageChips = ETAGES.map(([e, label]) => ({
        label: s.titresEtages[e] || label,
        ...((s.newEtage || 'logos') === e ? chipOn : chipOff),
        onClick: () => this.setState({ newEtage: e }),
      }));
      const etageHint = ETAGES.find(([e]) => e === (s.newEtage || 'logos'))[2];
      // cartes KPI de la page Cosmos : calculées sur tous les mini-cosmos ouverts, filtres ignorés
      const kpiCards = (() => {
        const open = rowsN.filter((x) => x.statut !== 'Clôturé'),
          run = open.filter((x) => x.statut !== 'Pause');
        const zones = run.map((x) => projectionOf(x).zone);
        const z = (k) => zones.filter((zone) => zone === k).length;
        const counter = (n, label, color, what) => ({
          label,
          value: String(n),
          color: n > 0 ? color : '#3f3f46',
          title: n + ' ' + what,
        });
        return [
          {
            label: 'cosmos',
            value: String(s.cosmos.length),
            color: '#fafafa',
            title: s.cosmos.length + ' cosmos, dans l’ordre domino',
          },
          {
            label: 'mini-cosmos',
            value: String(open.length),
            color: '#fafafa',
            title: open.length + ' mini-cosmos ouverts, toutes pièces confondues',
          },
          counter(open.filter((x) => x.statut === 'SAS').length, 'SAS', '#818cf8', 'en SAS'),
          counter(open.length - run.length, 'pause', '#d4a054', 'en pause'),
          counter(
            open.filter((x) => !!resolveCloture(x.cloture) && !isMandat(x.cloture)).length,
            'datés',
            '#a1a1aa',
            'à échéance datée',
          ),
          counter(
            open.filter((x) => isMandat(x.cloture)).length,
            'mandats',
            '#a1a1aa',
            'sous mandat d’un an',
          ),
          counter(z('tension') + z('jourj'), 'tension', '#fbbf24', 'en tension ou au jour J'),
          counter(z('retard'), 'retard', '#fb7185', 'en retard'),
        ];
      })();
      const view = s.view || 'table';
      return {
        kpiCards,
        syncConflict: s.syncConflict || '',
        syncConflictBusy: !!s.syncConflictBusy,
        resolveSyncConflict: () => this.resolveSyncConflict(),
        etageChips,
        etageHint,
        monthGroups,
        quarterGroups,
        yearOptions,
        quarterW,
        monthW,
        yearW,
        monthFilter: mf,
        yearFilter: yf,
        quarterFilter: qf,
        quarterStyle: selStyle(qf),
        setQuarter: (e) => this.setPeriodFilter('quarter', e.target.value),
        monthStyle: selStyle(mf),
        yearStyle: selStyle(yf),
        setMonth: (e) => this.setPeriodFilter('month', e.target.value),
        setYear: (e) => this.setPeriodFilter('year', e.target.value),
        isEcheances: view === 'echeances',
        isTemplates: view === 'templates',
        isJournal: view === 'journal',
        tabJournal: {
          color: view === 'journal' ? '#fafafa' : '#a1a1aa',
          bg: view === 'journal' ? 'rgba(39,39,42,0.55)' : 'transparent',
          border: view === 'journal' ? 'rgba(63,63,70,0.8)' : 'transparent',
          onClick: () => this.navigate({ view: 'journal' }),
        },
        ...this.journalVals(),
        ...this.activityVals(),
        exportJson: () => this.exportJson(),
        importJson: (e) => {
          this.importJson(e.target.files && e.target.files[0]);
          e.target.value = '';
        },
        importRef: this.importRef || (this.importRef = createRef()),
        openImport: () => this.importRef.current && this.importRef.current.click(),
        confirmReset: !!s.confirmReset,
        askReset: () => this.setState({ confirmReset: true }),
        cancelReset: () => this.setState({ confirmReset: false }),
        resetData: () => this.resetData(),
        dataMenu: !!s.dataMenu,
        toggleDataMenu: () => this.setState((st) => ({ dataMenu: !st.dataMenu, confirmReset: false })),
        isDb: !!this.sync,
        storageTitle: this.sync
          ? 'Données · synchronisées dans ta base'
          : 'Données · sauvegardées localement',
        storageHint: this.sync ? 'connecté · ' + (this.sync.email() || '') : 'ce navigateur seulement',
        logout: () => this.logout(),
        openAgents: () =>
          this.setState({ showAgents: true, dataMenu: false, newAgentKey: '', newAgentKeyName: '' }),
        closeAgents: () => this.setState({ showAgents: false, newAgentKey: '', newAgentKeyName: '' }),
        showAgents: !!s.showAgents,
        agentsHint: (() => {
          const n = (s.agents || []).filter((a) => a.actif).length;
          return n
            ? n + ' agent' + (n > 1 ? 's' : '') + ' actif' + (n > 1 ? 's' : '')
            : 'aucun agent — crée une clé par agent';
        })(),
        pendingCount: (s.propositions || []).length,
        hasPending: (s.propositions || []).length > 0,
        openPending: () => {
          const p = (s.propositions || [])[0];
          if (p)
            this.navigate({ view: 'table', selected: p.miniId, editing: false, confirmDeleteMini: false });
        },
        agents: (s.agents || []).map((a) => ({
          id: a.id,
          name: a.name,
          level: a.ecriture_directe ? 'écriture directe' : 'propositions',
          lastUsed: a.last_used_at ? 'utilisé le ' + fmtFR(a.last_used_at.slice(0, 10)) : 'jamais utilisé',
          isActive: !!a.actif,
          isRevoked: !a.actif,
          color: a.actif ? '#f4f4f5' : '#52525b',
          deco: a.actif ? 'none' : 'line-through',
          revoke: () => this.revokeAgent(a),
        })),
        agentsCount: (s.agents || []).length,
        noAgents: !(s.agents || []).length,
        newAgentName: s.newAgentName || '',
        setNewAgentName: (e) => this.setState({ newAgentName: e.target.value }),
        newAgentKeyDown: (e) => {
          if (e.key === 'Enter') this.createAgent();
        },
        agentLevelChips: [
          [false, 'Propositions (recommandé)'],
          [true, 'Écriture directe'],
        ].map(([v, label]) => ({
          label,
          ...(!!s.newAgentDirect === v ? chipOn : chipOff),
          onClick: () => this.setState({ newAgentDirect: v }),
        })),
        agentLevelHint: s.newAgentDirect
          ? 'Modifie directement les mini-cosmos, sans validation. Chaque écriture est tracée dans le Journal avec le nom de l\u2019agent.'
          : 'Ne modifie rien : ses propositions apparaissent dans le volet Assistant du mini-cosmos, à accepter ou refuser.',
        createAgent: () => this.createAgent(),
        newAgentInvalid: !(s.newAgentName || '').trim(),
        newAgentBtnOpacity: (s.newAgentName || '').trim() ? 1 : 0.4,
        newAgentKey: s.newAgentKey || '',
        newAgentKeyName: s.newAgentKeyName || '',
        hasNewAgentKey: !!s.newAgentKey,
        clearNewAgentKey: () => this.setState({ newAgentKey: '', newAgentKeyName: '' }),
        agentEndpoint: location.origin + '/api/agent',
        lastExportLabel: (() => {
          let t = s.lastExport;
          if (!t) {
            try {
              t = localStorage.getItem(this.STORE_KEY + ':lastExport');
            } catch (e) {}
          }
          if (!t) return 'jamais exporté';
          const d = Math.round((TODAY - new Date(t.slice(0, 10) + 'T00:00:00')) / 86400000);
          return d <= 0 ? 'exporté aujourd\u2019hui' : 'dernier export il y a ' + d + ' j';
        })(),
        lastExportColor: (() => {
          let t = s.lastExport;
          if (!t) {
            try {
              t = localStorage.getItem(this.STORE_KEY + ':lastExport');
            } catch (e) {}
          }
          if (!t) return '#fb7185';
          const d = Math.round((TODAY - new Date(t.slice(0, 10) + 'T00:00:00')) / 86400000);
          return d > 14 ? '#fbbf24' : '#52525b';
        })(),
        tabEch: {
          color: view === 'echeances' ? '#fafafa' : '#a1a1aa',
          bg: view === 'echeances' ? 'rgba(39,39,42,0.55)' : 'transparent',
          border: view === 'echeances' ? 'rgba(63,63,70,0.8)' : 'transparent',
        },
        ...this.echeancesVals(),
        tabTable: {
          color: view === 'table' ? '#fafafa' : '#a1a1aa',
          bg: view === 'table' ? 'rgba(39,39,42,0.55)' : 'transparent',
          border: view === 'table' ? 'rgba(63,63,70,0.8)' : 'transparent',
          onClick: () => this.navigate({ view: 'table' }),
        },
        tabTpl: {
          color: view === 'templates' ? '#fafafa' : '#a1a1aa',
          bg: view === 'templates' ? 'rgba(39,39,42,0.55)' : 'transparent',
          border: view === 'templates' ? 'rgba(63,63,70,0.8)' : 'transparent',
          onClick: () => this.navigate({ view: 'templates' }),
        },
        tplGroups,
        tplQuery: s.tplQuery || '',
        setTplQuery: (e) => this.setState({ tplQuery: e.target.value }),
        tplTotal: TEMPLATES.reduce((a, [, i]) => a + i.length, 0),
        detail,
        closeDetail: () => this.navigate({ selected: null, confirmDeleteMini: false, editing: false }),
        confirmDeleteMini: !!s.confirmDeleteMini,
        footerIdle: !s.confirmDeleteMini,
        askDeleteMini: () => this.setState({ confirmDeleteMini: true }),
        cancelDeleteMini: () => this.setState({ confirmDeleteMini: false }),
        doDeleteMini: () => {
          if (sel) this.deleteMini(sel.id);
        },
        showCosmosModal: s.showCosmosModal,
        showMiniModal: s.showMiniModal,
        openCosmos: () => this.setState({ showCosmosModal: true, cosmosName: '' }),
        openMini: () => this.setState({ showMiniModal: true, tab: 0, form: freshForm(), aiForm: null }),
        closeModals: () => this.setState({ showCosmosModal: false, showMiniModal: false }),
        cosmosName: s.cosmosName,
        setCosmosName: (e) => this.setState({ cosmosName: e.target.value }),
        cosmosInvalid,
        cosmosBtnOpacity: cosmosInvalid ? 0.4 : 1,
        cosmosDup: !!s.cosmosName.trim() && s.cosmos.includes(s.cosmosName.trim().toUpperCase()),
        cosmosKey: (e) => {
          if (e.key === 'Enter' && !cosmosInvalid) {
            e.currentTarget.blur();
            this.creerCosmos(s.cosmosName);
          }
        },
        saveCosmos: () => this.creerCosmos(s.cosmosName),
        form: f,
        set,
        tabs,
        tab0: s.tab === 0,
        tab1: s.tab === 1,
        tab2: s.tab === 2,
        tab3: s.tab === 3,
        notLastTab: s.tab < 3,
        nextTab: () => this.setState({ tab: Math.min(3, s.tab + 1) }),
        parentChips: s.cosmos.map((c, i) => ({
          label: c,
          dot: COLORS[i % COLORS.length],
          ...(f.cosmos === c ? chipOn : chipOff),
          onClick: () =>
            this.setState((st) => ({
              form: { ...st.form, cosmos: c, titre: c === st.form.cosmos ? st.form.titre : '' },
            })),
        })),
        formHasTitres: this.titresOf(f.cosmos).length > 0,
        formTitreChips: [
          { id: '', label: 'Aucun' },
          ...this.titresOf(f.cosmos).map((t) => ({ id: t, label: t })),
        ].map((o) => ({
          label: o.label,
          ...((f.titre || '') === o.id ? chipOn : chipOff),
          onClick: () => this.setState((st) => ({ form: { ...st.form, titre: o.id } })),
        })),
        formEcheanceChips: [
          ['datee', 'Datée'],
          ['mandat', 'Mandat 1 an'],
        ].map(([k, label]) => ({
          label,
          ...(f.echeance === k ? chipOn : chipOff),
          onClick: () => this.setState((st) => ({ form: { ...st.form, echeance: k } })),
        })),
        formIsDated: f.echeance === 'datee',
        formEcheanceHint:
          f.echeance === 'mandat'
            ? 'mandat d\u2019un an jusqu\u2019au ' +
              fmtFR(resolveCloture(mandatDepuis(formStartBase))) +
              ' · renouvelé dans le volet si la discipline tient, supprimé sinon'
            : 'datée : projection jusqu\u2019à la clôture · mandat : objectif continu revu au bout d\u2019un an, comme un bilan',
        formAlertChips: [3, 7, 15, 30].map((n) => ({
          label: n + ' j',
          ...(+f.alertDays === n ? chipOn : chipOff),
          onClick: () => this.setState((st) => ({ form: { ...st.form, alertDays: n } })),
        })),
        formStartsLater: !!(f.startAt && f.startAt > daysAgo(0)),
        formStartLabel: (f.startAt || daysAgo(0)).split('-').reverse().join('/'),
        formClotureDate: resolveCloture(f.cloture) || '',
        formClotureSel: clotureSel(f.cloture),
        formClotureLabel: clotureLabel(f.cloture),
        clotureOpts,
        pickFormCloture: (e) => {
          const v = e.target.value;
          if (v) this.setState((st) => ({ form: { ...st.form, cloture: v } }));
        },
        formActions: f.actions.map((v, i) => ({
          n: i + 1,
          value: v,
          onChange: (e) =>
            this.setState((st) => {
              const a = [...st.form.actions];
              a[i] = e.target.value;
              return { form: { ...st.form, actions: a } };
            }),
        })),
        formAddStep: () =>
          this.setState((st) => ({ form: { ...st.form, actions: [...st.form.actions, ''] } })),
        miniInvalid,
        miniBtnOpacity: miniInvalid ? 0.4 : 1,
        formHint: miniInvalid
          ? !f.cosmos || !f.name.trim()
            ? 'cosmos parent et nom requis (Identité)'
            : dupName
              ? '« ' + f.name.trim() + ' » existe déjà dans ' + f.cosmos
              : noGov
                ? 'entropie et réponse requises (Gouvernance) — un terrain sans danger identifié n\u2019est pas gouverné'
                : badOrder
                  ? 'la clôture est avant la date de début (Échéance)'
                  : badSasStart
                    ? 'la fin du test est avant la date de début (Gouvernance)'
                    : badSasEnd
                      ? 'la fin du test est après la clôture finale (Gouvernance / Échéance)'
                      : formError
          : 'prêt à créer dans ' + f.cosmos,
        formHintColor: miniInvalid
          ? dupName || badOrder || badSasStart || badSasEnd
            ? '#fb7185'
            : '#52525b'
          : '#34d399',
        formPoidsChips: POIDS.map((p) => ({
          label: POIDS_LABEL[p],
          dotBg: POIDS_DOT[p].bg,
          dotBorder: POIDS_DOT[p].border,
          ...((f.poids || 'normal') === p ? chipOn : chipOff),
          onClick: () => this.setState((st) => ({ form: { ...st.form, poids: p } })),
        })),
        formPoidsHint: {
          vital: 'ne doit pas dériver : remonte en tête de son cosmos, ses tensions sont signalées en haut',
          important: 'passe avant les normaux',
          normal: 'suit ton ordre manuel',
        }[f.poids || 'normal'],
        formHasSas,
        formSasUntil: formSasUntilEff,
        setFormSasUntil: (e) => {
          const v = e.target.value;
          if (v) this.setState((st) => ({ form: { ...st.form, sasUntil: v } }));
        },
        formSasChips: [7, 14, 30].map((n) => {
          const v = plusDays(formStartBase, n);
          return {
            label: n + ' j',
            ...(formSasUntilEff === v ? chipOn : chipOff),
            onClick: () => this.setState((st) => ({ form: { ...st.form, sasUntil: v } })),
          };
        }),
        formSasHint: badSasStart
          ? 'la fin du test est avant le début (' + fmtFR(formStartBase) + ')'
          : badSasEnd
            ? 'test du ' +
              fmtFR(formStartBase) +
              ' au ' +
              fmtFR(formSasUntilEff) +
              ' · la clôture finale (' +
              fmtFR(formFinal) +
              ') est avant : règle-la dans l\u2019onglet Échéance'
            : 'test du ' +
              fmtFR(formStartBase) +
              ' au ' +
              fmtFR(formSasUntilEff) +
              ' · ' +
              (f.echeance === 'mandat'
                ? 'puis mandat jusqu\u2019au ' + fmtFR(formFinal)
                : formFinal
                  ? 'puis échéance finale ' + clotureLabel(f.cloture)
                  : 'puis échéance finale (à dater)'),
        formSasHintColor: badSasStart ? '#fb7185' : badSasEnd ? '#fbbf24' : '#71717a',
        saveMini: () => {
          if (miniInvalid) return;
          const acts = f.actions.filter((a) => a.trim());
          const startV = /^\d{4}-\d{2}-\d{2}$/.test(f.startAt || '') ? f.startAt : daysAgo(0);
          const row = {
            cosmos: f.cosmos,
            name: f.name.trim(),
            objectif: f.objectif || '—',
            actuel: f.actuel || '—',
            sas: f.sas || '—',
            sasUntil: formHasSas ? formSasUntilEff : undefined,
            poids: POIDS.includes(f.poids) ? f.poids : 'normal',
            entropie: f.entropie || '—',
            reponse: f.reponse || '—',
            alerte: f.alerte || '—',
            kill: f.kill || '—',
            pause: false,
            closed: false,
            sasDone: false,
            startAt: /^\d{4}-\d{2}-\d{2}$/.test(f.startAt || '') ? f.startAt : daysAgo(0),
            alertDays: alertDaysOf({ alertDays: f.alertDays }),
            cloture: f.echeance === 'mandat' ? mandatDepuis(startV) : f.cloture,
            actions: acts.map((t) => ({ text: t, done: false })),
            createdAt: daysAgo(0),
            history: [],
            id: 'mc-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
          };
          if (f.titre && this.titresOf(f.cosmos).includes(f.titre)) row.titre = f.titre;
          this.setState((st) => ({
            rows: [...st.rows, row],
            showMiniModal: false,
            revealCosmos: row.cosmos,
          }));
          this.logJ({
            type: 'creation',
            mini: row.name,
            miniId: row.id,
            cosmos: row.cosmos,
            detail:
              'Mini-cosmos créé · début ' +
              fmtFR(row.startAt) +
              ' · ' +
              (isMandat(row.cloture)
                ? 'mandat jusqu\u2019au ' + fmtFR(resolveCloture(row.cloture))
                : 'échéance ' + clotureLabel(row.cloture)) +
              (row.sasUntil ? ' · test jusqu\u2019au ' + fmtFR(row.sasUntil) : '') +
              (row.poids !== 'normal' ? ' · poids ' + POIDS_LABEL[row.poids].toLowerCase() : '') +
              (row.titre ? ' · sous « ' + row.titre + ' »' : '') +
              ' · ' +
              statutOf(row),
          });
          this.flash(row.name + ' créé dans ' + row.cosmos);
        },
        toast: s.toast,
      };
    }
  };
}
