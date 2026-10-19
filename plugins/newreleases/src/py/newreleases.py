"""New Releases' task: asks the stash-boxes set up in Stash for the newest
releases from the studios the user has favourited, and keeps them in the
plugin's own folder, in catalog/catalog.json, which the page reads through
the plugin's assets. Stash's package manager deletes only the files a
plugin's zip brought when it updates or uninstalls the plugin, so the
catalog stays across updates. Remove the catalog deletes it.

Stash runs this with its own Python (the manifest's `exec: [python, ...]`
picks Settings > System > Python path, else python3, else python), so it
uses the standard library only. It reads Stash through its GraphQL API and
never writes to Stash.

Where each favourite studio's releases come from: ThePornDB's REST API when
the studio carries a ThePornDB StashID, since it is current for clip sites
where StashDB lags; else the first other stash-box it is linked to, which
answers for all of its studios in one queryScenes request.

The catalog is a short window: a check keeps the releases dated within the
last 48 hours, and each stays until it is four days old, so the page shows
what came out this week and nothing older.

Polite by design: one request at a time with a pause between them, the same
address for the same studio on every install, an identifying User-Agent and
the user's own key. A 429, a 5xx, a Cloudflare challenge or no answer stops
asking that service until the next day, with no retry. Each studio is asked
once a day, or once a week when its newest release is more than 90 days
old, and the catalog is saved after each one, so the page fills in as the
task goes.
"""

import json
import os
import re
import ssl
import sys
import time
from datetime import datetime, timedelta, timezone
from urllib import error, parse, request

PLUGIN_ID = 'NewReleases'
SOURCE = (
    'https://github.com/CandyBoudoir/candyboudoir.github.io'
    '/tree/main/plugins/newreleases'
)

TPDB_HOST = 'theporndb.net'
TPDB_API = 'https://api.theporndb.net'

# Releases asked for: per ThePornDB studio, and per stash-box request, which
# carries every studio linked to that box. The check keeps those of the
# last 48 hours; asking for a fixed number keeps the address the same on
# every install, day after day.
PER_STUDIO = 25
PER_BOX = 100

# Seconds between two requests, to any service. A stash-box with a request
# limit in Stash gets at least the gap that limit asks for.
PAUSE = 3.0
TIMEOUT = 30

DAILY = timedelta(hours=20)
WEEKLY = timedelta(days=7)
QUIET = timedelta(days=90)
# A check keeps releases dated within the last 48 hours, and the catalog
# holds each for 48 more. Release dates are days, so each limit is the day
# it falls on.
FRESH = timedelta(hours=48)
KEPT = timedelta(hours=96)
# The longest description kept: the card shows three lines of it.
DESCRIPTION = 1000
# How long a lock from a run that never finished holds off the next one.
STALE_LOCK = timedelta(hours=2)

# 2: the 48-hour window, descriptions and landscape covers. A catalog from
# version 1 keeps its studios' site ids and nothing else.
CATALOG_VERSION = 2

# Undeclared settings, for the tests only: tpdbEndpoint names a stash-box to
# treat as ThePornDB, with its REST API at tpdbApi, and pauseSeconds
# shortens the pause. Each is honoured only for a service on this machine,
# so none of them can point the user's key elsewhere or hurry a real one.
LOCAL_HOSTS = ('127.0.0.1', 'localhost', '::1')


# ---------------------------------------------------------------- output


def log(level, message):
    """A line in Stash's log: t(race), d(ebug), i(nfo), w(arning), e(rror)."""
    sys.stderr.write('\x01%s\x02%s\n' % (level, message))
    sys.stderr.flush()


def progress(fraction):
    """The task's progress bar in Stash's job list."""
    sys.stderr.write('\x01p\x02%.3f\n' % max(0.0, min(1.0, fraction)))
    sys.stderr.flush()


# ---------------------------------------------------------------- time


def utcnow():
    return datetime.now(timezone.utc).replace(microsecond=0)


def iso(dt):
    return dt.strftime('%Y-%m-%dT%H:%M:%SZ')


def parse_iso(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, '%Y-%m-%dT%H:%M:%SZ').replace(
            tzinfo=timezone.utc
        )
    except ValueError:
        return None


def parse_date(value):
    """A release date (YYYY-MM-DD, or a longer timestamp) as a datetime."""
    try:
        return datetime.strptime(str(value)[:10], '%Y-%m-%d').replace(
            tzinfo=timezone.utc
        )
    except ValueError:
        return None


# ---------------------------------------------------------------- links

# Query parameters that carry an affiliate or tracking code. The plugin
# links only to the address of the scene's page, with none of them.
TRACKING = re.compile(
    r'^(utm_\w*|ref|refid|referrer|aff\w*|nats|ats|campaign\w*|track\w*'
    r'|click\w*|coupon\w*|promo\w*|partner\w*|source|src|fbclid|gclid)$',
    re.I,
)
# Archives copy a page; they never sell the scene.
ARCHIVE = re.compile(r'(^|\.)(archive\.org|archive\.(is|ph|today))$', re.I)
# StashDB files the stores and tubes a scene is sold or shown on under this
# site category; "Studio" takes the rest, mostly the studios' own sites.
STORE_CATEGORY = 'Content distribution platforms'


def clean_url(raw):
    """A web address without tracking parameters or fragment, or None."""
    if not raw or not isinstance(raw, str):
        return None
    try:
        url = parse.urlsplit(raw.strip())
    except ValueError:
        return None
    if url.scheme not in ('http', 'https') or not url.hostname:
        return None
    if ARCHIVE.search(url.hostname):
        return None
    query = [
        (k, v)
        for k, v in parse.parse_qsl(url.query, keep_blank_values=True)
        if not TRACKING.match(k)
    ]
    return parse.urlunsplit(
        (url.scheme, url.netloc, url.path, parse.urlencode(query), '')
    )


def store_link(urls):
    """Where to buy a stash-box scene: a store's page first, else its
    studio's. Stash-boxes that file links by type instead of site take the
    STUDIO one."""
    links = []
    for u in urls or []:
        url = clean_url((u or {}).get('url'))
        if not url:
            continue
        site = (u.get('site') or {}).get('name')
        category = ((u.get('site') or {}).get('category') or {}).get('name')
        links.append((url, site, category, u.get('type')))
    for url, site, category, _ in links:
        if site and category == STORE_CATEGORY:
            return url
    for url, site, _, kind in links:
        if (site and site.lower() == 'studio') or (
            not site and (kind or '').upper() == 'STUDIO'
        ):
            return url
    return None


def host_of(url):
    try:
        return (parse.urlsplit(url).hostname or '').lower()
    except ValueError:
        return ''


def is_local(url):
    return host_of(url) in LOCAL_HOSTS


def same_endpoint(a, b):
    return (a or '').rstrip('/').lower() == (b or '').rstrip('/').lower()


# ---------------------------------------------------------------- HTTP


class Stop(Exception):
    """The service asked to be left alone, or did not answer."""


class Refused(Exception):
    """The service refused the key."""


class Missing(Exception):
    """The service has no such record."""


class Failed(Exception):
    """Any other answer the task cannot use."""


def fetch(url, headers, body=None, context=None):
    data = json.dumps(body).encode('utf-8') if body is not None else None
    req = request.Request(url, data=data, headers=headers)
    try:
        with request.urlopen(req, timeout=TIMEOUT, context=context) as res:
            status, info, raw = res.status, res.headers, res.read()
    except error.HTTPError as e:
        status, info, raw = e.code, e.headers, e.read()
    except (error.URLError, OSError) as e:
        raise Stop('no answer (%s)' % getattr(e, 'reason', e))
    kind = (info.get('Content-Type') or '').lower()
    if (info.get('cf-mitigated') or '').lower() == 'challenge' or (
        'html' in kind and 'json' not in kind
    ):
        raise Stop('a Cloudflare challenge (HTTP %d)' % status)
    if status == 429:
        raise Stop('HTTP 429, too many requests')
    if status >= 500:
        raise Stop('HTTP %d' % status)
    if status in (401, 403):
        raise Refused('HTTP %d' % status)
    if status == 404:
        raise Missing('HTTP 404')
    if status >= 400:
        raise Failed('HTTP %d' % status)
    try:
        return json.loads(raw.decode('utf-8'))
    except ValueError:
        raise Stop('an answer that is not JSON')


class Pacer:
    """One request at a time, each a full pause after the last answer, so a
    slow answer never shortens the pause that follows it."""

    def __init__(self):
        self.last = None

    def call(self, pause, request_fn):
        if self.last is not None:
            left = self.last + pause - time.monotonic()
            if left > 0:
                time.sleep(left)
        try:
            return request_fn()
        finally:
            self.last = time.monotonic()


# ---------------------------------------------------------------- Stash


class Stash:
    """Stash's GraphQL API, with the session cookie Stash gave the task."""

    def __init__(self, conn):
        host = conn.get('Host') or '127.0.0.1'
        if host in ('0.0.0.0', '::', ''):
            host = '127.0.0.1'
        if ':' in host and not host.startswith('['):
            host = '[%s]' % host
        self.url = '%s://%s:%s/graphql' % (
            conn.get('Scheme') or 'http',
            host,
            conn.get('Port') or 9999,
        )
        self.headers = {'Content-Type': 'application/json'}
        cookie = conn.get('SessionCookie') or {}
        if cookie.get('Name'):
            self.headers['Cookie'] = '%s=%s' % (cookie['Name'], cookie['Value'])
        # Stash on this machine, maybe with a certificate of its own
        self.context = ssl._create_unverified_context()

    def call(self, query, variables=None):
        try:
            body = fetch(
                self.url,
                self.headers,
                {'query': query, 'variables': variables or {}},
                self.context,
            )
        except (Stop, Refused, Missing, Failed) as e:
            raise RuntimeError('Stash did not answer: %s' % e)
        if body.get('errors'):
            raise RuntimeError(
                'Stash refused a query: %s' % body['errors'][0].get('message')
            )
        return body['data']


STASH_QUERY = """
query NewReleasesSetup {
  configuration {
    general { stashBoxes { name endpoint api_key max_requests_per_minute } }
    plugins
  }
  findStudios(
    studio_filter: { favorite: true }
    filter: { per_page: -1, sort: "name", direction: ASC }
  ) {
    studios { id name stash_ids { endpoint stash_id } }
  }
}
"""


# ---------------------------------------------------------------- services


def user_agent():
    return 'NewReleases/%s (Stash plugin; +%s)' % (version(), SOURCE)


def version():
    here = os.path.dirname(os.path.abspath(__file__))
    try:
        with open(os.path.join(here, PLUGIN_ID + '.yml'), encoding='utf-8') as f:
            for line in f:
                if line.startswith('version:'):
                    return line.split(':', 1)[1].strip()
    except OSError:
        pass
    return 'dev'


class Service:
    """A stash-box from Stash's settings, and how to pace requests to it."""

    def __init__(self, box, pacer, settings):
        self.name = box.get('name') or box.get('endpoint')
        self.endpoint = box.get('endpoint') or ''
        self.key = box.get('api_key') or ''
        self.pacer = pacer
        rpm = box.get('max_requests_per_minute') or 0
        self.pause = max(PAUSE, 60.0 / rpm) if rpm > 0 else PAUSE
        shorter = settings.get('pauseSeconds')
        if isinstance(shorter, (int, float)) and is_local(self.address()):
            self.pause = max(0.0, float(shorter))

    def address(self):
        return self.endpoint

    def headers(self):
        return {
            'Accept': 'application/json',
            'User-Agent': user_agent(),
        }


class Tpdb(Service):
    """ThePornDB's REST API: a studio's numeric site id from its StashID,
    then its newest scenes, with the same parameters on every install."""

    kind = 'tpdb'

    def __init__(self, box, pacer, settings, api):
        self.api = api.rstrip('/')
        Service.__init__(self, box, pacer, settings)

    def address(self):
        return self.api

    def get(self, path):
        headers = self.headers()
        headers['Authorization'] = 'Bearer %s' % self.key
        return self.pacer.call(self.pause, lambda: fetch(self.api + path, headers))

    def site_id(self, uuid):
        data = (self.get('/sites/%s' % parse.quote(uuid, safe='')) or {}).get(
            'data'
        )
        if not isinstance(data, dict) or data.get('id') is None:
            raise Missing('no site')
        return data['id']

    def scenes(self, site_id):
        page = self.get(
            '/scenes?site_id=%s&per_page=%d&orderBy=recently_released'
            % (parse.quote(str(site_id), safe=''), PER_STUDIO)
        )
        data = (page or {}).get('data')
        return data if isinstance(data, list) else []


BOX_QUERY = """
query NewReleasesScenes($input: SceneQueryInput!) {
  queryScenes(input: $input) {
    scenes {
      id
      title
      release_date
      duration
      details
      images { url width height }
      studio { id name parent { id name } }
      performers { performer { id name disambiguation } }
      tags { id name }
      urls { url site { name category { name } } }
    }
  }
}
"""

REFUSED = re.compile(r'unauthori[sz]ed|forbidden|api key|token|signature', re.I)


class StashBox(Service):
    """Any other stash-box: one queryScenes for all of its studios."""

    kind = 'stashbox'

    def scenes(self, studio_ids):
        headers = self.headers()
        headers['Content-Type'] = 'application/json'
        headers['ApiKey'] = self.key
        query = {
            'query': BOX_QUERY,
            'variables': {
                'input': {
                    'studios': {'value': studio_ids, 'modifier': 'INCLUDES'},
                    'sort': 'DATE',
                    'direction': 'DESC',
                    'page': 1,
                    'per_page': PER_BOX,
                }
            },
        }
        body = self.pacer.call(
            self.pause, lambda: fetch(self.endpoint, headers, query)
        )
        if body.get('errors'):
            message = body['errors'][0].get('message') or 'an error'
            if REFUSED.search(message):
                raise Refused(message)
            raise Failed(message)
        result = (body.get('data') or {}).get('queryScenes') or {}
        return result.get('scenes') or []


def is_tpdb(endpoint):
    host = host_of(endpoint)
    return host == TPDB_HOST or host.endswith('.' + TPDB_HOST)


def services_for(boxes, settings):
    pacer = Pacer()
    test_endpoint = settings.get('tpdbEndpoint')
    test_api = settings.get('tpdbApi')
    out = []
    for box in boxes:
        endpoint = box.get('endpoint') or ''
        if (
            test_endpoint
            and test_api
            and same_endpoint(endpoint, test_endpoint)
            and is_local(endpoint)
            and is_local(test_api)
        ):
            out.append(Tpdb(box, pacer, settings, test_api))
        elif is_tpdb(endpoint):
            out.append(Tpdb(box, pacer, settings, TPDB_API))
        else:
            out.append(StashBox(box, pacer, settings))
    return out


# ---------------------------------------------------------------- releases


def first(*values):
    for v in values:
        if v:
            return v
    return None


def sizes(value):
    return value if isinstance(value, dict) else {}


def tpdb_image(scene):
    """The scene's landscape picture as ThePornDB resizes it for a grid,
    then the studio's full-size one. ThePornDB's posters are portrait
    (800 x 1200 at medium), which a scene card would crop to a strip."""
    background = sizes(scene.get('background'))
    posters = sizes(scene.get('posters'))
    return first(
        background.get('medium'),
        background.get('large'),
        background.get('full'),
        scene.get('image'),
        posters.get('large'),
        posters.get('medium'),
    )


def description(text):
    """A description as plain text, whitespace folded, at most DESCRIPTION
    characters."""
    if not isinstance(text, str):
        return None
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    if len(text) > DESCRIPTION:
        text = text[: DESCRIPTION - 1].rstrip() + '\u2026'
    return text or None


def as_seconds(value):
    try:
        n = int(float(value))
    except (TypeError, ValueError):
        return None
    return n if n > 0 else None


def tpdb_release(scene, endpoint, studio_id):
    sid = scene.get('id')
    if not isinstance(sid, str):
        sid = scene.get('uuid') or (str(sid) if sid is not None else None)
    if not sid:
        return None
    performers = []
    for p in scene.get('performers') or []:
        parent = p.get('parent') if isinstance(p.get('parent'), dict) else {}
        pid = first(parent.get('id'), p.get('id'))
        name = first(p.get('name'), parent.get('name'))
        if not name:
            continue
        entry = {'id': str(pid) if pid is not None else None, 'name': name}
        if parent.get('name') and parent.get('name') != name:
            entry['also'] = [parent['name']]
        performers.append(entry)
    tags = []
    for t in scene.get('tags') or []:
        if t.get('name'):
            tid = first(t.get('uuid'), t.get('id'))
            tags.append({'id': str(tid) if tid is not None else None, 'name': t['name']})
    return {
        'id': sid,
        'endpoint': endpoint,
        'studio': studio_id,
        'title': scene.get('title') or '',
        'date': (scene.get('date') or '')[:10] or None,
        'duration': as_seconds(scene.get('duration')),
        'description': description(scene.get('description')),
        'url': clean_url(scene.get('url')),
        'image': tpdb_image(scene),
        'performers': performers,
        'tags': tags,
    }


def box_image(images):
    """The landscape cover if there is one."""
    shown = [i for i in images or [] if i and i.get('url')]
    for i in shown:
        if not i.get('height') or (i.get('width') or 0) >= i['height']:
            return i['url']
    return shown[0]['url'] if shown else None


def box_release(scene, endpoint, studio_id):
    if not scene.get('id'):
        return None
    performers = []
    for credit in scene.get('performers') or []:
        p = (credit or {}).get('performer') or {}
        if p.get('name'):
            performers.append({'id': p.get('id'), 'name': p['name']})
    return {
        'id': scene['id'],
        'endpoint': endpoint,
        'studio': studio_id,
        'title': scene.get('title') or '',
        'date': (scene.get('release_date') or scene.get('date') or '')[:10]
        or None,
        'duration': as_seconds(scene.get('duration')),
        'description': description(scene.get('details')),
        'url': store_link(scene.get('urls')),
        'image': box_image(scene.get('images')),
        'performers': performers,
        'tags': [
            {'id': t.get('id'), 'name': t['name']}
            for t in scene.get('tags') or []
            if t and t.get('name')
        ],
    }


def since(now, span):
    """The first release date inside a span back from now, as YYYY-MM-DD."""
    return (now - span).strftime('%Y-%m-%d')


def fresh(releases, now):
    """The releases dated within the last 48 hours (later dates count too:
    a studio may list a release before its day)."""
    cut = since(now, FRESH)
    return [r for r in releases if r and (r.get('date') or '') >= cut]


def newest(releases):
    dates = [parse_date(r.get('date')) for r in releases if r.get('date')]
    dates = [d for d in dates if d]
    return max(dates) if dates else None


# ---------------------------------------------------------------- catalog


class Store:
    """catalog/catalog.json in the plugin's folder, written whole each time
    through a temporary file, so the page never reads half of one."""

    def __init__(self, plugin_dir):
        self.dir = os.path.join(plugin_dir, 'catalog')
        self.path = os.path.join(self.dir, 'catalog.json')
        self.lock = os.path.join(self.dir, 'run.lock')

    def load(self):
        empty = {'version': CATALOG_VERSION, 'boxes': {}, 'studios': {}, 'releases': []}
        try:
            with open(self.path, encoding='utf-8') as f:
                catalog = json.load(f)
        except (OSError, ValueError):
            return empty
        if catalog.get('version') == CATALOG_VERSION:
            return catalog
        # An older catalog: keep each studio's ThePornDB site id, so the
        # next check asks once per studio, and ask about every studio again
        for sid, old in (catalog.get('studios') or {}).items():
            if old.get('siteId') is not None and old.get('stashId'):
                empty['studios'][sid] = {
                    'stashId': old['stashId'],
                    'siteId': old['siteId'],
                }
        return empty

    def save(self, catalog, now):
        catalog['saved'] = iso(now)
        os.makedirs(self.dir, exist_ok=True)
        part = self.path + '.part'
        with open(part, 'w', encoding='utf-8') as f:
            json.dump(catalog, f, ensure_ascii=False, separators=(',', ':'))
        os.replace(part, self.path)

    def take_lock(self, now):
        os.makedirs(self.dir, exist_ok=True)
        try:
            age = now.timestamp() - os.path.getmtime(self.lock)
            if age < STALE_LOCK.total_seconds():
                return False
            os.remove(self.lock)
        except OSError:
            pass
        try:
            fd = os.open(self.lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except OSError:
            return False
        with os.fdopen(fd, 'w') as f:
            f.write('%d %s\n' % (os.getpid(), iso(now)))
        return True

    def drop_lock(self):
        try:
            os.remove(self.lock)
        except OSError:
            pass

    def remove(self):
        for name in ('catalog.json', 'catalog.json.part', 'run.lock'):
            try:
                os.remove(os.path.join(self.dir, name))
            except OSError:
                pass
        try:
            os.rmdir(self.dir)
        except OSError:
            pass


def due(entry, now):
    checked = parse_iso((entry or {}).get('checked'))
    if not checked:
        return True
    return now - checked >= (WEEKLY if entry.get('quiet') else DAILY)


def paused(box, now):
    until = parse_iso((box or {}).get('pausedUntil'))
    return bool(until and until > now)


def assign(favourites, services):
    """Each favourite studio's source: (service, StashID there), or None.
    ThePornDB first, then the stash-boxes in Stash's order."""
    out = {}
    ordered = [s for s in services if s.kind == 'tpdb'] + [
        s for s in services if s.kind != 'tpdb'
    ]
    for studio in favourites:
        out[studio['id']] = None
        for service in ordered:
            sid = next(
                (
                    x.get('stash_id')
                    for x in studio.get('stash_ids') or []
                    if same_endpoint(x.get('endpoint'), service.endpoint)
                    and x.get('stash_id')
                ),
                None,
            )
            if sid:
                out[studio['id']] = (service, sid)
                break
    return out


class Run:
    def __init__(self, stash, store, clock=utcnow):
        self.stash = stash
        self.store = store
        self.clock = clock
        self.catalog = None

    def save(self):
        self.store.save(self.catalog, self.clock())

    def box_state(self, service):
        boxes = self.catalog.setdefault('boxes', {})
        state = boxes.setdefault(service.endpoint, {})
        state['name'] = service.name
        state['kind'] = service.kind
        return state

    def stop_box(self, service, reason):
        state = self.box_state(service)
        state['pausedUntil'] = iso(self.clock() + DAILY)
        state['error'] = 'stopped: %s' % reason
        log('w', '%s: %s; asking it again after %s' % (service.name, reason, state['pausedUntil']))

    def set_releases(self, studio_id, releases):
        """A studio's fresh releases, plus those of its releases the catalog
        still holds that the answer no longer lists."""
        new = fresh(releases, self.clock())
        ids = {r['id'] for r in new}
        others = []
        held = []
        for r in self.catalog['releases']:
            if r.get('studio') != studio_id:
                others.append(r)
            elif r.get('id') not in ids:
                held.append(r)
        self.catalog['releases'] = others + held + new
        return len(held) + len(new)

    def check_tpdb(self, service, studio, stash_id):
        entry = self.catalog['studios'][studio['id']]
        if entry.get('stashId') != stash_id:
            entry.pop('siteId', None)
        entry['stashId'] = stash_id
        if entry.get('siteId') is None:
            entry['siteId'] = service.site_id(stash_id)
        scenes = service.scenes(entry['siteId'])
        releases = [tpdb_release(s, service.endpoint, studio['id']) for s in scenes]
        releases = [r for r in releases if r]
        entry['count'] = self.set_releases(studio['id'], releases)
        return releases

    def refresh(self):
        now = self.clock()
        data = self.stash.call(STASH_QUERY)
        config = data['configuration']
        boxes = (config.get('general') or {}).get('stashBoxes') or []
        settings = (config.get('plugins') or {}).get(PLUGIN_ID) or {}
        favourites = data['findStudios']['studios'] or []
        services = services_for(boxes, settings)
        plan = assign(favourites, services)

        self.catalog = catalog = self.store.load()
        ids = {s['id'] for s in favourites}
        catalog['studios'] = {
            k: v for k, v in (catalog.get('studios') or {}).items() if k in ids
        }
        # Releases of studios still favourited, until they are four days old
        cut = since(now, KEPT)
        catalog['releases'] = [
            r
            for r in catalog.get('releases') or []
            if r.get('studio') in ids and (r.get('date') or '') >= cut
        ]
        endpoints = {s.endpoint for s in services}
        catalog['boxes'] = {
            k: v for k, v in (catalog.get('boxes') or {}).items() if k in endpoints
        }
        for studio in favourites:
            entry = catalog['studios'].setdefault(studio['id'], {})
            entry['name'] = studio['name']
            source = plan[studio['id']]
            if source:
                entry['endpoint'] = source[0].endpoint
            else:
                entry.pop('endpoint', None)
        for service in services:
            state = self.box_state(service)
            if not service.key:
                state['error'] = 'no API key'
            elif state.get('error') == 'no API key':
                state.pop('error')
        catalog['run'] = {
            'started': iso(now),
            'finished': None,
            'state': 'running',
            'favourites': sorted(ids, key=lambda x: (len(x), x)),
            'checked': 0,
            'of': 0,
        }

        # What to ask: each due ThePornDB studio on its own, and each
        # stash-box once for all of its studios when any of them is due.
        work = []
        for service in services:
            state = self.box_state(service)
            if not service.key or paused(state, now):
                continue
            mine = [
                (s, plan[s['id']][1])
                for s in favourites
                if plan[s['id']] and plan[s['id']][0] is service
            ]
            if service.kind == 'tpdb':
                work += [
                    (service, [item])
                    for item in mine
                    if due(catalog['studios'][item[0]['id']], now)
                ]
            elif any(due(catalog['studios'][s['id']], now) for s, _ in mine):
                work.append((service, mine))
        catalog['run']['of'] = sum(len(items) for _, items in work)
        self.save()
        log(
            'i',
            '%d favourite studios, %d to check'
            % (len(favourites), catalog['run']['of']),
        )

        stopped = set()
        done = 0
        for service, items in work:
            if service.endpoint in stopped:
                continue
            progress(done / max(1, catalog['run']['of']))
            try:
                if service.kind == 'tpdb':
                    studio, stash_id = items[0]
                    entry = catalog['studios'][studio['id']]
                    try:
                        releases = self.check_tpdb(service, studio, stash_id)
                        entry.pop('error', None)
                        latest = newest(releases)
                        entry['quiet'] = not latest or self.clock() - latest > QUIET
                    except Missing:
                        entry['error'] = 'not found on %s' % service.name
                        entry['quiet'] = True
                        entry['count'] = 0
                        self.set_releases(studio['id'], [])
                    except Failed as e:
                        entry['error'] = str(e)
                    entry['checked'] = iso(self.clock())
                else:
                    self.check_box(service, items)
                self.box_state(service).pop('error', None)
            except Stop as e:
                self.stop_box(service, e)
                stopped.add(service.endpoint)
            except Refused as e:
                self.box_state(service)['error'] = 'refused the API key (%s)' % e
                log('w', '%s refused the API key: %s' % (service.name, e))
                stopped.add(service.endpoint)
            except Failed as e:
                self.box_state(service)['error'] = str(e)
                log('w', '%s: %s' % (service.name, e))
            done += len(items)
            catalog['run']['checked'] = done
            self.save()

        catalog['run']['finished'] = iso(self.clock())
        catalog['run']['state'] = 'stopped' if stopped else 'done'
        self.save()
        progress(1)
        return '%d studios checked, %d releases kept' % (
            done,
            len(catalog['releases']),
        )

    def check_box(self, service, items):
        by_id = {}
        for studio, stash_id in items:
            by_id[stash_id] = studio['id']
        scenes = service.scenes(sorted(by_id))
        found = {sid: [] for sid in by_id.values()}
        for scene in scenes:
            st = scene.get('studio') or {}
            studio_id = by_id.get(st.get('id')) or by_id.get(
                (st.get('parent') or {}).get('id')
            )
            if studio_id:
                found[studio_id].append(box_release(scene, service.endpoint, studio_id))
        now = iso(self.clock())
        for studio_id, releases in found.items():
            entry = self.catalog['studios'][studio_id]
            entry['count'] = self.set_releases(studio_id, releases)
            entry['checked'] = now
            entry.pop('error', None)
            entry.pop('quiet', None)


# ---------------------------------------------------------------- main


def answer(output=None, err=None):
    sys.stdout.write(json.dumps({'output': output, 'error': err}))
    sys.stdout.flush()


def main():
    raw = sys.stdin.read()
    payload = json.loads(raw) if raw.strip() else {}
    conn = payload.get('server_connection') or {}
    args = payload.get('args') or {}
    plugin_dir = conn.get('PluginDir') or os.path.dirname(os.path.abspath(__file__))
    store = Store(plugin_dir)
    mode = args.get('mode') or 'refresh'

    if mode == 'remove':
        store.remove()
        log('i', 'Removed the catalog')
        return answer('removed')

    now = utcnow()
    if not store.take_lock(now):
        log('i', 'A check is already running')
        return answer('already running')
    run = Run(Stash(conn), store)
    try:
        return answer(run.refresh())
    except Exception as e:  # the page shows what went wrong
        message = str(e) or e.__class__.__name__
        log('e', message)
        if run.catalog is not None:
            run.catalog.setdefault('run', {})
            run.catalog['run']['state'] = 'failed'
            run.catalog['run']['message'] = message
            run.catalog['run']['finished'] = iso(utcnow())
            try:
                run.save()
            except OSError:
                pass
        return answer(err=message)
    finally:
        store.drop_lock()


if __name__ == '__main__':
    main()
