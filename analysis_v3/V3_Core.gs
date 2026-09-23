/* Pure schema, identity and metadata functions. Empty string is the missing value. */
function v3Text_(v) {
  return String(v === null || v === undefined ? '' : v).trim();
}

function v3NormalizeText_(v) {
  return v3Text_(v).normalize('NFKC').toLowerCase().replace(/[\u200B-\u200F\uFEFF]/g, '').replace(/[’‘`']/g,
    '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

function v3Key_(v) {
  return v3NormalizeText_(v).replace(/ /g, '');
}

function v3Number_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : '';
  const s = v3Text_(v).replace(/−/g, '-');
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s) && isFinite(Number(s)) ? Number(s) : '';
}

function v3Likert_(v) {
  const m = v3Text_(v).replace(/−/g, '-').match(/^([+-]?\d+)(?:\s*[-–:](?:\s*[^\d].*)|\s*)$/);
  return m ? v3Number_(m[1]) : v3Number_(v);
}

function v3Boolean_(v) {
  const s = v3Key_(v);
  return ['true', 'yes', '1', 'include', 'included'].indexOf(s) >= 0 ? true : ['false', 'no', '0', 'exclude',
    'excluded'
  ].indexOf(s) >= 0 ? false : '';
}

function v3Get_(row, names) {
  for (let i = 0; i < names.length; i++) {
    const ks = Object.keys(row || {}).filter(function(k) {
      return v3Key_(k) === v3Key_(names[i]);
    });
    if (ks.length > 1) throw new Error('Ambiguous columns: ' + names[i]);
    if (ks.length && v3Text_(row[ks[0]]) !== '') return row[ks[0]];
  }
  return '';
}

function v3Id_(parts) {
  return 'v3:' + encodeURIComponent(JSON.stringify(parts));
}

function v3Clone_(x) {
  return JSON.parse(JSON.stringify(x));
}

function v3Group_(rows, key) {
  const out = Object.create(null);
  rows.forEach(function(r) {
    const k = key(r);
    (out[k] = out[k] || []).push(r);
  });
  return out;
}

function v3Unique_(xs) {
  return Array.from(new Set(xs));
}

function v3Issue_(issues, severity, code, source, participant, detail, action) {
  issues.push({
    severity: severity,
    code: code,
    source: source || '',
    participant_id: participant || '',
    detail: detail,
    action: action || 'Review V3 File Decisions / Participant Condition Overrides.'
  });
}

function v3CanonicalList_(v) {
  const k = v3Key_(v);
  return ['a', 'lista', 'list1', '1'].indexOf(k) >= 0 ? 'List1' : ['b', 'listb', 'list2', '2'].indexOf(k) >=
    0 ? 'List2' : '';
}

function v3ListSet_(v) {
  const k = v3Key_(v);
  return {
    condition: 'Condition List',
    conditionlist: 'Condition List',
    memory: 'Memory List',
    memorylist: 'Memory List',
    hardmemory: 'Hard Memory List',
    hardmemorylist: 'Hard Memory List'
  } [k] || '';
}

function v3ResolveCondition_(raw, cfg) {
  cfg = cfg || v3Defaults_();
  const s = v3Text_(raw).replace(/^condition[ _-]*/i, '').replace(/[ _-]/g, '').toUpperCase();
  const code = /^[AB]\.?[12]$/.test(s) ? s[0] + '.' + s.slice(-1) : '';
  const m = cfg.condition_map[code];
  return {
    code: code,
    palace_condition: m ? m[0] : '',
    list_id: m ? m[1] : '',
    counterbalance_group: m ? m[2] : '',
    phase: /^(training\d*|aftertraining|practice|tutorial)$/.test(v3Key_(raw)) ? 'Training' : m ? 'Main' : '',
    recognized: !!m
  };
}

function v3Timepoint_(row, cfg) {
  cfg = cfg || v3Defaults_();
  const explicit = v3Get_(row, ['Timepoint', 'Recall Timepoint', 'Recall Stage']);
  if (v3Text_(explicit)) {
    // This spelling is emitted by the current delayed-recall tool. Recognize it even when an
    // existing V3 Settings row predates the alias added in 3.0.1.
    if (v3Key_(explicit) === '1week') return 'Delayed1Week';
    const matches = cfg.timepoints.filter(function(t) {
      return [t.id].concat(t.aliases).some(function(a) {
        return v3Key_(a) === v3Key_(explicit);
      });
    });
    return matches.length === 1 ? matches[0].id : '';
  }
  const week = v3Get_(row, ['After 1 Week', 'After One Week', 'Week Delayed Recall']);
  if (v3Boolean_(week) === true) return 'Delayed1Week';
  if (v3Text_(week) && v3Boolean_(week) === '') return '';
  const day = v3Boolean_(v3Get_(row, ['After 24 Hours']));
  return day === true ? 'Delayed24h' : day === false ? 'Immediate' : '';
}

function v3RegistryDefaults_() {
  const h = v3PersistentHeaders_()['Participant Registry'];
  return v3DefaultRegistryRows_().map(function(a) {
    const r = {};
    h.forEach(function(k, i) {
      r[k] = a[i] === undefined ? '' : a[i];
    });
    r.review_status = 'Reviewed';
    return r;
  });
}

function v3ConditionDefaults_() {
  const h = v3PersistentHeaders_()['Participant Condition Overrides'];
  return v3DefaultParticipantConditionRows_().map(function(a) {
    const r = {};
    h.forEach(function(k, i) {
      r[k] = a[i] === undefined ? '' : a[i];
    });
    return r;
  });
}

function v3ResolveParticipant_(raw, registry) {
  const k = v3NormalizeText_(raw);
  const matches = registry.filter(function(r) {
    return k && [r.canonical_participant_id].concat(v3Text_(r.known_aliases).split(/[;|]/)).some(function(
      a) {
      return v3NormalizeText_(a) === k;
    });
  });
  return {
    participant_id: matches.length === 1 ? matches[0].canonical_participant_id : '',
    record: matches.length === 1 ? matches[0] : null,
    status: matches.length > 1 ? 'Ambiguous' : matches.length ? 'Resolved' : k ? 'Unregistered' : 'Missing'
  };
}

function v3Discover_(observations, registry) {
  const additions = [];
  observations.forEach(function(o) {
    if (!v3Text_(o.raw) || v3ResolveParticipant_(o.raw, registry.concat(additions)).status !==
      'Unregistered') return;
    const suggestions = registry.filter(function(r) {
      return v3Levenshtein_(v3NormalizeText_(r.canonical_participant_id), v3NormalizeText_(o.raw)) <=
        2;
    }).map(function(r) {
      return r.canonical_participant_id;
    });
    additions.push({
      canonical_participant_id: v3Text_(o.raw),
      known_aliases: '',
      inclusion_exclusion: 'Review',
      review_status: 'Review',
      suggested_mapping: suggestions.length ? suggestions.join('; ') :
        'New participant; verify identity and conditions: ' + (o.condition || ''),
      notes: 'Discovered from ' + o.source
    });
  });
  return additions;
}

function v3ChooseDecision_(fileId, recordId, rows) {
  const specific = rows.filter(function(r) {
    return r.record_id && r.record_id === recordId;
  });
  const global = rows.filter(function(r) {
    return !r.record_id && r.file_id === fileId;
  });
  if (specific.length > 1 || global.length > 1) return {
    error: 'Conflicting file/record decisions'
  };
  return Object.assign({}, global[0] || {}, specific[0] || {});
}

function v3Metadata_(row, file, recordId, state, issues, kind) {
  const fd = v3ChooseDecision_(file.id, recordId, state.fileDecisions);
  const sessionId = v3Text_(v3Get_(row, ['session_id'])) || file.session_id || '';
  const rawCondition = v3Get_(row, ['condition_code', 'condition', 'palace_condition', 'palace type']) || file
    .condition || '';
  const sos = state.sessionOverrides.filter(function(o) {
    return o.session_id === sessionId && (!o.source_condition_raw || v3Key_(o.source_condition_raw) ===
      v3Key_(rawCondition));
  });
  const so = sos.length === 1 ? sos[0] : {};
  const rawParticipant = fd.participant_id || so.participant_id_override || v3Get_(row, ['participant_id',
    'participant', 'subject_id', 'subject', 'name'
  ]) || file.participant || '';
  let person = v3ResolveParticipant_(rawParticipant, state.registry);
  const bySession = state.registry.filter(function(r) {
    return sessionId && v3Text_(r.quest_session_ids).split(/[;|]/).indexOf(sessionId) >= 0;
  });
  let error = fd.error || (sos.length > 1 ? 'Conflicting session overrides' : '');
  if (!person.participant_id && bySession.length === 1) person = v3ResolveParticipant_(bySession[0]
    .canonical_participant_id, state.registry);
  if (bySession.length > 1 || (bySession.length === 1 && person.participant_id !== bySession[0]
      .canonical_participant_id)) error = 'Conflicting participant/session identity';
  const rawDetail = v3ResolveCondition_(rawCondition, state.cfg);
  let mappings = state.conditionOverrides.filter(function(o) {
    return v3NormalizeText_(o.participant_id) === v3NormalizeText_(person.participant_id) && v3Key_(o
      .source_condition_raw) === v3Key_(rawCondition);
  });
  // Newer recall files may contain the resolved suffixed code while the preserved V2 override
  // contains the historical unsuffixed source label. A unique resolved-code match carries the
  // verified catalog source forward without guessing from A/B alone.
  if (!mappings.length && rawDetail.recognized) mappings = state.conditionOverrides.filter(function(o) {
    return v3NormalizeText_(o.participant_id) === v3NormalizeText_(person.participant_id) &&
      v3ResolveCondition_(o.resolved_condition_code, state.cfg).code === rawDetail.code;
  });
  if (mappings.length > 1) error = 'Conflicting participant-condition overrides';
  const co = mappings.length === 1 ? mappings[0] : {};
  if ([fd.include, so.include, co.include].some(function(v) {
      return v3Text_(v) && v3Boolean_(v) === '';
    })) error = 'Invalid inclusion decision; use Include/Exclude or true/false';
  let detail = v3ResolveCondition_(fd.condition_code || so.condition_code || co.resolved_condition_code ||
    rawCondition, state.cfg);
  // Explicit palace names in historical Forms establish palace only. Lists require explicit mapping.
  const named = {
    generic: 'Generic',
    genericpalace: 'Generic',
    personalized: 'Personalized',
    personalizedpalace: 'Personalized'
  } [v3Key_(rawCondition)];
  const palace = so.palace_condition_override || co.palace_condition_override || detail.palace_condition ||
    named || '';
  const listRaw = fd.list_id || so.list_id_override || co.list_id_override || v3Get_(row, ['List ID',
  'list']);
  const list = v3CanonicalList_(listRaw) || detail.list_id;
  if (listRaw && !v3CanonicalList_(listRaw)) error = 'Invalid list ID';
  if (detail.recognized && (palace !== detail.palace_condition || list !== detail.list_id)) error =
    'Metadata contradicts authoritative condition mapping';
  if (!['Generic', 'Personalized'].includes(palace) && detail.phase !== 'Training') error = error ||
    'Unresolved palace condition';
  const timepoint = fd.timepoint || so.timepoint ? v3Timepoint_({
    Timepoint: fd.timepoint || so.timepoint
  }, state.cfg) : v3Timepoint_(row, state.cfg);
  if (kind === 'recall' && !timepoint) error = error || 'Unresolved timepoint';
  if (kind === 'recall' && !list) error = error || 'Unresolved target list';
  const setRaw = fd.word_list_set || so.word_list_set || v3Get_(row, ['Word List Set']) || co.word_list_set ||
    (person.participant_id && state.cfg.participant_list_sets[person.participant_id]);
  const set = v3ListSet_(setRaw);
  if (setRaw && !set) error = error || 'Unknown word list set';
  let status = 'Include',
    reason = 'Validated metadata';
  const pr = person.record;
  if (person.status !== 'Resolved') {
    status = 'Invalid';
    reason = person.status + ' participant';
  } else if (v3Boolean_(pr.inclusion_exclusion) === false) {
    status = 'Excluded';
    reason = pr.exclusion_reason || 'Participant excluded';
  } else if (v3Boolean_(pr.inclusion_exclusion) !== true) {
    status = 'Review';
    reason = 'Review participant registry';
  }
  if (detail.phase === 'Training' || so.phase_override === 'Training' || co.phase_override === 'Training') {
    status = 'Excluded';
    reason = 'Training';
  }
  if ([fd.include, so.include, co.include].some(function(v) {
      return v3Boolean_(v) === false;
    })) {
    status = 'Excluded';
    reason = fd.reason || so.reason || co.reason || 'Explicit exclusion';
  }
  if (person.participant_id === 'Michel Gamal' && !state.cfg.michel_original_lists_recovered) {
    status = 'Excluded';
    reason = 'Original word lists not recovered; Micho remains excluded';
  }
  if (error && status !== 'Excluded') {
    status = 'Invalid';
    reason = error;
  }
  if (status !== 'Include' && status !== 'Excluded') v3Issue_(issues, 'Error', 'metadata', recordId, person
    .participant_id, reason);
  const period = v3Number_(fd.period || so.period || co.period || v3Get_(row, ['period', 'condition order']));
  return {
    record_id: recordId,
    file_id: file.id,
    source_hash: file.hash,
    source_path: file.path || file.name,
    participant_id: person.participant_id,
    observed_participant_id: rawParticipant,
    condition_raw: rawCondition,
    condition_code: detail.code,
    palace_condition: palace,
    list_id: list,
    word_list_set: set,
    word_source_key: fd.word_source_key || so.word_source_key || co.word_source_key ||
      (set === 'Memory List' ? (list === 'List1' ? 'MemoryA' : list === 'List2' ? 'MemoryB' : '') :
        set === 'Hard Memory List' ? (list === 'List1' ? 'HardMemoryA' : list === 'List2' ?
          'HardMemoryB' : '') : ''),
    timepoint: timepoint,
    session_id: sessionId,
    counterbalance_group: co.counterbalance_group_override || so.counterbalance_group_override || (pr && pr
      .counterbalance_group !== 'Unknown' ? pr.counterbalance_group : '') || detail.counterbalance_group,
    period: period,
    prior_vr_experience: pr ? v3Boolean_(pr.prior_vr_experience) : '',
    condition_order: pr ? pr.condition_order : '',
    status: status,
    reason: reason,
    layout_file_id: so.layout_file_id || ''
  };
}

function v3ParseCsv_(text) {
  let matrix = [],
    row = [],
    cell = '',
    quoted = false;
  const s = v3Text_(text).replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') {
      if (quoted && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (quoted || !cell) quoted = !quoted;
      else throw new Error('Malformed CSV quote');
    } else if (c === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell);
      matrix.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (quoted) throw new Error('Unterminated CSV quote');
  if (cell || row.length) {
    row.push(cell);
    matrix.push(row);
  }
  if (!matrix.length) return {
    headers: [],
    rows: []
  };
  const headers = matrix.shift().map(v3Text_);
  if (v3Unique_(headers.map(v3Key_)).length !== headers.length) throw new Error(
    'Duplicate normalized CSV headers');
  const rows = [];
  matrix.forEach(function(a, i) {
    if (!a.some(function(v) {
        return v3Text_(v);
      })) return;
    if (a.length !== headers.length) throw new Error('CSV column count mismatch at row ' + (i + 2));
    const r = {
      __row_number: i + 2
    };
    headers.forEach(function(h, j) {
      r[h] = a[j];
    });
    rows.push(r);
  });
  return {
    headers: headers,
    rows: rows
  };
}

function v3ResponseSlots_(row) {
  const numbered = Object.keys(row).map(function(h) {
    const m = v3NormalizeText_(h).match(
      /^(?:recalled word|recall word|response word|response|word|item) (\d+)$/);
    return m ? {
      h: h,
      n: Number(m[1])
    } : null;
  }).filter(Boolean).sort(function(a, b) {
    return a.n - b.n;
  });
  if (numbered.length) {
    const a = Array(numbered[numbered.length - 1].n).fill('');
    numbered.forEach(function(x) {
      a[x.n - 1] = v3Text_(row[x.h]);
    });
    return a;
  }
  const single = v3Get_(row, ['responses', 'recalled_words', 'recited_words', 'recitation', 'recall',
    'words_recalled_raw'
  ]);
  return v3Text_(single) ? v3Text_(single).split(/[;,|\n]/).map(function(s) {
    return s.replace(/^\s*\d+[.)]\s*/, '').trim();
  }) : null;
}

function v3TargetSlots_(row) {
  const hs = Object.keys(row).filter(function(h) {
    return /^target word \d+$/.test(v3NormalizeText_(h));
  }).sort(function(a, b) {
    return Number(a.match(/\d+$/)[0]) - Number(b.match(/\d+$/)[0]);
  });
  const values = hs.map(function(h) {
    return v3Text_(row[h]);
  });
  if (values.some(Boolean)) {
    while (values.length && !values[values.length - 1]) values.pop();
    return values;
  }
  const pipe = v3Get_(row, ['target_words_pipe', 'target_words']);
  return v3Text_(pipe) ? v3Text_(pipe).split(/[|;]/).map(v3Text_) : [];
}

function v3Duration_(row) {
  if (v3Boolean_(v3Get_(row, ['Timed', 'was timed'])) !== true) return '';
  const seconds = v3Number_(v3Get_(row, ['recall_duration_seconds', 'Recall Duration (seconds)',
    'duration_seconds'
  ]));
  if (seconds !== '') return seconds >= 0 ? seconds : '';
  const ms = v3Number_(v3Get_(row, ['Recall Duration (milliseconds)']));
  return ms !== '' && ms >= 0 ? ms / 1000 : '';
}

function v3RejectDuplicates_(records, issues, kind) {
  const groups = v3Group_(records.filter(function(r) {
    return r.status === 'Include';
  }), function(r) {
    return JSON.stringify([r.participant_id, r.palace_condition, kind === 'recall' ? r.timepoint : r
      .metric || kind
    ]);
  });
  Object.keys(groups).forEach(function(k) {
    const g = groups[k];
    if (g.length < 2) return;
    g.forEach(function(r) {
      r.status = 'Duplicate';
      r.reason = 'Multiple eligible records; explicitly exclude unwanted records';
    });
    v3Issue_(issues, 'Error', 'duplicate_' + kind, g.map(function(r) {
      return r.record_id;
    }).join(';'), g[0].participant_id, g[0].reason);
  });
}
