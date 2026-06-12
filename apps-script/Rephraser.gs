/**
 * Rephraser.gs — deterministic (no-AI) rule-based rephraser.
 * Ports api/rephraser.py. Preserves dates, numbers, URLs, exam/body names;
 * varies phrasing/synonyms/voice so update text isn't a verbatim copy.
 */

const PHRASE_MAP = {
  'has released': ['has announced', 'has published', 'has declared', 'has made available'],
  'has been released': ['has been announced', 'has been published', 'is now available', 'is now live'],
  'has been declared': ['has been announced', 'is now public', 'has been published'],
  'has been published': ['has been released', 'is now public', 'has been announced'],
  'is available now': ['is now accessible', 'can be accessed now', 'has been made available', 'is now live'],
  'is now available': ['is now accessible', 'has been made available', 'can be accessed now'],
  'candidates can download': ['applicants may obtain', 'candidates can now get', 'you can download', 'aspirants may collect'],
  'candidates can check': ['applicants may verify', 'you can check', 'aspirants can view'],
  'candidates can apply': ['applicants may submit', 'you can apply', 'aspirants can register'],
  'interested candidates': ['eligible applicants', 'aspiring candidates', 'interested applicants'],
  'check here': ['find details here', 'see below', 'refer to the link', 'check the details below'],
  'click here': ['follow this link', 'use the link provided', 'click the link below'],
  'direct link': ['official link', 'access link', 'download link', 'direct access'],
  'given below': ['provided below', 'mentioned below', 'listed below'],
  'provided below': ['given below', 'mentioned below', 'listed here'],
  'official website': ['official portal', 'department website', 'authorized site', 'official webpage'],
  'official notification': ['official circular', 'department notice', 'authorized announcement'],
  'notification has been': ['notification was', 'circular has been', 'announcement was'],
  'result has been declared': ['results are out', 'outcome has been published', 'merit list is now live', 'results have been announced'],
  'results are out': ['results have been declared', 'outcome is now available', 'merit list has been published'],
  'cut off marks': ['minimum qualifying marks', 'qualifying score', 'cutoff score', 'qualifying marks'],
  'admit card': ['hall ticket', 'entry pass', 'examination permit'],
  'admit cards': ['hall tickets', 'entry passes', 'examination permits'],
  'exam will be held': ['test is scheduled', 'examination will take place', 'exam date is fixed', 'test will be conducted'],
  'exam date': ['test date', 'examination schedule', 'assessment date'],
  'exam pattern': ['test structure', 'examination format', 'assessment pattern'],
  'written exam': ['written test', 'pen-and-paper test', 'descriptive test'],
  'online exam': ['computer-based test', 'online test', 'CBT'],
  'last date to apply': ['application deadline', 'final date for submission', 'last day to register'],
  'last date': ['final date', 'deadline', 'closing date'],
  'application form': ['registration form', 'application document', 'online form'],
  'selection process': ['recruitment process', 'hiring procedure', 'selection procedure'],
  'written test': ['written examination', 'descriptive test', 'pen-and-paper exam'],
  'interview round': ['personal interview', 'face-to-face interview', 'oral test'],
  'has been conducted': ['was held', 'took place', 'was organized', 'was carried out'],
  'has been announced': ['is now public', 'was published', 'has been made known', 'is now live'],
  'has been updated': ['was revised', 'is now current', 'has been refreshed'],
  'has been uploaded': ['was posted', 'is now available', 'has been published'],
  'as per the': ['according to the', 'in line with the', 'as stated in the'],
  'for more details': ['for further information', 'for complete details', 'to know more'],
  ' eligible ': [' qualified ', ' meeting criteria '],
  ' eligibility ': [' qualification ', ' criteria ', ' requirements '],
  ' vacancy ': [' opening ', ' position ', ' post '],
  ' vacancies ': [' openings ', ' positions ', ' posts '],
  ' download ': [' obtain ', ' get ', ' collect '],
  ' check ': [' verify ', ' confirm ', ' review '],
  ' apply ': [' submit ', ' register ', ' send in'],
  ' also ': [' additionally ', ' furthermore ', ' as well '],
  ' and ': [' as well as ', ' along with ', ' in addition to'],
  ' but ': [' however ', ' yet ', ' although '],
  ' so ': [' therefore ', ' thus ', ' hence '],
  ' because ': [' since ', ' as ', ' given that'],
  ' important ': [' crucial ', ' significant ', ' essential'],
  ' candidates ': [' applicants ', ' aspirants ', ' test-takers'],
};

const SENTENCE_STARTERS = [
  'Candidates should note that', 'It is informed that', 'As per the official update',
  'According to the latest notice', 'The department has confirmed that',
  'Aspirants are advised that', 'The conducting body has announced that',
  'Interested applicants should know that', 'The official notification states that',
];

const SYNONYMS = [
  ['\\bdownload\\b', ['obtain', 'get', 'collect']],
  ['\\bcheck\\b', ['verify', 'confirm', 'review', 'examine']],
  ['\\bapply\\b', ['submit', 'register', 'send']],
  ['\\bvisit\\b', ['go to', 'access', 'browse']],
  ['\\beligible\\b', ['qualified', 'entitled']],
  ['\\bimportant\\b', ['crucial', 'significant', 'essential']],
  ['\\bofficial\\b', ['authorized', 'departmental', 'government']],
  ['\\bcomplete\\b', ['full', 'entire', 'detailed']],
  ['\\bqualified\\b', ['eligible', 'selected', 'shortlisted']],
  ['\\bselected\\b', ['chosen', 'shortlisted', 'picked']],
  ['\\bannounced\\b', ['declared', 'published', 'released']],
  ['\\breleased\\b', ['published', 'made available', 'issued']],
];

const VOICE_SWAPS = [
  [/\bhas been made available\b/gi, 'is now accessible'],
  [/\bhas been uploaded\b/gi, 'was posted'],
  [/\bhas been updated\b/gi, 'was revised'],
  [/\bhas been conducted\b/gi, 'was held'],
  [/\bhas been organized\b/gi, 'was held'],
  [/\bhas been scheduled\b/gi, 'is set to take place'],
  [/\bhas been postponed\b/gi, 'was delayed'],
  [/\bhas been cancelled\b/gi, 'was called off'],
];

const _PHRASE_RES = Object.keys(PHRASE_MAP).map(function (phrase) {
  return [new RegExp('\\b' + phrase.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi'), PHRASE_MAP[phrase]];
});

function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function _matchCase(original, chosen) {
  if (original === original.toUpperCase()) return chosen.toUpperCase();
  if (original.charAt(0) === original.charAt(0).toUpperCase()) return chosen.charAt(0).toUpperCase() + chosen.slice(1);
  return chosen;
}

function rephraseText(text, isTitle) {
  if (!text || text.length < 10) return text;
  _PHRASE_RES.forEach(function (pair) {
    text = text.replace(pair[0], function (m0) { return _matchCase(m0, _pick(pair[1])); });
  });
  SYNONYMS.forEach(function (pair) {
    text = text.replace(new RegExp(pair[0], 'gi'), function (m0) { return _matchCase(m0, _pick(pair[1])); });
  });
  if (!isTitle) {
    const sentences = text.split(/(?<=[.!?])\s+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (sentences.length >= 2) {
      const timeMarker = /^(first|then|next|after that|finally|lastly|meanwhile|subsequently|thereafter)/i;
      const safe = sentences.every(function (s) { return !timeMarker.test(s); });
      if (safe && Math.random() < 0.4) {
        const first = sentences[0];
        const rest = sentences.slice(1);
        for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = rest[i]; rest[i] = rest[j]; rest[j] = t; }
        text = [first].concat(rest).join(' ');
      } else {
        text = sentences.join(' ');
      }
    }
  }
  if (!isTitle && text.length < 300 && Math.random() < 0.3) {
    const starter = _pick(SENTENCE_STARTERS);
    if (text.charAt(0) === text.charAt(0).toLowerCase()) text = text.charAt(0).toUpperCase() + text.slice(1);
    text = starter + ', ' + text;
  }
  VOICE_SWAPS.forEach(function (pair) { text = text.replace(pair[0], pair[1]); });
  return text.split(/\s+/).join(' ').trim();
}

/** Rephrase title/summary/sections/full_text of an update article dict. */
function rephraseArticle(article) {
  const out = {};
  Object.keys(article).forEach(function (k) { out[k] = article[k]; });
  out.is_rephrased = true;
  out.title = rephraseText(article.title || '', true);
  out.summary = rephraseText(article.summary || '', false);
  out.full_text = rephraseText(article.full_text || '', false);
  out.sections = (article.sections || []).map(function (sec) {
    const ns = {}; Object.keys(sec).forEach(function (k) { ns[k] = sec[k]; });
    ns.content = (sec.content || []).map(function (p) { return rephraseText(p, false); });
    return ns;
  });
  return out;
}
