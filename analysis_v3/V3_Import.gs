/* Read-only Drive adapters and pure source normalization. */
function v3Hash_(text) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(
    text), Utilities.Charset.UTF_8));
}

function v3ScanSources_(cfg, previous, issues, progress, check) {
  progress = progress || {};
  check = check || function() {};
  const discovered = progress.discovered || (progress.discovered = []);
  const definitions = [
    ['recall', cfg.recitations_folder_id],
    ['words', cfg.word_lists_folder_id],
    ['quest', cfg.quest_sessions_folder_id],
    ['layout', cfg.layouts_folder_id],
    ['root', cfg.experiment_data_root_folder_id]
  ];
  const folders = progress.folders || (progress.folders = definitions.filter(function(d) {
    return d[1];
  }).map(function(d) { return { id: d[1], path: d[0], kind: d[0] }; }));
  const visited = progress.visited || (progress.visited = {});
  while (folders.length) {
    check();
    const entry = folders[0];
    if (visited[entry.id]) { folders.shift(); continue; }
    const folder = DriveApp.getFolderById(entry.id);
    if (!entry.filesDone) {
      const fs = entry.fileToken ? DriveApp.continueFileIterator(entry.fileToken) : folder.getFiles();
      try {
        while (fs.hasNext()) {
          check();
          const f = fs.next();
          discovered.push({ id: f.getId(), name: f.getName(), path: entry.path + '/' + f.getName(),
            parent_id: entry.id, modified: f.getLastUpdated().toISOString(), mime_type: f.getMimeType(),
            kind: entry.kind });
        }
        entry.filesDone = true;
      } finally { entry.fileToken = fs.getContinuationToken(); }
    }
    const ds = entry.folderToken ? DriveApp.continueFolderIterator(entry.folderToken) : folder.getFolders();
    const children = entry.children || (entry.children = []);
    try {
      while (ds.hasNext()) {
        check();
        const d = ds.next();
        children.push({ id: d.getId(), path: entry.path + '/' + d.getName(), kind: entry.kind });
      }
    } finally { entry.folderToken = ds.getContinuationToken(); }
    visited[entry.id] = true;
    folders.shift();
    folders.unshift.apply(folders, children);
  }
  cfg.word_list_files.forEach(function(f) {
    if (!discovered.some(function(d) {
        return d.id === f.id && d.kind === 'words';
      })) discovered.push({
      id: f.id,
      name: f.name,
      path: 'configured/' + f.name,
      kind: 'words',
      mime_type: 'text/csv',
      modified: ''
    });
  });
  const files = progress.files || (progress.files = []),
    seen = new Set((progress.audit || []).map(function(r) { return r.file_id; })),
    hashes = new Map(files.map(function(f) { return [f.hash, f.id]; })),
    old = new Map(previous.map(function(r) {
      return [r.file_id, r];
    }));
  const audit = progress.audit || (progress.audit = []);
  discovered.sort(function(a, b) {
    return (a.kind === 'root' ? 1 : 0) - (b.kind === 'root' ? 1 : 0) || a.id.localeCompare(b.id);
  }).forEach(function(f) {
    if (seen.has(f.id)) return;
    check();
    seen.add(f.id);
    if (!/\.(csv|json)$/i.test(f.name)) {
      audit.push({
        file_id: f.id,
        file_name: f.name,
        source_path: f.path,
        kind: f.kind,
        status: 'Unsupported; retained at source'
      });
      return;
    }
    let text;
    try {
      text = DriveApp.getFileById(f.id).getBlob().getDataAsString('UTF-8');
    } catch (e) {
      throw new Error('Cannot read source ' + f.id + ': ' + e.message);
    }
    f.text = text;
    f.hash = v3Hash_(text);
    const before = old.get(f.id);
    const a = {
      file_id: f.id,
      file_name: f.name,
      source_path: f.path,
      kind: f.kind,
      modified: f.modified,
      content_hash: f.hash,
      change: !before ? 'New' : before.content_hash === f.hash ? 'Unchanged' : 'Changed',
      duplicate_content_file_id: hashes.get(f.hash) || '',
      status: 'Read'
    };
    hashes.set(f.hash, f.id);
    audit.push(a);
    files.push(f);
  });
  previous.forEach(function(r) {
    if (r.kind !== 'questionnaire' && !seen.has(r.file_id)) audit.push(Object.assign({}, r, {
      change: 'Removed',
      status: 'No longer in configured sources'
    }));
  });
  return {
    files: files,
    audit: audit
  };
}

function v3ParseFiles_(files, issues) {
  return files.map(function(f) {
    const r = Object.assign({}, f);
    const participantMatch = f.name.match(/^word-recall_(.+?)_condition[-_]/i) || f.name.match(
      /^(.+?)_(?:condition[_-][ab]|mode_durations|mode_totals|selection_choices|loci_placements|recall|recitation)/i
      );
    if (participantMatch) r.participant = participantMatch[1];
    const conditionMatch = f.name.match(/condition[_-]([ab])(?:[._-]([12]))?/i);
    if (conditionMatch) r.condition = 'Condition ' + conditionMatch[1].toUpperCase() + (conditionMatch[
      2] ? '.' + conditionMatch[2] : '');
    try {
      if (/\.csv$/i.test(f.name)) r.parsed = v3ParseCsv_(f.text);
      else r.data = JSON.parse(v3Text_(f.text).replace(/^\uFEFF/, ''));
    } catch (e) {
      r.error = e.message;
      v3Issue_(issues, 'Error', 'invalid_source', f.id, '', e.message);
    }
    return r;
  });
}

function v3WordDefinition_(file, cfg) {
  const configured = cfg.word_list_files.find(function(d) {
    return d.id === file.id;
  });
  if (configured && configured.source) {
    // The two original Condition catalogs contain 20 rows. Early V3 Settings were seeded with
    // 25, so correct those known immutable source identities without overwriting the sheet.
    return /^Condition[AB]$/.test(configured.source) ? Object.assign({}, configured, {
      expected: 20
    }) : configured;
  }
  const n = v3Key_(file.name.replace(/\.csv$/i, ''));
  let m = n.match(/^memorywordslist([ab])(hard)?$/);
  if (m) return {
    source: (m[2] ? 'HardMemory' : 'Memory') + m[1].toUpperCase(),
    set: m[2] ? 'Hard Memory List' : 'Memory List',
    list: m[1] === 'a' ? 'List1' : 'List2',
    expected: 25
  };
  m = n.match(/^condition([ab])words$/);
  if (m) return {
    source: 'Condition' + m[1].toUpperCase(),
    set: 'Condition List',
    list: '',
    expected: 25
  };
  return null;
}

function v3BuildCatalog_(files, cfg, issues) {
  const out = [];
  files.filter(function(f) {
    return f.kind === 'words' && f.parsed && !f.error;
  }).forEach(function(f) {
    const def = v3WordDefinition_(f, cfg);
    const groups = v3Group_(f.parsed.rows, function(r) {
      return v3Text_(v3Get_(r, ['word_source_key'])) || (def ? def.source : v3Text_(v3Get_(r, [
        'List ID'
      ])));
    });
    Object.keys(groups).forEach(function(source) {
      const rows = groups[source];
      const items = rows.map(function(r, i) {
        return {
          word: v3Text_(v3Get_(r, ['word', 'target word', 'stimulus word'])),
          position: v3Number_(v3Get_(r, ['serial position', 'word order', 'position',
            'index'])) || i + 1,
          properties: r
        };
      }).sort(function(a, b) {
        return a.position - b.position;
      });
      const rawSet = v3Get_(rows[0], ['Word List Set']) || (def ? def.set : '');
      const set = v3ListSet_(rawSet);
      const list = v3CanonicalList_(v3Get_(rows[0], ['List ID', 'List'])) || (def ? def.list : '');
      let error = '';
      if (!source || !set || !items.length || items.some(function(i) {
          return !i.word;
        })) error = 'Missing word/source/set metadata';
      if (v3Unique_(items.map(function(i) {
          return v3NormalizeText_(i.word);
        })).length !== items.length) error = 'Duplicate normalized target word';
      if (items.some(function(i, j) {
          return i.position !== j + 1;
        })) error = 'Target positions must be consecutive starting at 1';
      const expected = v3Number_(v3Get_(rows[0], ['expected list size'])) || (def && def.expected) ||
        '';
      if (expected && items.length !== expected) error = 'Expected ' + expected + ' targets; got ' +
        items.length;
      const entry = {
        source: source,
        set: set,
        list: list,
        items: items,
        words: items.map(function(i) {
          return i.word;
        }),
        file_id: f.id,
        hash: f.hash,
        error: error
      };
      out.push(entry);
      if (error) v3Issue_(issues, 'Error', 'target_catalog', f.id, '', error,
        'Review word_list_files in V3 Settings; raw files are unchanged.');
    });
  });
  return out;
}

function v3SelectTargets_(trial, row, catalog, issues) {
  const explicit = v3TargetSlots_(row);
  const source = trial.word_source_key;
  let candidates = catalog.filter(function(c) {
    return (!source || c.source === source) && (!trial.word_list_set || c.set === trial.word_list_set) &&
      (!c.list || c.list === trial.list_id);
  });
  // No implicit fallback across list sets. V2 explicit source mappings remain authoritative.
  if (!source && !trial.word_list_set) candidates = [];
  let chosen = candidates.length === 1 ? candidates[0] : null;
  if (candidates.length > 1) {
    trial.status = trial.status === 'Excluded' ? 'Excluded' : 'Invalid';
    trial.reason = 'Ambiguous target catalog versions';
  }
  if (chosen && chosen.error) {
    trial.status = trial.status === 'Excluded' ? 'Excluded' : 'Invalid';
    trial.reason = chosen.error;
  }
  if (explicit.length && (!explicit.every(Boolean) || v3Unique_(explicit.map(v3NormalizeText_)).length !==
      explicit.length)) {
    trial.status = 'Invalid';
    trial.reason = 'Incomplete or duplicate explicit target list';
  }
  if (explicit.length && chosen && v3TargetSignature_(explicit) !== v3TargetSignature_(chosen.words)) {
    trial.status = 'Invalid';
    trial.reason = 'Explicit targets disagree with selected catalog';
  }
  const words = explicit.length ? explicit : chosen ? chosen.words : [];
  if (!words.length && trial.status !== 'Excluded') {
    trial.status = 'Invalid';
    trial.reason = 'Missing target list or list set; select word_source_key in File Decisions';
  }
  if (chosen) {
    trial.word_list_set = chosen.set;
    trial.word_source_key = chosen.source;
    trial.target_file_id = chosen.file_id;
    trial.target_source_hash = chosen.hash;
    trial.target_items = chosen.items;
  } else {
    trial.target_items = words.map(function(w, i) {
      return {
        word: w,
        position: i + 1,
        properties: {}
      };
    });
    trial.target_file_id = explicit.length ? trial.file_id : '';
    trial.target_source_hash = explicit.length ? trial.source_hash : '';
  }
  trial.target_words = words;
  trial.target_signature = v3TargetSignature_(words);
  if (trial.status === 'Invalid') v3Issue_(issues, 'Error', 'trial_targets', trial.record_id, trial
    .participant_id, trial.reason);
}

function v3RecallInputRows_(file) {
  const out = [];
  (file.parsed ? file.parsed.rows : []).forEach(function(row) {
    const immediate = v3Get_(row, ['immediate_recitation_raw']),
      delayed = v3Get_(row, ['delayed_24h_recitation_raw']),
      week = v3Get_(row, ['delayed_1week_recitation_raw']);
    const legacy = Object.keys(row).some(function(k) {
      return ['immediaterecitationraw', 'delayed24hrecitationraw', 'delayed1weekrecitationraw']
        .includes(v3Key_(k));
    });
    if (legacy) {
      [
        ['Immediate', immediate, 'immediate_recorded_at_iso'],
        ['Delayed24h', delayed, 'delayed_recorded_at_iso'],
        ['Delayed1Week', week, 'week_recorded_at_iso']
      ].forEach(function(a) {
        if (!v3Text_(a[1]) && !v3Get_(row, [a[2]])) return;
        out.push(Object.assign({}, row, {
          Timepoint: a[0],
          responses: a[1],
          __legacy_timepoint: a[0]
        }));
      });
    } else out.push(row);
  });
  return out;
}

function v3TrialId_(file, row) {
  const explicit = v3Get_(row, ['trial_id', 'record_id']);
  const stamp = v3Get_(row, ['Start Timestamp (ISO 8601)', 'recorded_at_iso']);
  return v3Id_(['recall', file.id, explicit || stamp || row.__row_number, row.__legacy_timepoint || '']);
}

function v3BuildRecall_(files, state, catalog, issues) {
  const trials = [];
  files.filter(function(f) {
    return f.kind === 'recall' && f.parsed && !f.error;
  }).forEach(function(f) {
    v3RecallInputRows_(f).forEach(function(row) {
      const id = v3TrialId_(f, row);
      const t = v3Metadata_(row, f, id, state, issues, 'recall');
      t.source_row = row.__row_number;
      t.responses = v3ResponseSlots_(row);
      t.reported_count_audit_only = v3Get_(row, ['Number of Words Recalled']);
      t.timed = v3Boolean_(v3Get_(row, ['Timed']));
      t.recall_duration_seconds = v3Duration_(row);
      t.raw_row_json = JSON.stringify(row);
      v3SelectTargets_(t, row, catalog, issues);
      if (t.responses === null && t.status !== 'Excluded') {
        t.status = 'Invalid';
        t.reason = 'No supported response columns';
        v3Issue_(issues, 'Error', 'recall_schema', id, t.participant_id, t.reason);
      }
      t.audit = v3MatchTrial_(t, state.wordDecisions, state.cfg);
      t.metrics = v3SequenceMetrics_(t.audit, t.target_words);
      if (t.audit.some(function(a) {
          return a.conflict;
        }) && t.status !== 'Excluded') {
        t.status = 'Invalid';
        t.reason = 'Conflicting/invalid word decisions';
        v3Issue_(issues, 'Error', 'word_decision_conflict', id, t.participant_id, t.reason,
          'Fix V3 Word Decisions; the affected trial is blocked.');
      }
      trials.push(t);
    });
  });
  const ids = v3Group_(trials, function(t) {
    return t.record_id;
  });
  Object.keys(ids).forEach(function(id) {
    if (ids[id].length > 1) {
      ids[id].forEach(function(t) {
        if (t.status !== 'Excluded') {
          t.status = 'Duplicate';
          t.reason = 'Duplicate stable trial ID';
        }
      });
      v3Issue_(issues, 'Error', 'duplicate_trial_id', id, '',
        'Duplicate trial identity; use distinct explicit trial IDs.');
    }
  });
  v3RejectDuplicates_(trials, issues, 'recall');
  trials.forEach(function(t) {
    t.retention_change = '';
    if (t.timepoint === 'Immediate' || t.status !== 'Include') return;
    const base = trials.filter(function(b) {
      return b.status === 'Include' && b.participant_id === t.participant_id && b.palace_condition ===
        t.palace_condition && b.timepoint === 'Immediate' && b.target_signature === t
        .target_signature && b.word_list_set === t.word_list_set;
    });
    if (base.length === 1) t.retention_change = t.metrics.proportion_correct - base[0].metrics
      .proportion_correct;
  });
  return trials;
}

function v3Observations_(files, qSources) {
  const out = [];
  files.filter(function(f) {
    return ['recall', 'quest'].includes(f.kind);
  }).forEach(function(f) {
    const rs = f.parsed ? f.parsed.rows : f.data ? [f.data] : [];
    rs.forEach(function(r) {
      const raw = v3Get_(r, ['participant id', 'participant', 'subject']);
      if (raw || f.participant) out.push({
        raw: raw || f.participant,
        condition: v3Get_(r, ['condition code', 'condition']) || f.condition,
        source: f.id
      });
    });
  });
  qSources.forEach(function(s) {
    s.values.slice(1).forEach(function(a) {
      const r = {};
      s.values[0].forEach(function(h, i) {
        r[h] = a[i];
      });
      const raw = v3Get_(r, ['participant id', 'participant']);
      if (raw) out.push({
        raw: raw,
        condition: v3Get_(r, ['condition']),
        source: s.id
      });
    });
  });
  return out;
}
